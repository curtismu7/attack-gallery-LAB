// What each control does NOT stop. Written about the mock's own logic; no product behaviour is claimed.
export const GENERAL_LIMITS = [
  'These are mocks of control logic running in one process. They are not a test of any vendor product, gateway or authorization server, and a pass here says nothing about one.',
  'Every party (good authorization server, evil one, gateway, backend, proxy, fake network) is a handler inside this app. There is no real TLS, DNS, clock skew, load balancer, redirect handling by a real browser, or timing.',
  'Tokens are fake JWTs signed with keys generated at startup. They show the shape of a claim set, not the behaviour of a real issuer.',
  'Each attack is run against one missing control at a time. Real deployments have several flaws at once, and attackers chain them.',
  'The ten attacks are a teaching set, not a threat model. Passing all ten does not make a system safe.',
  'Single wrong tokens (expired, bad signature, malformed) belong to a different tool, as do stolen-token replay (bearer versus DPoP) and hostile servers; this gallery does not cover them.',
];
export const NOT_STOPPED = {
  scope_check: ['An attacker who legitimately holds a token with the write scope: scope says what a token may do, not who holds it.', 'Scopes that were granted too broadly in the first place.'],
  ownership_check: ['A stolen token for the victim: the subject then really owns the object.', 'Objects the user may reach but should not, if the ownership rule itself is wrong.'],
  client_allowlist: ['A registered client that is compromised or misused: it is on the list.', 'Anything about the user: this checks the client, not the person.'],
  act_validation: ['An allowed actor that misbehaves.', 'How the act claim got into the token: it trusts the issuer that signed it.'],
  require_delegation: ['Whether the named agent is trustworthy: it only requires that some actor is named.', 'Tools not marked as agent-mediated.'],
  audience_binding: ['A token genuinely issued for the gateway, stolen and replayed there.', 'A resource whose audience value is reused for several services.'],
  no_token_forwarding: ['Misuse of the exchanged token inside its own short life and audience.', 'The checks on the exchange endpoint itself, which this mock does not model in depth.'],
  iss_check: ['A user who knowingly signs in at a hostile server.', 'A client that has no trusted expected issuer to compare with.'],
  consent_check: ['A user who approves a look-alike client on the consent page.', 'Flaws in the third-party authorization server itself.'],
  ssrf_guard: ['Anything the mock classifier does not model; it is tested on the fake network table only.', 'A hostile server that returns bad data from a public address.'],
};
