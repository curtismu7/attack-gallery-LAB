// Turns one trace entry into "on the wire" text: the request, the response and the token, plus plain-language notes.
// Everything is built from the simulated parties' own trace (decoded header and claims). The compact token is rebuilt here
// with the fixed signature `sig-not-real`: the server never returns, and no one ever holds, a real signed token.
export const SIGNATURE = 'sig-not-real';
const HOST = { gateway: 'gw.gallery.example', goodAs: 'as.gallery.example', evilAs: 'evil-as.invalid', proxy: 'proxy.gallery.example', callback: 'app.gallery.example' };
const STATUS_TEXT = { 200: 'OK', 201: 'Created', 302: 'Found', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found' };
const b64url = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const compact = (token) => [b64url(token.header), b64url(token.claims), SIGNATURE];
const json = (o) => JSON.stringify(o, null, 2);

export const HEADER_NOTES = {
  alg: 'How the signature was made. The receiver checks it with the issuer\'s public key.',
  kid: 'Which of the issuer\'s published keys checks the signature.',
  typ: 'Token type. at+jwt means an access token written as a JSON Web Token (JWT).',
};
export const CLAIM_NOTES = {
  iss: 'Issuer: who created and signed this token. A receiver only trusts issuers it knows.',
  sub: 'Subject: who the token is about. Here, the person.',
  aud: 'Audience: the one service this token is meant for. A service should refuse a token whose aud is not itself.',
  scope: 'The list of things the token allows.',
  azp: 'Authorized party: the app (client) the token was issued to.',
  client_id: 'The app (client) the token was issued to.',
  act: 'Actor: the agent acting for the person. It lets an audit record name both. (RFC 8693)',
  exp: 'Expires at, as a Unix time (seconds since 1970). A short life limits what a stolen token is worth.',
  iat: 'Issued at, as a Unix time.',
  jti: 'Token id: unique per token, so logs can tell tokens apart.',
};
// Plain definitions, shown in the "Jargon" box for the terms that appear in the panel.
export const JARGON = {
  bearer: ['Bearer token', 'A pass that works for whoever holds it. Anyone who copies it can use it, which is why where it works (aud) and what it allows (scope) matter.'],
  jwt: ['JWT', 'JSON Web Token: three parts joined by dots, header.payload.signature. The header and payload are readable by anyone; the signature proves the issuer made them.'],
  mcp: ['MCP gateway', 'The front door of the tool server. Agents send tool calls here with a bearer token and it decides whether to run them.'],
  iss: ['iss (issuer)', CLAIM_NOTES.iss], sub: ['sub (subject)', CLAIM_NOTES.sub], aud: ['aud (audience)', CLAIM_NOTES.aud], scope: ['scope', CLAIM_NOTES.scope],
  azp: ['azp (authorized party)', CLAIM_NOTES.azp], act: ['act (actor)', CLAIM_NOTES.act], exp: ['exp', CLAIM_NOTES.exp], jti: ['jti', CLAIM_NOTES.jti],
};

// The deciding field for each attack: claims that are read, claims whose ABSENCE decides, and text to highlight in the messages.
const KEY = {
  'wrong-scope': { claims: ['scope'], marks: ['accounts:write', 'insufficient_scope'], why: 'The deciding field is scope: the token carries accounts:read but transfer_funds needs accounts:write.' },
  'other-account': { claims: ['sub'], marks: ['"accountId": "acc-2001"', 'forbidden_object'], why: 'The deciding comparison is sub (whose token this is) against the owner of the account named in the request body.' },
  'bad-client': { claims: ['azp'], marks: ['unauthorized_client'], why: 'The deciding field is azp: the token was issued to client-attacker, which the gateway operator never registered.' },
  'rogue-actor': { claims: ['act'], marks: ['X-Actor-Client: agent-ok', 'unauthorized_actor'], why: 'The signed act claim names agent-rogue. The X-Actor-Client header is unsigned text the caller typed, so only the signed claim may be believed.' },
  impersonation: { missing: ['act'], marks: ['delegation_required'], why: 'The deciding fact is what is missing: there is no act claim, so nothing records that an agent acted for Mark.' },
  'raw-forwarding': { claims: ['jti', 'aud'], marks: ['token_forwarding_blocked'], why: 'The jti (token id) in the backend\'s log equals the jti of Mark\'s token: it is a copy of the same credential. With the control on, the backend only ever sees a different token with its own aud and a 60 second life.' },
  'issuer-mixup': { claims: ['iss'], marks: ['iss='], why: 'The deciding field is the iss in the authorization response. It names the good server while the client believes it talked to the evil one.' },
  'audience-confusion': { claims: ['aud'], marks: ['invalid_token'], why: 'The deciding field is aud: the token was issued for the billing API, not for this gateway. Signature and issuer are fine, so only an audience check catches it.' },
  'confused-deputy-dcr': { marks: ['redirect_uri=https://attacker.example/cb', 'Cookie:', 'consent_required'], why: 'The deciding field is the Cookie header: the third-party server remembers "approved" for the shared client id, so it skips the question for the attacker\'s redirect address.' },
  'ssrf-metadata': { marks: ['resource_metadata', 'ssrf_blocked'], why: 'The deciding field is the address in resource_metadata: a hostile server chose a link-local address, and a client that fetches it blindly reads internal data.' },
};

const kv = (o = {}) => Object.entries(o).map(([k, v]) => [k, String(v)]);
const stat = (status) => ({ line: `HTTP/1.1 ${status} ${STATUS_TEXT[status] || ''}`.trim(), ok: status >= 200 && status < 400 });
const bearer = (token) => `Bearer ${compact(token).join('.')}`;
const url = (path) => `https://${path}`;
const form = (o) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join('\n&');

// One gateway tool call (the same shape for a normal call and a replay).
function gatewayCall(e, token, extraHeaders = {}) {
  const r = e.response; const status = r.status ?? 200;
  const args = e.request.args ?? {};
  return {
    req: { start: `POST ${url(HOST.gateway)}/mcp HTTP/1.1`, headers: [['Host', HOST.gateway], ['Content-Type', 'application/json'], ['Accept', 'application/json'], ['Authorization', bearer(token)], ...kv(extraHeaders)], body: json({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: e.request.tool, arguments: args } }) },
    res: { status: stat(status), headers: [['Content-Type', 'application/json'], ...(r.www_authenticate ? [['WWW-Authenticate', r.www_authenticate]] : [])], body: json(e.verdict === 'ok' ? r.body : { error: r.error, error_description: r.error_description }) },
    tokenLabel: 'The token the caller sent (the Authorization header above, decoded)',
  };
}
const NOTE_HEADERS = { 'x-actor-client': 'X-Actor-Client' };

