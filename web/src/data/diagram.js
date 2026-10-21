// The diagram data: nodes (parties), control points, and per-attack hops. The Simulate steps follow the selected attack.
export const NODES = [
  { id: 'evilAs', title: 'Evil AS', sub: 'mock, hostile', kind: 'bad', x: 0, y: 0 },
  { id: 'goodAs', title: 'Good AS', sub: 'mock issuer', kind: 'good', x: 440, y: 0 },
  { id: 'proxy', title: 'MCP proxy', sub: 'static client id + DCR (mock)', kind: 'good', x: 880, y: 0 },
  { id: 'client', title: 'Client', sub: 'agent app / Mark\'s browser', kind: 'good', x: 0, y: 230 },
  { id: 'gateway', title: 'Gateway + resource server', sub: 'mock MCP gateway', kind: 'good', x: 440, y: 230 },
  { id: 'backend', title: 'Billing backend', sub: 'mock upstream', kind: 'good', x: 880, y: 230 },
  { id: 'attacker', title: 'Attacker', sub: 'holds a token or a client', kind: 'bad', x: 0, y: 460 },
  { id: 'hostile', title: 'Hostile MCP server', sub: 'mock, answers 401 + metadata URL', kind: 'bad', x: 440, y: 460 },
  { id: 'fakenet', title: 'Fake internal network', sub: 'a table; no real DNS or sockets', kind: 'bad', x: 880, y: 460 },
];
// where each control sits on the map
export const CONTROL_HOST = { scope_check: 'gateway', ownership_check: 'gateway', client_allowlist: 'gateway', act_validation: 'gateway', require_delegation: 'gateway', audience_binding: 'gateway', no_token_forwarding: 'gateway', iss_check: 'client', consent_check: 'proxy', ssrf_guard: 'client' };
// hops: from, to, label, ctrl (the control point checked on this hop, if any)
const H = (from, to, label, ctrl) => ({ from, to, label, ctrl });
export const HOPS = {
  'wrong-scope': [H('client', 'gateway', 'call transfer_funds with an accounts:read token', 'scope_check'), H('gateway', 'client', 'transfer executed')],
  'other-account': [H('client', 'gateway', "get_account acc-2001 (Mary's) with Mark's token", 'ownership_check'), H('gateway', 'client', "Mary's balance returned")],
  'bad-client': [H('attacker', 'gateway', "list_accounts with Mark's token (azp = client-attacker)", 'client_allowlist'), H('gateway', 'attacker', "Mark's accounts returned")],
  'rogue-actor': [H('client', 'gateway', 'transfer_funds, act = agent-rogue, forged X-Actor-Client header', 'act_validation'), H('gateway', 'client', 'executed; audit names agent-ok')],
  impersonation: [H('client', 'gateway', 'transfer_funds with a user token, no act claim', 'require_delegation'), H('gateway', 'client', 'executed; no actor in the audit record')],
  'raw-forwarding': [H('client', 'gateway', "sync_statement with Mark's token"), H('gateway', 'backend', 'forwards the inbound token upstream', 'no_token_forwarding'), H('backend', 'attacker', "operator's log hands over the token"), H('attacker', 'gateway', 'replay: list_accounts'), H('gateway', 'attacker', "Mark's accounts returned")],
  'issuer-mixup': [H('client', 'evilAs', 'start authorization; expects iss = evil AS'), H('evilAs', 'goodAs', "bounce Mark to the good AS"), H('goodAs', 'client', 'code + iss = good AS', 'iss_check'), H('client', 'evilAs', 'code + PKCE verifier sent to the evil AS'), H('evilAs', 'goodAs', 'redeem the code'), H('evilAs', 'gateway', "list_accounts with Mark's token")],
  'audience-confusion': [H('goodAs', 'attacker', 'token issued for the billing API (aud = billing)'), H('attacker', 'gateway', 'present it at the gateway', 'audience_binding'), H('gateway', 'attacker', "Mark's accounts returned")],
  'confused-deputy-dcr': [H('client', 'proxy', 'Mark approves client-legit (cookie set)'), H('attacker', 'proxy', 'DCR: redirect_uri = attacker.example'), H('client', 'proxy', "Mark's browser opens the attacker's link", 'consent_check'), H('proxy', 'attacker', 'authorization code delivered to attacker.example')],
  'ssrf-metadata': [H('client', 'hostile', 'probe the MCP server: 401 + resource_metadata URL'), H('client', 'fakenet', 'fetch the link-local metadata address', 'ssrf_guard'), H('client', 'fakenet', 'name that resolves to loopback; redirect to a private range'), H('fakenet', 'client', 'internal data returned')],
};
/** How many hops run: all of them, unless a control refused or neutralised the attack at its hop. */
export function hopsToRun(attackId, run, controlId) {
  const hops = HOPS[attackId] || [];
  if (!run || run.succeeded) return hops.length;
  const i = hops.findIndex((h) => h.ctrl === controlId);
  return i < 0 ? hops.length : i + 1;
}
