// The mock parties. All in-process; none opens a socket. Tokens are fake JWTs signed with keys generated at startup.
import { createHash, randomUUID } from 'node:crypto';
import { createIssuer, verifyAccessToken, tokenId, generateEcKeyPair } from './keys.js';
import { FakeNet } from './net.js';
import { guardedFetch, rawFetch } from './ssrf.js';
import { URLS, USERS, CLIENTS, ALLOWED_CLIENTS, ALLOWED_ACTORS, TOOLS, freshAccounts } from './world.js';
import { controlById } from './policy.js';

const b64url = (buf) => buf.toString('base64url');
export const s256 = (verifier) => b64url(createHash('sha256').update(verifier).digest());
const refusal = (id, extra = {}) => {
  const c = controlById(id);
  return { ok: false, status: c.status, error: c.error, error_description: c.message, control: id, ...extra };
};

// The long-lived part of the world (signing keys). Rebuilt by /api/reset.
export async function createKeyring() {
  return { good: await createIssuer(URLS.goodAs, 'ES256'), evil: await createIssuer(URLS.evilAs, 'ES256') };
}

export function createGoodAs(keys) {
  const codes = new Map();
  return {
    issuer: URLS.goodAs,
    metadata: () => ({
      issuer: URLS.goodAs, authorization_endpoint: `${URLS.goodAs}/authorize`, token_endpoint: `${URLS.goodAs}/token`,
      jwks_uri: `${URLS.goodAs}/jwks`, code_challenge_methods_supported: ['S256'], authorization_response_iss_parameter_supported: true,
    }),
    issue: ({ sub, client, aud, scope, act }) => keys.good.mint({ sub, client_id: client, azp: client, aud, scope, ...(act ? { act } : {}) }),
    // RFC 8693-style exchange: new token, own audience, short life, the exchanger as actor.
    async exchange(subjectToken, audience, exchanger) {
      const subject = await verifyAccessToken(subjectToken, keys.good);
      return keys.good.mint({ sub: subject.sub, client_id: exchanger, azp: exchanger, aud: audience, scope: 'statements:read', act: { sub: exchanger } }, { expiresInSec: 60 });
    },
    // The user's browser session at the good AS is already signed in and auto-approves (the point is what happens next).
    authorize({ user, client_id, redirect_uri, state, code_challenge, resource, scope }) {
      const code = `code-${randomUUID().slice(0, 8)}`;
      codes.set(code, { sub: user, client_id, code_challenge, resource, scope });
      return { location: `${redirect_uri}?code=${code}&state=${state}&iss=${encodeURIComponent(URLS.goodAs)}`, params: { code, state, iss: URLS.goodAs } };
    },
    async redeem({ code, code_verifier, client_id }) {
      const rec = codes.get(code); codes.delete(code);
      if (!rec) return { error: 'invalid_grant' };
      if (rec.client_id !== client_id) return { error: 'invalid_grant' };
      if (!code_verifier || s256(code_verifier) !== rec.code_challenge) return { error: 'invalid_grant' };
      return { access_token: await keys.good.mint({ sub: rec.sub, client_id, azp: client_id, aud: rec.resource, scope: rec.scope }) };
    },
  };
}

export function createEvilAs(keys, good) {
  const captured = [];
  return {
    issuer: URLS.evilAs, captured,
    metadata: () => ({ issuer: URLS.evilAs, authorization_endpoint: `${URLS.evilAs}/authorize`, token_endpoint: `${URLS.evilAs}/token`, jwks_uri: `${URLS.evilAs}/jwks`, code_challenge_methods_supported: ['S256'] }),
    // The mix-up: send the user straight on to the good AS, so the good AS issues a code to the client.
    authorize: (params) => good.authorize({ user: USERS.mark.sub, ...params }),
    // The client posts the good AS's code (and its PKCE verifier) here; the evil AS keeps both and answers with an error.
    token({ code, code_verifier, client_id }) { captured.push({ code, code_verifier, client_id }); return { error: 'invalid_grant' }; },
    redeemStolen: () => good.redeem(captured.at(-1) || {}),
    // A token that claims the good issuer but is signed with a key the good AS does not publish. Verification must fail.
    async forgeTokenClaimingGoodIssuer(claims) {
      const { SignJWT } = await import('jose');
      const { privateKey } = generateEcKeyPair('ES256');
      return new SignJWT({ ...claims }).setProtectedHeader({ alg: 'ES256', kid: keys.good.kid }).setIssuer(URLS.goodAs).setExpirationTime('5m').sign(privateKey);
    },
  };
}

