# Attack catalog

Generated from `server/src/catalog.js` by `node scripts/build-docs.mjs`. Do not edit by hand; the same data is served at `GET /api/catalog`.

| Attack | Pack | Stopped by | Governed error | Ungoverned result | Governed result |
| --- | --- | --- | --- | --- | --- |
| `wrong-scope` (Wrong scope) | 1 | `scope_check` | `insufficient_scope` (403) | The transfer runs: the gateway never compares scope with the tool. | 403 insufficient_scope, named control: scope check. |
| `other-account` (Another user's account) | 1 | `ownership_check` | `forbidden_object` (403) | Mary's balance comes back. | 403 forbidden_object, named control: per-user ownership check. |
| `bad-client` (Bad client) | 1 | `client_allowlist` | `unauthorized_client` (403) | The attacker app reads Mark's accounts. | 403 unauthorized_client, named control: client allowlist. |
| `rogue-actor` (Rogue actor in the act claim) | 1 | `act_validation` | `unauthorized_actor` (403) | The transfer runs and the audit record names agent-ok, the trusted agent. | 403 unauthorized_actor on the signed act claim; the header is ignored. |
| `impersonation` (Impersonation) | 1 | `require_delegation` | `delegation_required` (403) | The transfer runs; the audit record shows no actor at all. | 403 delegation_required, named control: delegation required. |
| `raw-forwarding` (Raw token forwarding) | 1 | `no_token_forwarding` | `token_forwarding_blocked` (200) | The backend holds a replayable copy of Mark's token and reads his accounts. | The gateway exchanged the token; the backend holds a different, short-lived one. Named control: no raw token forwarding. |
| `issuer-mixup` (Issuer mix-up (RFC 9207)) | 2 | `iss_check` | `iss_mismatch` (400) | The evil AS ends up with a working token for Mark. | The client compares iss with the issuer it expected, rejects the response and never sends the code. Named control: iss check. |
| `audience-confusion` (Token passthrough and audience confusion (RFC 8707)) | 2 | `audience_binding` | `invalid_token` (401) | Signature and issuer are fine, so the gateway accepts it and lists Mark's accounts. | 401 invalid_token: aud does not include the gateway. Named control: audience binding. |
| `confused-deputy-dcr` (Confused deputy via static client ID and DCR) | 2 | `consent_check` | `consent_required` (200) | The third-party AS skips consent (cookie) and the code is redirected to attacker.example. | Stopped at the proxy's own consent page for this client_id. Named control: per-client consent. |
| `ssrf-metadata` (SSRF via metadata) | 2 | `ssrf_guard` | `ssrf_blocked` (400) | Fake cloud, loopback and private-range services answer; their data is the attacker's gain. | Each non-public target is refused before any connection. Named control: SSRF guard. |

## Wrong scope (`wrong-scope`)

Pack 1. Named control: `scope_check`.

**Goal.** Make a transfer with a token that only carries accounts:read.

**Story.** An agent holds a read-only token for Mark and calls the write tool anyway.

**OWASP ASI (lab reading).** ASI02 (related), ASI03 (primary)

**Steps.**

1. Mark authorises the app with read-only scope
2. Call transfer_funds (needs accounts:write)

**References.**

- [MCP Authorization, Runtime Insufficient Scope Errors](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Servers SHOULD answer insufficient scope with HTTP 403 and WWW-Authenticate error="insufficient_scope" with the needed scope.
- [MCP Security Best Practices, Scope Minimization](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices): Progressive least-privilege scopes; elevation via targeted WWW-Authenticate scope challenges.

## Another user's account (`other-account`)

Pack 1. Named control: `ownership_check`.

**Goal.** Read Mary's account with Mark's valid token.

**Story.** Valid token, valid scope, someone else's object id (object-level access).

**OWASP ASI (lab reading).** ASI03 (primary)

**Steps.**

1. Mark has a normal read token
2. Ask for acc-2001 (Mary's)

**References.**

- OWASP API Security, Broken Object Level Authorization: **UNVERIFIED** (Not fetched in this session.)
- [MCP Authorization, Access Token Privilege Restriction](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Servers MUST only accept tokens intended for them, ensure no data is returned to unauthorized parties, and MUST NOT pass through the token received from the client to upstream APIs.

## Bad client (`bad-client`)

Pack 1. Named control: `client_allowlist`.

**Goal.** Use Mark's token through an app the operator never registered.

**Story.** Mark is phished into authorising an attacker app. The token is genuine; the client is not on the list.

**OWASP ASI (lab reading).** ASI03 (primary)

**Steps.**

1. Mark authorises client-attacker
2. The attacker app lists Mark's accounts

**References.**

- [MCP Authorization, Client Registration Approaches](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Pre-registration, Client ID Metadata Documents and Dynamic Client Registration are the registration approaches (adjacent to a client allowlist, which the page does not name).
- [MCP Authorization, Trust Policies (Client ID Metadata Document Security)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Authorization servers MAY use domain allowlists for trusted clients.

## Rogue actor in the act claim (`rogue-actor`)

Pack 1. Named control: `act_validation`.

**Goal.** Move money as the trusted agent while a rogue agent holds the token (actor injection / confused deputy).

**Story.** The token's signed act names agent-rogue. The caller also sends X-Actor-Client: agent-ok to be recorded as the trusted agent. See AI-DEMO2 docs/use-cases/confused-deputy-actor-injection.md.

**OWASP ASI (lab reading).** ASI03 (primary), ASI10 (related)

**Steps.**

1. agent-rogue performs a real exchange: act.sub = agent-rogue
2. transfer_funds with a forged X-Actor-Client header

**References.**

- [RFC 8693 section 4.1](https://www.rfc-editor.org/rfc/rfc8693.html): The outermost act claim identifies the current actor; actors in nested act claims are informational only.

## Impersonation (`impersonation`)

Pack 1. Named control: `require_delegation`.

**Goal.** Call an agent-only tool with a bare user token so the agent leaves no trace.

**Story.** Mark's user token has no act claim. The call looks like Mark himself.

**OWASP ASI (lab reading).** ASI03 (primary)

**Steps.**

1. A user token for Mark, no act claim
2. transfer_funds without any agent identity

**References.**

- RFC 8693 impersonation versus delegation semantics: **UNVERIFIED** (Only section 4.1 (act) was read; the impersonation text was not.)

## Raw token forwarding (`raw-forwarding`)

Pack 1. Named control: `no_token_forwarding`.

**Goal.** Capture Mark's live token from a downstream service's logs and replay it.

**Story.** The gateway passes the inbound bearer token to a third-party billing backend. Anything that backend logs is now a working credential.

**OWASP ASI (lab reading).** ASI03 (primary)

**Steps.**

1. Mark's token for the gateway
2. sync_statement makes the gateway call the billing backend
3. The backend operator replays what its log captured

**References.**

- [MCP Authorization, Access Token Privilege Restriction](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Servers MUST only accept tokens intended for them, ensure no data is returned to unauthorized parties, and MUST NOT pass through the token received from the client to upstream APIs.
- [MCP Security Best Practices, Token Passthrough](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices): MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server.

## Issuer mix-up (RFC 9207) (`issuer-mixup`)

Pack 2. Named control: `iss_check`.

**Goal.** Get Mark's authorization code and PKCE verifier delivered to an evil authorization server.

**Story.** The client starts with the evil AS. The evil AS bounces the user to the good AS, which issues a code. The response carries iss = the good AS, but the client believes it is talking to the evil one.

**OWASP ASI (lab reading).** ASI03 (primary), ASI04 (related)

**Steps.**

1. Client fetches evil AS metadata and starts authorization
2. Evil AS redirects the signed-in user to the good AS; good AS answers the client
3. Client handles the authorization response
4. Evil AS redeems the code it received at the good AS
5. Attacker lists Mark's accounts with the redeemed token

**References.**

- [RFC 9207 sections 1 and 2.4](https://www.rfc-editor.org/rfc/rfc9207.html): Clients MUST compare the iss parameter with the issuer of the server the request was sent to (simple string comparison) and reject the response on mismatch.

## Token passthrough and audience confusion (RFC 8707) (`audience-confusion`)

Pack 2. Named control: `audience_binding`.

**Goal.** Use a token issued for a different resource at the gateway.

**Story.** Mark's token was issued for the billing API (aud = billing). The attacker presents it at the MCP gateway.

**OWASP ASI (lab reading).** ASI03 (primary)

**Steps.**

1. A genuine token for Mark, audience = billing API
2. Present the billing-audience token at the gateway

**References.**

- [RFC 8707 section 2](https://www.rfc-editor.org/rfc/rfc8707.html): The authorization server SHOULD restrict issued tokens to the named resources, typically via the aud claim.
- [MCP Authorization, Token Handling](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Servers MUST validate that access tokens were issued specifically for them as the audience; invalid tokens get HTTP 401.
- [RFC 9728 section 7.4](https://www.rfc-editor.org/rfc/rfc9728.html): Clients working with several resource servers SHOULD request audience-restricted tokens via Resource Indicators.

## Confused deputy via static client ID and DCR (`confused-deputy-dcr`)

Pack 2. Named control: `consent_check`.

**Goal.** Have Mark's MCP authorization code delivered to an attacker's redirect URI without his approval.

**Story.** An MCP proxy uses one static client ID at a third-party AS. Mark consented once, so the third-party AS sets a consent cookie. The attacker registers a client by DCR with their own redirect URI and sends Mark a link.

**OWASP ASI (lab reading).** ASI03 (primary)

**Steps.**

1. Mark signs in through the legitimate client (consent approved, cookie set)
2. Attacker registers a client by DCR with redirect_uri = attacker.example
3. Mark's browser opens the attacker's authorization link

**References.**

- [MCP Security Best Practices, Confused Deputy Problem](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices): Proxy servers using a static client ID MUST implement per-client consent and check it before the third-party authorization flow.

## SSRF via metadata (`ssrf-metadata`)

Pack 2. Named control: `ssrf_guard`.

**Goal.** Make the client fetch internal addresses named by a hostile MCP server.

**Story.** A hostile MCP server answers 401 with a resource_metadata URL that points at the link-local metadata address, lists a name that resolves to loopback as its authorization server, and redirects to a private address. All of it runs on a fake network.

**OWASP ASI (lab reading).** ASI02 (primary), ASI04 (related)

**Steps.**

1. Probe the hostile MCP server (401 with resource_metadata)
2. Follow resource_metadata (link-local address)
3. Fetch AS metadata from a name that resolves to loopback
4. Fetch metadata that redirects to a private address

**References.**

- [MCP Security Best Practices, SSRF](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices): Clients SHOULD enforce HTTPS, block private and reserved ranges, validate redirect targets and consider pinning DNS results (TOCTOU).
- [RFC 9728 section 7.7](https://www.rfc-editor.org/rfc/rfc9728.html): Clients fetching authorization server metadata from a resource server SHOULD take SSRF precautions, for example blocking internal IP ranges.