const BUILD = {
  mint(e) {
    const t = e.response.token; const exp = t.claims.exp - t.claims.iat;
    return {
      req: { start: `POST ${url(HOST.goodAs)}/token HTTP/1.1`, headers: [['Host', HOST.goodAs], ['Content-Type', 'application/x-www-form-urlencoded']], body: form({ grant_type: 'authorization_code', code: 'code-example', client_id: t.claims.client_id, code_verifier: 'verifier-not-real' }) },
      res: { status: stat(200), headers: [['Content-Type', 'application/json'], ['Cache-Control', 'no-store']], body: json({ access_token: compact(t).join('.'), token_type: 'Bearer', expires_in: exp }) },
      tokenLabel: 'The token that came back (this is the one used next)', setup: true,
    };
  },
  call(e) {
    const h = e.request.headers || {}; const extra = Object.fromEntries(Object.entries(h).filter(([k]) => k !== 'authorization').map(([k, v]) => [NOTE_HEADERS[k] || k, v]));
    return gatewayCall(e, e.request.token, extra);
  },
  'replay-captured'(e) {
    if (e.response.skipped) return { none: `No network call here: ${e.response.skipped}`, token: e.response.captured, tokenLabel: 'What the backend actually holds' };
    return gatewayCall(e, e.request.token);
  },
  'authz-start'(e) {
    const host = e.request.server.replace('https://', '');
    return {
      req: { start: `GET ${e.request.server}/.well-known/oauth-authorization-server HTTP/1.1`, headers: [['Host', host], ['Accept', 'application/json']] },
      res: { status: stat(200), headers: [['Content-Type', 'application/json']], body: json({ issuer: e.response.expected_issuer, authorization_response_iss_parameter_supported: e.response.advertises_iss_support, note: 'trimmed: other metadata fields left out' }) },
    };
  },
  'authz-bounce'(e) {
    const p = e.response.redirect_to_client.params;
    return {
      req: { start: `GET ${url(HOST.evilAs)}/authorize?client_id=client-legit&response_type=code&code_challenge=challenge-not-real&state=${p.state} HTTP/1.1`, headers: [['Host', HOST.evilAs]] },
      res: { status: stat(302), headers: [['Location', `${url(HOST.callback)}/callback?code=code-example&state=${p.state}&iss=${p.iss}`]], body: '' },
    };
  },
  'authz-callback'(e) {
    const r = e.request; const ok = e.verdict === 'ok';
    return {
      req: { start: `GET ${url(HOST.callback)}/callback?code=code-example&state=state-example&iss=${r.response_iss} HTTP/1.1`, headers: [['Host', HOST.callback], ['Referer', `${r.expected_issuer}/`]] },
      res: ok ? { status: stat(200), headers: [['Content-Type', 'application/json']], body: json({ note: 'The client accepted the response and sent code + code_verifier to', ...e.response }) }
        : { none: `The client sends nothing further. It compared iss=${r.response_iss} with the server it expected (${r.expected_issuer}), found they differ, and kept the code.` },
    };
  },
  'attacker-redeem'(e) {
    return {
      req: { start: `POST ${url(HOST.goodAs)}/token HTTP/1.1`, headers: [['Host', HOST.goodAs], ['Content-Type', 'application/x-www-form-urlencoded']], body: form({ grant_type: 'authorization_code', code: 'code-example', client_id: 'client-legit', code_verifier: 'verifier-not-real' }) },
      res: e.response.token ? { status: stat(200), headers: [['Content-Type', 'application/json']], body: json({ access_token: compact(e.response.token).join('.'), token_type: 'Bearer' }) } : { status: stat(400), headers: [['Content-Type', 'application/json']], body: json(e.response) },
      tokenLabel: 'The token the evil server walked away with',
    };
  },
  'proxy-login': (e) => ({ none: `No network call here: this is a decision a person makes. Mark approves the consent screens in his browser (${(e.response.approvals || []).join('; ')}).` }),
  'dcr-register'(e) {
    return {
      req: { start: `POST ${url(HOST.proxy)}/register HTTP/1.1`, headers: [['Host', HOST.proxy], ['Content-Type', 'application/json']], body: json({ client_name: e.request.client_name, redirect_uris: e.request.redirect_uris }) },
      res: { status: stat(201), headers: [['Content-Type', 'application/json']], body: json({ client_id: e.response.client_id }) },
    };
  },
  'proxy-authorize'(e) {
    const r = e.request; const q = `client_id=${r.client_id}&redirect_uri=${r.redirect_uri}&state=attacker-state`;
    const res = e.response; const status = res.status ?? 200;
    return {
      req: { start: `GET ${url(HOST.proxy)}/authorize?${q} HTTP/1.1`, headers: [['Host', HOST.proxy], ...(r.browser_cookies?.length ? [['Cookie', r.browser_cookies.join('; ')]] : [])] },
      res: { status: stat(status), headers: res.location ? [['Location', res.location]] : [['Content-Type', 'application/json']], body: res.location ? '' : json({ error: res.error, error_description: res.error_description, consent_page_shown_to_user: res.consent_page_shown_to_user }) },
    };
  },
  'ssrf-fetch'(e) {
    const r = e.response;
    if (r.refused) return { none: `No network call leaves the client: it refused before connecting (${r.refused}: ${r.reason}${r.address ? ` ${r.address}` : ''}).` };
    return {
      req: { start: `GET ${e.request.url} HTTP/1.1`, headers: [['Accept', 'application/json']] },
      res: { status: stat(r.status), headers: [['Content-Type', 'application/json'], ...(r.www_authenticate ? [['WWW-Authenticate', r.www_authenticate]] : [])], body: r.body ? json(r.body) : '' },
      hops: r.hops,
    };
  },
};

/** Everything the panel shows for one trace entry. */
export function wireFor(attack, entry) {
  const step = attack.steps.find((s) => s.id === entry.step);
  const b = BUILD[step?.kind]?.(entry) ?? { none: 'No network call is recorded for this step.' };
  const key = KEY[attack.id] || {};
  const token = b.token ?? entry.request?.token ?? entry.response?.token ?? null;
  let notice;
  if (b.setup) notice = 'This step is setup: it only shows where the token the attacker uses comes from. Read its claims; the next step shows what the gateway does with them.';
  else if (entry.verdict === 'refused') notice = `${key.why || ''} Here the control said no: ${entry.response.error_description || entry.response.reason || entry.response.error || 'refused'}`;
  else if (entry.verdict === 'ok') notice = `${key.why || ''} Here nothing stopped it.`;
  else notice = key.why || '';
  return { ...b, key, token, title: entry.label, notice: notice.trim(), outcome: entry.verdict, step };
}