// Third-party billing backend behind the gateway. It logs what it receives, the way any upstream's access log would.
export function createUpstream(keys) {
  const seen = [];
  return { seen, async handle(token) { await verifyAccessToken(token, keys.good); seen.push(token); return { statement: 'Statement ready' }; } };
}

export function createGateway({ keys, good, upstream, policy, accounts, audit }) {
  return {
    async handle({ tool, args = {}, headers = {} }) {
      const events = [];
      const m = /^Bearer (.+)$/.exec(headers.authorization || '');
      if (!m) return { ok: false, status: 401, error: 'invalid_request', error_description: 'No bearer token.', events };
      const bearer = m[1];
      let claims;
      try { claims = await verifyAccessToken(bearer, keys.good); } // baseline, always on: signature, issuer, expiry
      catch (e) { return { ok: false, status: 401, error: 'invalid_token', error_description: `Token rejected before any policy runs: ${e.code || e.message}.`, baseline: true, events }; }
      const t = TOOLS[tool];
      if (!t) return { ok: false, status: 404, error: 'unknown_tool', error_description: `No tool named ${tool}.`, events };
      const auds = [].concat(claims.aud || []);
      if (policy.audience_binding && !auds.includes(URLS.gateway)) return { ...refusal('audience_binding', { error_description: `${controlById('audience_binding').message} aud=${JSON.stringify(auds)}` }), events };
      if (policy.client_allowlist && !ALLOWED_CLIENTS.includes(claims.azp)) return { ...refusal('client_allowlist', { error_description: `${controlById('client_allowlist').message} azp=${claims.azp}` }), events };
      if (policy.require_delegation && t.agentMediated && claims.act == null) return { ...refusal('require_delegation'), events };
      let actor = claims.act?.sub ?? null;
      if (policy.act_validation) {
        if (claims.act && !ALLOWED_ACTORS.includes(claims.act.sub)) return { ...refusal('act_validation', { error_description: `${controlById('act_validation').message} act.sub=${claims.act.sub}` }), events };
        if (headers['x-actor-client']) events.push({ control: 'act_validation', action: 'ignored_header', message: `Ignored caller-supplied X-Actor-Client=${headers['x-actor-client']}; the actor comes from the signed token only.` });
      } else if (headers['x-actor-client']) actor = headers['x-actor-client']; // the flaw: a caller-supplied actor wins
      const scopes = String(claims.scope || '').split(' ');
      if (policy.scope_check && !scopes.includes(t.scope)) {
        return { ...refusal('scope_check', { error_description: `${controlById('scope_check').message} needs=${t.scope} has=${scopes.join(' ')}` }), wwwAuthenticate: `Bearer error="insufficient_scope", scope="${t.scope}"`, events };
      }
      if (t.objectArg) {
        const acc = accounts[args[t.objectArg]];
        if (policy.ownership_check && (!acc || acc.owner !== claims.sub)) return { ...refusal('ownership_check', { error_description: `${controlById('ownership_check').message} object=${args[t.objectArg]}` }), events };
      }
      const ctx = { sub: claims.sub, actor };
      switch (tool) {
        case 'list_accounts': return { ok: true, status: 200, body: { accounts: Object.values(accounts).filter((a) => a.owner === claims.sub) }, events };
        case 'get_account': return accounts[args.accountId] ? { ok: true, status: 200, body: { account: accounts[args.accountId] }, events } : { ok: false, status: 404, error: 'not_found', events };
        case 'transfer_funds': {
          const { fromAccountId: from, toAccountId: to, amount } = args;
          if (!accounts[from] || !accounts[to] || !(amount > 0)) return { ok: false, status: 400, error: 'invalid_request', events };
          accounts[from].balance -= amount; accounts[to].balance += amount;
          const entry = { action: 'transfer_funds', from, to, amount, onBehalfOf: ctx.sub, actor: ctx.actor };
          audit.push(entry);
          return { ok: true, status: 200, body: { transferred: amount, from, to, audit: entry }, events };
        }
        case 'sync_statement': {
          let upstreamToken = bearer; let kind = 'raw';
          if (policy.no_token_forwarding) {
            upstreamToken = await good.exchange(bearer, URLS.billing, CLIENTS.gateway); kind = 'exchanged';
            events.push({ control: 'no_token_forwarding', action: 'exchanged', error: controlById('no_token_forwarding').error, message: controlById('no_token_forwarding').message });
          }
          await upstream.handle(upstreamToken);
          return { ok: true, status: 200, body: { statement: 'queued', upstreamToken: kind }, events };
        }
        default: return { ok: false, status: 404, error: 'unknown_tool', events };
      }
    },
  };
}

