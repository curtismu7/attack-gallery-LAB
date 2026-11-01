# Talk track

Generated from `server/src/asi.js`, `server/src/catalog.js` and `web/src/data/stories` by `node scripts/build-docs.mjs`. Do not edit by hand. A test fails if this file is stale.

## Start with the label

Say what the banner says: **Ping release claim, UNVERIFIED on our tenant.** The OWASP table is Ping's deck, slide 55, for a release dated 2026-11-02. The attacks, the mock controls and the refusals are this gallery's own and run offline; they are not a test of any Ping product.

## The OWASP Agentic Top 10, as qualified

Open the OWASP ASI tab. Each category shows what the deck says addresses it. The deck states its own gaps and the table repeats them rather than rounding up: fingerprint pinning for the supply chain (ASI04) is pending, memory-write inspection (ASI06) is shipped but the gateway integration is in progress, and ASI08, ASI09 and ASI10 carry notes. Do not present those rows as full coverage.

Which attack touches which row is our reading, not the deck's. 6 of 10 rows have no gallery attack (ASI01, ASI05, ASI06, ASI07, ASI08, ASI09): say so rather than stretching an attack over them.

## Walk the attacks

### Wrong scope

Maps to ASI02 Tool Misuse & Exploitation (related) and ASI03 Identity & Privilege Abuse (primary): lab reading. The deck says (deck claim, unverified on our tenant) ASI02: AIGuard: path traversal, destructive commands, SSRF and over-broad scope detection. ASI03: Gateway + AIGuard: per-user virtual keys, least-privilege scopes, per-application RBAC, live revocation.

Run it both ways. Ungoverned: The transfer runs: the gateway never compares scope with the tool. Governed: 403 insufficient_scope, named control: scope check. The control is this gallery's mock "Scope check" (`scope_check`), a control of that kind, not a Privilege feature.

### Another user's account

Maps to ASI03 Identity & Privilege Abuse (primary): lab reading. The deck says (deck claim, unverified on our tenant) ASI03: Gateway + AIGuard: per-user virtual keys, least-privilege scopes, per-application RBAC, live revocation.

Run it both ways. Ungoverned: Mary's balance comes back. Governed: 403 forbidden_object, named control: per-user ownership check. The control is this gallery's mock "Per-user ownership check" (`ownership_check`), a control of that kind, not a Privilege feature.

### Bad client

Maps to ASI03 Identity & Privilege Abuse (primary): lab reading. The deck says (deck claim, unverified on our tenant) ASI03: Gateway + AIGuard: per-user virtual keys, least-privilege scopes, per-application RBAC, live revocation.

Run it both ways. Ungoverned: The attacker app reads Mark's accounts. Governed: 403 unauthorized_client, named control: client allowlist. The control is this gallery's mock "Client allowlist" (`client_allowlist`), a control of that kind, not a Privilege feature.

### Rogue actor in the act claim

Maps to ASI03 Identity & Privilege Abuse (primary) and ASI10 Rogue Agents (related): lab reading. The deck says (deck claim, unverified on our tenant) ASI03: Gateway + AIGuard: per-user virtual keys, least-privilege scopes, per-application RBAC, live revocation. ASI10: Gateway: no agent reaches a model, tool or peer without a valid scoped key; instant revocation; bounded spend. The deck adds: in-gateway rogue-agent access scoring supplements it.

Run it both ways. Ungoverned: The transfer runs and the audit record names agent-ok, the trusted agent. Governed: 403 unauthorized_actor on the signed act claim; the header is ignored. The control is this gallery's mock "Actor (act claim) validation" (`act_validation`), a control of that kind, not a Privilege feature.

### Impersonation

Maps to ASI03 Identity & Privilege Abuse (primary): lab reading. The deck says (deck claim, unverified on our tenant) ASI03: Gateway + AIGuard: per-user virtual keys, least-privilege scopes, per-application RBAC, live revocation.

Run it both ways. Ungoverned: The transfer runs; the audit record shows no actor at all. Governed: 403 delegation_required, named control: delegation required. The control is this gallery's mock "Delegation required (impersonation block)" (`require_delegation`), a control of that kind, not a Privilege feature.

### Raw token forwarding

Maps to ASI03 Identity & Privilege Abuse (primary): lab reading. The deck says (deck claim, unverified on our tenant) ASI03: Gateway + AIGuard: per-user virtual keys, least-privilege scopes, per-application RBAC, live revocation.

Run it both ways. Ungoverned: The backend holds a replayable copy of Mark's token and reads his accounts. Governed: The gateway exchanged the token; the backend holds a different, short-lived one. Named control: no raw token forwarding. The control is this gallery's mock "No raw token forwarding (exchange instead)" (`no_token_forwarding`), a control of that kind, not a Privilege feature.

