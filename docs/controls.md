# Controls

Generated from `server/src/policy.js` and `web/src/data/limits.js` by `node scripts/build-docs.mjs`. Do not edit by hand.

Each control is a flag in the policy. "Governed" has every flag on; "ungoverned" has every flag off. The tests turn on all but one and show that exactly that control's attack succeeds. The controls are mocks of logic. No product claim is made except where a seed file is cited.

| Control | Error | Stops | What it does |
| --- | --- | --- | --- |
| `scope_check` (Scope check) | `insufficient_scope` (403) | `wrong-scope` | Compares the scope on the token with the scope the tool requires. |
| `ownership_check` (Per-user ownership check) | `forbidden_object` (403) | `other-account` | Compares the owner of the requested object with the sub claim of the token. |
| `client_allowlist` (Client allowlist) | `unauthorized_client` (403) | `bad-client` | Accepts tokens only for clients the gateway operator registered. |
| `act_validation` (Actor (act claim) validation) | `unauthorized_actor` (403) | `rogue-actor` | Checks act.sub against the allowed actors and ignores any actor the caller supplies outside the signed token. |
| `require_delegation` (Delegation required (impersonation block)) | `delegation_required` (403) | `impersonation` | Rejects tokens with no act claim on agent-mediated tools. |
| `audience_binding` (Audience binding (RFC 8707)) | `invalid_token` (401) | `audience-confusion` | Requires the gateway URI in the aud claim. |
| `no_token_forwarding` (No raw token forwarding (exchange instead)) | `token_forwarding_blocked` (200) | `raw-forwarding` | Obtains a new upstream token via token exchange instead of forwarding the inbound bearer token. |
| `iss_check` (Issuer check on the authorization response (RFC 9207)) | `iss_mismatch` (400) | `issuer-mixup` | Compares the iss response parameter with the expected issuer by simple string comparison. |
| `consent_check` (Per-client consent (static client + DCR)) | `consent_required` (200) | `confused-deputy-dcr` | Keeps a per-user registry of approved client_id values and checks it before forwarding to the third-party authorization server. |
| `ssrf_guard` (SSRF guard on metadata fetches) | `ssrf_blocked` (400) | `ssrf-metadata` | HTTPS only, public unicast addresses only, validated address pinned for the connection, every redirect hop re-validated. |

## Scope check (`scope_check`)

The token does not carry the scope this tool needs. Request a token with the scope, do not widen the tool.

Product evidence: none; described as "a gateway control of this kind".

**References.**