// The consent cookie lives at the third-party AS, keyed to the static client id, in the user's browser.
export function createProxy({ policy }) {
  const staticClientId = 'proxy-static-client';
  const clients = new Map([[CLIENTS.legit, { client_name: 'Gallery Notes', redirect_uris: [URLS.legitCallback] }]]);
  const consents = new Set(); const codes = new Map();
  return {
    staticClientId, codes,
    register({ client_name, redirect_uris }) { const client_id = `dcr-${randomUUID().slice(0, 8)}`; clients.set(client_id, { client_name, redirect_uris }); return { client_id, client_name, redirect_uris }; },
    approveConsent: (browser, client_id) => consents.add(`${browser.user}:${client_id}`),
    thirdPartyApprove: (browser) => browser.cookies.add(`consent:${staticClientId}`),
    authorize({ client_id, redirect_uri, state, browser }) {
      const c = clients.get(client_id);
      if (!c) return { status: 400, error: 'invalid_client' };
      if (!c.redirect_uris.includes(redirect_uri)) return { status: 400, error: 'invalid_request', error_description: 'redirect_uri is not exactly the registered value' }; // baseline, always on
      if (policy.consent_check && !consents.has(`${browser.user}:${client_id}`)) {
        return { status: 200, ...refusal('consent_check'), page: { shows: 'MCP-owned consent page', client_name: c.client_name, redirect_uri, scopes: ['accounts:read'] }, needsConsent: 'mcp' };
      }
      // Hop to the third-party AS with the static client id. A consent cookie for that id skips the consent screen.
      if (!browser.cookies.has(`consent:${staticClientId}`)) return { status: 200, needsConsent: 'third-party' };
      const code = `mcp-${randomUUID().slice(0, 8)}`; codes.set(code, { sub: browser.user, client_id });
      return { status: 302, location: `${redirect_uri}?code=${code}&state=${state}`, code };
    },
  };
}

