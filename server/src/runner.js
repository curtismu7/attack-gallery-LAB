// Interprets attack steps against the mock stack. Returns a trace of redacted requests/responses (decoded claims only).
import { createWorld } from './parties.js';
import { describeToken, tokenId } from './keys.js';
import { USERS, CLIENTS, URLS } from './world.js';
import { SsrfBlocked } from './ssrf.js';
import { controlById } from './policy.js';

const PERSONA_AUD = { gateway: URLS.gateway, billing: URLS.billing };
const clip = (v) => (typeof v === 'string' && v.length > 400 ? `${v.slice(0, 400)}...` : v);
const clipDeep = (o) => JSON.parse(JSON.stringify(o ?? null, (_, v) => clip(v)));
const view = (token) => (token ? describeToken(token) : null);
const redactHeaders = (h = {}) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k, k === 'authorization' ? 'Bearer <token, claims decoded in "token">' : v]));

function push(S, step, entry) {
  S.trace.push({ n: S.trace.length + 1, step: step.id, label: step.label, ...entry });
}
function refuse(S, step, r) {
  S.refusals.push({ step: step.id, status: r.status, error: r.error, message: r.error_description || r.message, control: r.control, kind: r.control === 'no_token_forwarding' ? 'neutralised' : 'refused' });
  if (r.control !== 'no_token_forwarding') S.halted = !step.continueOnRefusal;
}
const noteEvents = (S, step, events = []) => { for (const e of events) if (e.action === 'exchanged') refuse(S, step, { status: 200, error: e.error, message: e.message, control: e.control }); };