- [MCP Authorization, Runtime Insufficient Scope Errors](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Servers SHOULD answer insufficient scope with HTTP 403 and WWW-Authenticate error="insufficient_scope" with the needed scope.
- [MCP Security Best Practices, Scope Minimization](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices): Progressive least-privilege scopes; elevation via targeted WWW-Authenticate scope challenges.

**What it does not stop.**

- An attacker who legitimately holds a token with the write scope: scope says what a token may do, not who holds it.
- Scopes that were granted too broadly in the first place.

## Per-user ownership check (`ownership_check`)

The object belongs to a different user than the token subject. A valid token and a valid scope are not permission to read any account.

Product evidence: none; described as "a gateway control of this kind".

**References.**

- OWASP API Security, Broken Object Level Authorization: **UNVERIFIED** (Not fetched in this session.)
- [MCP Authorization, Access Token Privilege Restriction](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Servers MUST only accept tokens intended for them, ensure no data is returned to unauthorized parties, and MUST NOT pass through the token received from the client to upstream APIs.

**What it does not stop.**

- A stolen token for the victim: the subject then really owns the object.
- Objects the user may reach but should not, if the ownership rule itself is wrong.

## Client allowlist (`client_allowlist`)

The client (azp) on the token is not a registered client for this gateway.

Product evidence: none; described as "a gateway control of this kind".

**References.**

- [MCP Authorization, Client Registration Approaches](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Pre-registration, Client ID Metadata Documents and Dynamic Client Registration are the registration approaches (adjacent to a client allowlist, which the page does not name).
- [MCP Authorization, Trust Policies (Client ID Metadata Document Security)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Authorization servers MAY use domain allowlists for trusted clients.

**What it does not stop.**

- A registered client that is compromised or misused: it is on the list.
- Anything about the user: this checks the client, not the person.

## Actor (act claim) validation (`act_validation`)

The actor in the token act claim is not an allowed actor. The actor is read from the signed token only; a caller-supplied header can never name or replace it.

Product evidence: seed file in the AI-DEMO2 repo, AI-DEMO2 demo_mcp_gateway/src/auth/GatewayTokenPolicy.ts (actor allow-list, error code unauthorized_actor); docs/use-cases/confused-deputy-actor-injection.md

**References.**

- [RFC 8693 section 4.1](https://www.rfc-editor.org/rfc/rfc8693.html): The outermost act claim identifies the current actor; actors in nested act claims are informational only.

**What it does not stop.**

- An allowed actor that misbehaves.
- How the act claim got into the token: it trusts the issuer that signed it.

## Delegation required (impersonation block) (`require_delegation`)

This tool must be called by an agent acting for a user (act claim present). A plain user token would erase the agent from the record.

Product evidence: seed file in the AI-DEMO2 repo, AI-DEMO2 demo_mcp_gateway/src/auth/GatewayTokenPolicy.ts (UC16 impersonation block, error code missing_act)

**References.**

- RFC 8693 impersonation versus delegation semantics: **UNVERIFIED** (Only section 4.1 (act) was read; the impersonation text was not.)

**What it does not stop.**

- Whether the named agent is trustworthy: it only requires that some actor is named.
- Tools not marked as agent-mediated.

## Audience binding (RFC 8707) (`audience_binding`)

The token was issued for a different resource (aud does not include this gateway). Tokens are only good at the resource they were issued for.

Product evidence: none; described as "a gateway control of this kind".

**References.**

- [RFC 8707 section 2](https://www.rfc-editor.org/rfc/rfc8707.html): The authorization server SHOULD restrict issued tokens to the named resources, typically via the aud claim.
- [MCP Authorization, Token Handling](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Servers MUST validate that access tokens were issued specifically for them as the audience; invalid tokens get HTTP 401.
- [RFC 9728 section 7.4](https://www.rfc-editor.org/rfc/rfc9728.html): Clients working with several resource servers SHOULD request audience-restricted tokens via Resource Indicators.

**What it does not stop.**

- A token genuinely issued for the gateway, stolen and replayed there.
- A resource whose audience value is reused for several services.

## No raw token forwarding (exchange instead) (`no_token_forwarding`)

The gateway did not pass the caller token upstream. It exchanged it for a separate, short-lived token with its own audience.

Product evidence: none; described as "a gateway control of this kind".

**References.**

- [MCP Authorization, Access Token Privilege Restriction](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): Servers MUST only accept tokens intended for them, ensure no data is returned to unauthorized parties, and MUST NOT pass through the token received from the client to upstream APIs.
- [MCP Security Best Practices, Token Passthrough](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices): MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server.

**What it does not stop.**

- Misuse of the exchanged token inside its own short life and audience.
- The checks on the exchange endpoint itself, which this mock does not model in depth.

## Issuer check on the authorization response (RFC 9207) (`iss_check`)

The iss in the authorization response is not the issuer of the server the client sent the request to. The client stops and keeps the code.

Product evidence: none; described as "a gateway control of this kind".

**References.**

- [RFC 9207 sections 1 and 2.4](https://www.rfc-editor.org/rfc/rfc9207.html): Clients MUST compare the iss parameter with the issuer of the server the request was sent to (simple string comparison) and reject the response on mismatch.

**What it does not stop.**

- A user who knowingly signs in at a hostile server.
- A client that has no trusted expected issuer to compare with.

## Per-client consent (static client + DCR) (`consent_check`)

This client_id has no recorded consent from this user. The proxy shows its own consent page (client name, scopes, redirect URI) before any third-party hop.

Product evidence: none; described as "a gateway control of this kind".

**References.**

- [MCP Security Best Practices, Confused Deputy Problem](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices): Proxy servers using a static client ID MUST implement per-client consent and check it before the third-party authorization flow.

**What it does not stop.**

- A user who approves a look-alike client on the consent page.
- Flaws in the third-party authorization server itself.

## SSRF guard on metadata fetches (`ssrf_guard`)

The metadata URL points at a non-public target (loopback, link-local, private range) or reaches one through DNS or a redirect. The client refuses to fetch it.

Product evidence: none; described as "a gateway control of this kind".

**References.**

- [MCP Security Best Practices, SSRF](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices): Clients SHOULD enforce HTTPS, block private and reserved ranges, validate redirect targets and consider pinning DNS results (TOCTOU).
- [RFC 9728 section 7.7](https://www.rfc-editor.org/rfc/rfc9728.html): Clients fetching authorization server metadata from a resource server SHOULD take SSRF precautions, for example blocking internal IP ranges.

**What it does not stop.**

- Anything the mock classifier does not model; it is tested on the fake network table only.
- A hostile server that returns bad data from a public address.

## Limits that apply to every control

- These are mocks of control logic running in one process. They are not a test of any vendor product, gateway or authorization server, and a pass here says nothing about one.
- Every party (good authorization server, evil one, gateway, backend, proxy, fake network) is a handler inside this app. There is no real TLS, DNS, clock skew, load balancer, redirect handling by a real browser, or timing.
- Tokens are fake JWTs signed with keys generated at startup. They show the shape of a claim set, not the behaviour of a real issuer.
- Each attack is run against one missing control at a time. Real deployments have several flaws at once, and attackers chain them.
- The ten attacks are a teaching set, not a threat model. Passing all ten does not make a system safe.
- Single wrong tokens (expired, bad signature, malformed) belong to a different tool, as do stolen-token replay (bearer versus DPoP) and hostile servers; this gallery does not cover them.