// The mock MCP client: discovery plus the authorization-response handling that RFC 9207 is about.
export function createClient({ policy, net, asByHost }) {
  const fetchJson = async (url) => {
    const res = policy.ssrf_guard ? await guardedFetch(net, url) : await rawFetch(net, url);
    return res;
  };
  return {
    fetchJson,
    async beginAuth(asUrl) {
      const res = await fetchJson(`${asUrl}/.well-known/oauth-authorization-server`);
      const meta = res.body;
      const code_verifier = b64url(Buffer.from(randomUUID() + randomUUID()));
      return { meta, expectedIssuer: meta.issuer, state: randomUUID().slice(0, 8), code_verifier, code_challenge: s256(code_verifier) };
    },
    async handleCallback(session, params) {
      if (params.state !== session.state) return { ok: false, status: 400, error: 'invalid_state' };
      if (policy.iss_check) {
        if (params.iss !== undefined && params.iss !== session.expectedIssuer) return { ...refusal('iss_check', { error_description: `${controlById('iss_check').message} iss=${params.iss} expected=${session.expectedIssuer}` }) };
        if (params.iss === undefined && session.meta.authorization_response_iss_parameter_supported === true) return { ...refusal('iss_check', { error_description: 'The server advertises iss support but the response has none.' }) };
      }
      // The client believes the response came from the server it started with and posts the code to that server's token endpoint.
      const host = new URL(session.meta.token_endpoint).origin;
      const as = asByHost[host];
      const out = as.token ? await as.token({ code: params.code, code_verifier: session.code_verifier, client_id: CLIENTS.legit }) : await as.redeem({ code: params.code, code_verifier: session.code_verifier, client_id: CLIENTS.legit });
      return { ok: true, status: 200, sentTo: host, tokenEndpointAnswer: out.error ? { error: out.error } : { access_token: '<token>' } };
    },
  };
}

export async function createWorld(keyring, policy) {
  const accounts = freshAccounts(); const audit = [];
  const good = createGoodAs(keyring); const evil = createEvilAs(keyring, good); const upstream = createUpstream(keyring);
  const net = new FakeNet();
  const json = (body, status = 200, headers = {}) => ({ status, body, headers });
  net.addHost('as.gallery.example', ['93.184.216.34']).addService('93.184.216.34', ({ path }) => (path === '/.well-known/oauth-authorization-server' ? json(good.metadata()) : json({ error: 'not_found' }, 404)));
  net.addHost('evil-as.invalid', ['93.184.216.99']).addService('93.184.216.99', ({ path }) => (path === '/.well-known/oauth-authorization-server' ? json(evil.metadata()) : json({ error: 'not_found' }, 404)));
  // SSRF cast: a hostile MCP server and the internal things it points the client at. All fake.
  net.addHost('mcp.evil-mcp.example', ['93.184.216.40']).addService('93.184.216.40', ({ path }) => {
    if (path === '/mcp') return json({ error: 'unauthorized' }, 401, { 'www-authenticate': 'Bearer resource_metadata="https://169.254.169.254/latest/meta-data/"' });
    if (path === '/.well-known/oauth-protected-resource/mcp') return json({ resource: 'https://mcp.evil-mcp.example/mcp', authorization_servers: ['https://localhost.evil-mcp.example'] });
    return json({ error: 'not_found' }, 404);
  });
  net.addHost('redirect.evil-mcp.example', ['93.184.216.41']).addService('93.184.216.41', () => ({ status: 302, headers: { location: 'https://10.0.0.5/internal/config' }, body: null }));
  net.addHost('localhost.evil-mcp.example', ['127.0.0.1']);
  net.addHost('rebind.evil-mcp.example', [['93.184.216.42'], ['169.254.169.254']]);
  net.addService('93.184.216.42', () => json({ resource: 'https://rebind.evil-mcp.example', note: 'public face' }));
  net.addService('169.254.169.254', () => json({ role: 'gallery-fake-role', note: 'FAKE cloud metadata, not a credential', AccessKeyId: 'FAKE-GALLERY-KEY' }));
  net.addService('127.0.0.1', () => json({ admin: 'fake-admin-panel', note: 'FAKE loopback service' }));
  net.addService('10.0.0.5', () => json({ internal: 'fake-internal-config', note: 'FAKE private-range service' }));
  const asByHost = { [URLS.goodAs]: good, [URLS.evilAs]: evil };
  return {
    policy, keys: keyring, good, evil, upstream, net, accounts, audit,
    gateway: createGateway({ keys: keyring, good, upstream, policy, accounts, audit }),
    client: createClient({ policy, net, asByHost }),
    proxy: createProxy({ policy }),
  };
}
export { tokenId };