const STEPS = {
  async mint(S, step) {
    const c = step.claims; const w = S.world;
    const token = await w.good.issue({ sub: USERS[c.user].sub, client: CLIENTS[c.client], aud: PERSONA_AUD[c.aud], scope: c.scope, act: c.act ? { sub: CLIENTS[c.act] } : undefined });
    S.tokens[step.var] = token;
    push(S, step, { actor: 'good AS', request: { op: 'issue access token', for: c }, response: { token: view(token) }, verdict: 'info' });
  },
  async call(S, step) {
    const token = S.tokens[step.token];
    const headers = { authorization: `Bearer ${token}`, ...(step.headers || {}) };
    const r = await S.world.gateway.handle({ tool: step.tool, args: step.args, headers });
    S.last = r; S.lastCall = r;
    push(S, step, { actor: 'gateway', request: { tool: step.tool, args: step.args, headers: redactHeaders(headers), token: view(token) }, response: clipDeep({ status: r.status, ...(r.ok ? { body: r.body } : { error: r.error, error_description: r.error_description, www_authenticate: r.wwwAuthenticate }), notes: r.events?.length ? r.events : undefined }), verdict: r.ok ? 'ok' : 'refused', control: r.control });
    if (!r.ok && r.control) refuse(S, step, r); else if (!r.ok) S.halted = true;
    noteEvents(S, step, r.events);
  },
  async 'replay-captured'(S, step) {
    const w = S.world; const captured = w.upstream.seen.at(-1);
    const isRaw = captured && tokenId(captured) === tokenId(S.tokens.main);
    if (!isRaw) { push(S, step, { actor: 'billing backend operator', request: { op: 'replay what the log captured' }, response: { skipped: 'The backend holds a different token (own audience, 60 seconds, act = gateway), not the caller\'s. Nothing of the caller\'s to replay.', captured: view(captured) }, verdict: 'info' }); return; }
    S.tokens.captured = captured;
    const r = await w.gateway.handle({ tool: step.tool, args: step.args, headers: { authorization: `Bearer ${captured}` } });
    S.last = r; S.replay = r;
    push(S, step, { actor: 'billing backend operator', request: { tool: step.tool, headers: redactHeaders({ authorization: 1 }), token: view(captured) }, response: clipDeep({ status: r.status, ...(r.ok ? { body: r.body } : { error: r.error }) }), verdict: r.ok ? 'ok' : 'refused', control: r.control });
  },
  async 'authz-start'(S, step) {
    const asUrl = URLS.evilAs;
    const sess = await S.world.client.beginAuth(asUrl);
    S.sess = sess;
    push(S, step, { actor: 'client', request: { op: 'discover and start authorization', server: asUrl, resource: URLS.gateway, code_challenge_method: 'S256' }, response: { expected_issuer: sess.expectedIssuer, advertises_iss_support: sess.meta.authorization_response_iss_parameter_supported === true }, verdict: 'info' });
  },
  async 'authz-bounce'(S, step) {
    const { sess, world } = S;
    const out = world.evil.authorize({ client_id: CLIENTS.legit, redirect_uri: URLS.legitCallback, state: sess.state, code_challenge: sess.code_challenge, resource: URLS.gateway, scope: 'accounts:read' });
    S.callback = out.params;
    push(S, step, { actor: 'evil AS, then good AS', request: { op: 'authorization request arrives at the evil AS and is forwarded to the good AS' }, response: { redirect_to_client: { redirect_uri: URLS.legitCallback, params: { code: '<redacted>', state: out.params.state, iss: out.params.iss } } }, verdict: 'info' });
  },
  async 'authz-callback'(S, step) {
    const r = await S.world.client.handleCallback(S.sess, S.callback);
    S.cb = r;
    push(S, step, { actor: 'client', request: { op: 'check the response, then redeem the code', expected_issuer: S.sess.expectedIssuer, response_iss: S.callback.iss }, response: clipDeep(r.ok ? { sent_code_and_verifier_to: r.sentTo, answer: r.tokenEndpointAnswer } : { error: r.error, error_description: r.error_description }), verdict: r.ok ? 'ok' : 'refused', control: r.control });
    if (!r.ok) refuse(S, step, r);
  },
  async 'attacker-redeem'(S, step) {
    const w = S.world; const out = await w.evil.redeemStolen();
    if (out.error) { push(S, step, { actor: 'evil AS', request: { op: 'redeem stolen code at the good AS' }, response: out, verdict: 'refused' }); S.halted = true; return; }
    S.tokens.redeemed = out.access_token;
    push(S, step, { actor: 'evil AS', request: { op: 'redeem stolen code + verifier at the good AS' }, response: { token: view(out.access_token) }, verdict: 'ok' });
  },
  async 'proxy-login'(S, step) {
    const { proxy } = S.world; S.browser = { user: USERS.mark.sub, cookies: new Set() };
    const approvals = [];
    let r;
    for (let i = 0; i < 4; i++) {
      r = proxy.authorize({ client_id: CLIENTS.legit, redirect_uri: URLS.legitCallback, state: 's1', browser: S.browser });
      if (r.needsConsent === 'mcp') { proxy.approveConsent(S.browser, CLIENTS.legit); approvals.push('MCP consent page for client-legit approved by Mark'); } else if (r.needsConsent === 'third-party') { proxy.thirdPartyApprove(S.browser); approvals.push('third-party AS consent for the static client id approved by Mark (cookie set)'); } else break;
    }
    push(S, step, { actor: 'Mark', request: { op: 'authorize via client-legit', client_id: CLIENTS.legit }, response: { approvals, browser_cookies: [...S.browser.cookies], result: r.status === 302 ? 'redirected to the legitimate client' : r }, verdict: 'info' });
  },
  async 'dcr-register'(S, step) {
    const reg = S.world.proxy.register({ client_name: 'Totally Legit Notes', redirect_uris: [URLS.attackerCallback] });
    S.dcr = reg;
    push(S, step, { actor: 'attacker', request: { op: 'POST /register', client_name: reg.client_name, redirect_uris: reg.redirect_uris }, response: { client_id: reg.client_id }, verdict: 'info' });
  },
  async 'proxy-authorize'(S, step) {
    const r = S.world.proxy.authorize({ client_id: S.dcr.client_id, redirect_uri: URLS.attackerCallback, state: 'attacker-state', browser: S.browser });
    S.deputy = r;
    push(S, step, { actor: 'MCP proxy', request: { op: 'GET /authorize', client_id: S.dcr.client_id, redirect_uri: URLS.attackerCallback, browser_cookies: [...S.browser.cookies] }, response: clipDeep(r.status === 302 ? { status: 302, location: r.location.replace(/code=[^&]+/, 'code=<redacted>'), note: 'consent screen skipped: the static client id cookie matched' } : { status: r.status, error: r.error, error_description: r.error_description, consent_page_shown_to_user: r.page }), verdict: r.status === 302 ? 'ok' : 'refused', control: r.control });
    if (r.control) refuse(S, step, r);
  },
  async 'ssrf-fetch'(S, step) {
    const url = step.fromHeader ? S.resourceMetadataUrl : step.url;
    if (!url) { push(S, step, { actor: 'client', request: { op: 'fetch' }, response: { skipped: 'no URL from the previous step' }, verdict: 'info' }); return; }
    try {
      const res = await S.world.client.fetchJson(url);
      if (step.id === 'probe') S.resourceMetadataUrl = /resource_metadata="([^"]+)"/.exec(res.headers['www-authenticate'] || '')?.[1];
      const internal = res.hops.filter((h) => !isPublicHop(h));
      S.fetches.push({ url, res, internal });
      push(S, step, { actor: 'client', request: { op: 'GET', url }, response: clipDeep({ status: res.status, hops: res.hops, body: res.body, www_authenticate: res.headers['www-authenticate'] }), verdict: internal.length ? 'ok' : 'info' });
    } catch (e) {
      if (!(e instanceof SsrfBlocked)) throw e;
      const c = controlById('ssrf_guard');
      push(S, step, { actor: 'client', request: { op: 'GET', url }, response: { refused: e.code, reason: e.reason, address: e.address, error_description: c.message }, verdict: 'refused', control: 'ssrf_guard' });
      refuse(S, step, { status: 400, error: e.code, error_description: `${c.message} (${e.reason}${e.address ? ` ${e.address}` : ''})`, control: 'ssrf_guard' });
    }
  },
};
const PUBLIC_PREFIX = '93.184.216.';
const isPublicHop = (h) => h.address.startsWith(PUBLIC_PREFIX);