### Issuer mix-up (RFC 9207)

Maps to ASI03 Identity & Privilege Abuse (primary) and ASI04 Agentic Supply Chain (related): lab reading. The deck says (deck claim, unverified on our tenant) ASI03: Gateway + AIGuard: per-user virtual keys, least-privilege scopes, per-application RBAC, live revocation. ASI04: AIGuard: description-injection and typosquatting detection on tool definitions; fingerprint pinning pending. Fingerprint pinning is PENDING in the deck.

Run it both ways. Ungoverned: The evil AS ends up with a working token for Mark. Governed: The client compares iss with the issuer it expected, rejects the response and never sends the code. Named control: iss check. The control is this gallery's mock "Issuer check on the authorization response (RFC 9207)" (`iss_check`), a control of that kind, not a Privilege feature.

### Token passthrough and audience confusion (RFC 8707)

Maps to ASI03 Identity & Privilege Abuse (primary): lab reading. The deck says (deck claim, unverified on our tenant) ASI03: Gateway + AIGuard: per-user virtual keys, least-privilege scopes, per-application RBAC, live revocation.

Run it both ways. Ungoverned: Signature and issuer are fine, so the gateway accepts it and lists Mark's accounts. Governed: 401 invalid_token: aud does not include the gateway. Named control: audience binding. The control is this gallery's mock "Audience binding (RFC 8707)" (`audience_binding`), a control of that kind, not a Privilege feature.

### Confused deputy via static client ID and DCR

Maps to ASI03 Identity & Privilege Abuse (primary): lab reading. The deck says (deck claim, unverified on our tenant) ASI03: Gateway + AIGuard: per-user virtual keys, least-privilege scopes, per-application RBAC, live revocation.

Run it both ways. Ungoverned: The third-party AS skips consent (cookie) and the code is redirected to attacker.example. Governed: Stopped at the proxy's own consent page for this client_id. Named control: per-client consent. The control is this gallery's mock "Per-client consent (static client + DCR)" (`consent_check`), a control of that kind, not a Privilege feature.

### SSRF via metadata

Maps to ASI02 Tool Misuse & Exploitation (primary) and ASI04 Agentic Supply Chain (related): lab reading. The deck says (deck claim, unverified on our tenant) ASI02: AIGuard: path traversal, destructive commands, SSRF and over-broad scope detection. ASI04: AIGuard: description-injection and typosquatting detection on tool definitions; fingerprint pinning pending. Fingerprint pinning is PENDING in the deck.

Run it both ways. Ungoverned: Fake cloud, loopback and private-range services answer; their data is the attacker's gain. Governed: Each non-public target is refused before any connection. Named control: SSRF guard. The control is this gallery's mock "SSRF guard on metadata fetches" (`ssrf_guard`), a control of that kind, not a Privilege feature.

## The rows with no attack

- **ASI01 Agent Goal Hijack.** No gallery attack maps here. The gallery attacks the token and authorization layer, not prompt content. Content inspection is not built.
- **ASI05 Unexpected Code Execution.** No gallery attack maps here. There is no code-execution attack in this set.
- **ASI06 Memory & Context Poisoning.** No gallery attack maps here. There is no memory or context attack in this set.
- **ASI07 Insecure Inter-Agent Comm.** No gallery attack maps here. There is no agent-to-agent attack in this set, and the A2A chokepoint and its scope are not built.
- **ASI08 Cascading Agent Failures.** No gallery attack maps here. Rate and budget ceilings, the circuit breaker and the SIEM stream are not built.
- **ASI09 Human-Agent Trust Exploit.** No gallery attack maps here. Content rules are not built.

## Why it matters: OWASP Agentic AI Top 10 (Ping claim, slide 55)

Challenge: Security review now demands precise answers against the OWASP ASI taxonomy, and vague coverage claims stall approval and procurement. Technical: Each ASI category maps to a named control and mechanism, with the ASI08, ASI09 and ASI10 coverage notes stated plainly. Business: Framework-mapped answers accelerate security approval and de-risk the purchase. Ping claims, unverified on our tenant.

## What is not proven

Nothing in the OWASP table was run on our tenant: every control and note is Ping's. The attack-to-row mapping is a lab reading; the "in this gallery" statements describe mocks (lab-invented). No field here comes from the console schema, and nothing is a measurement of a Ping product.

## The two stories

The Stories tab holds a step-by-step talk track for each, re-skinned for three verticals:

- **G1: The agent used my token somewhere else** Runs the attack `audience-confusion`.
- **G2: Which authorization server is this?** Runs the attack `issuer-mixup`.
