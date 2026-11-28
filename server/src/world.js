// Fixed cast of the mock world: AirGuard Airlines, a fictional airline; the accounts are SkyMiles loyalty accounts (balances in miles). Every hostname is .example or .invalid (RFC 2606 names that never resolve).
export const URLS = {
  gateway: 'https://gw.gallery.example/mcp',
  goodAs: 'https://as.gallery.example',
  evilAs: 'https://evil-as.invalid',
  billing: 'https://billing.gallery.example/api',
  legitCallback: 'https://app.gallery.example/callback',
  attackerCallback: 'https://attacker.example/cb',
};
export const USERS = { emma: { sub: 'user-emma', name: 'Emma' }, noah: { sub: 'user-noah', name: 'Noah' } };
// legit = the registered client; attacker = an unregistered client; agent = the allowed actor; rogue = an actor nobody authorised
export const CLIENTS = { legit: 'client-legit', attacker: 'client-attacker', agent: 'agent-ok', rogue: 'agent-rogue', gateway: 'gateway-exchanger' };
export const ALLOWED_CLIENTS = [CLIENTS.legit];
export const ALLOWED_ACTORS = [CLIENTS.agent];

export function freshAccounts() {
  return {
    'acc-1001': { id: 'acc-1001', owner: USERS.emma.sub, label: 'Emma SkyMiles', balance: 52000 },
    'acc-1002': { id: 'acc-1002', owner: USERS.emma.sub, label: 'Emma bonus miles', balance: 12000 },
    'acc-2001': { id: 'acc-2001', owner: USERS.noah.sub, label: 'Noah SkyMiles', balance: 18450 },
    'acc-9000': { id: 'acc-9000', owner: 'external', label: 'Partner member (external)', balance: 0 },
  };
}
export const TOOLS = {
  list_accounts: { scope: 'accounts:read', agentMediated: false },
  get_account: { scope: 'accounts:read', agentMediated: false, objectArg: 'accountId' },
  sync_statement: { scope: 'accounts:read', agentMediated: false, objectArg: 'accountId', callsUpstream: true },
  transfer_miles: { scope: 'accounts:write', agentMediated: true, objectArg: 'fromAccountId' },
};