// What the attacker walked away with, or null. Written so each reads the outcome, never the policy flags.
const GAINS = {
  'wrong-scope': (S) => (S.lastCall?.ok ? `moved ${S.lastCall.body.transferred} from ${S.lastCall.body.from} with a read-only token` : null),
  'other-account': (S) => (S.lastCall?.ok ? `read Mary's account ${S.lastCall.body.account.id}, balance ${S.lastCall.body.account.balance}` : null),
  'bad-client': (S) => (S.lastCall?.ok ? `an unregistered client read Mark's accounts (${S.lastCall.body.accounts.map((a) => a.id).join(', ')})` : null),
  'rogue-actor': (S) => (S.lastCall?.ok ? `transfer of ${S.lastCall.body.transferred} executed, audit record names the actor "${S.lastCall.body.audit.actor}" although the signed token names ${CLIENTS.rogue}` : null),
  impersonation: (S) => (S.lastCall?.ok ? `transfer of ${S.lastCall.body.transferred} executed with no agent in the audit record (actor: ${S.lastCall.body.audit.actor})` : null),
  'raw-forwarding': (S) => (S.replay?.ok ? `the backend's log held Mark's live token; replayed at the gateway it listed ${S.replay.body.accounts.map((a) => a.id).join(', ')}` : null),
  'issuer-mixup': (S) => (S.lastCall?.ok ? `the evil AS redeemed Mark's code and listed his accounts (${S.lastCall.body.accounts.map((a) => a.id).join(', ')})` : null),
  'audience-confusion': (S) => (S.lastCall?.ok ? `a token issued for the billing API listed Mark's accounts at the gateway (${S.lastCall.body.accounts.map((a) => a.id).join(', ')})` : null),
  'confused-deputy-dcr': (S) => (S.deputy?.status === 302 && S.deputy.location.startsWith(URLS.attackerCallback) ? `an MCP authorization code for Mark was delivered to ${URLS.attackerCallback} without consent` : null),
  'ssrf-metadata': (S) => {
    const hit = S.fetches.filter((f) => f.internal.length && f.res.status === 200);
    return hit.length ? `reached ${hit.length} internal fake service(s): ${hit.map((f) => f.internal.at(-1).address).join(', ')}; got ${hit.map((f) => Object.keys(f.res.body).join('/')).join(' | ')}` : null;
  },
};

export async function runAttack(attack, policy, keyring) {
  const world = await createWorld(keyring, policy);
  const S = { world, tokens: {}, trace: [], refusals: [], fetches: [], halted: false };
  for (const step of attack.steps) {
    if (S.halted) break;
    await STEPS[step.kind](S, step);
  }
  const gain = GAINS[attack.id](S);
  return {
    attackId: attack.id, config: Object.values(policy).every(Boolean) ? 'governed' : Object.values(policy).every((v) => !v) ? 'ungoverned' : 'custom',
    policy: { ...policy }, succeeded: gain !== null, gain, refusal: gain === null ? (S.refusals[0] || null) : null, trace: S.trace,
    audit: world.audit.length ? world.audit : undefined,
  };
}
