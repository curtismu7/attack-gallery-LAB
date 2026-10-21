# References: what was fetched and read

Rule for this repo: a spec section or product behaviour is cited only if the page was fetched and read in the session that built it. Anything else is labelled UNVERIFIED in the UI and the docs. All pages below were fetched on 2026-10-21 (step GA0).

| Page | What was read | Used for |
| --- | --- | --- |
| https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices | Whole page. Confused Deputy Problem (vulnerable conditions: static client ID + DCR + consent cookie + no per-client consent; proxies MUST keep a per-user registry of approved client_ids and check it before the third-party flow). Token Passthrough (servers MUST NOT accept tokens not issued for them). SSRF (metadata URLs from WWW-Authenticate, PRM and AS metadata; direct IPs, cloud metadata, localhost, DNS rebinding, redirect chains; HTTPS, block private ranges, validate redirect targets, consider pinning DNS). Scope Minimization. It does not mention issuer mix-up. | consent_check, no_token_forwarding, ssrf_guard, scope_check |
| https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization | Whole page. Resource parameter (RFC 8707) MUST; Token Handling (servers MUST validate the token was issued for them as audience, 401 for invalid); Access Token Privilege Restriction (MUST NOT pass through the client's token upstream); Runtime Insufficient Scope Errors (403 + WWW-Authenticate error="insufficient_scope"); Client Registration Approaches; Client ID Metadata Document security and trust policies; no mention of RFC 9207 or issuer checks. | audience_binding, no_token_forwarding, scope_check, client_allowlist (adjacent only) |
| https://www.rfc-editor.org/rfc/rfc9207.html | Sections 1, 2.3, 2.4 (summary returned by the fetch tool). Clients MUST compare iss with the issuer of the server they sent the request to, by simple string comparison, and reject on mismatch; clients must reject responses missing iss from servers that advertise support. | iss_check, issuer-mixup |
| https://www.rfc-editor.org/rfc/rfc8707.html | Section 2 and 2.2 (summary). The authorization server SHOULD restrict tokens to the named resources, typically via aud. The RFC does not explicitly say the resource server MUST verify audience; the MCP authorization page does. | audience_binding |
| https://www.rfc-editor.org/rfc/rfc8693.html | Section 4.1 (act) and 4.4 (may_act) (summary). The outermost act is the current actor; nested act claims are informational only. | act_validation, rogue-actor |
| https://www.rfc-editor.org/rfc/rfc9728.html | Sections 7.4 and 7.7 (summary). 7.4: use audience-restricted tokens when working with several resource servers. 7.7: clients fetching AS metadata should take SSRF precautions such as blocking internal ranges. | audience_binding, ssrf_guard |

## Seed files in the AI-DEMO2 repo (read-only, never modified, never imported)

| File | What it shows | Used for |
| --- | --- | --- |
| demo_mcp_gateway/src/auth/GatewayTokenPolicy.ts | A gateway policy with an actor allow-list (error code `unauthorized_actor`), an impersonation block for agent-mediated tools (`missing_act`, flag-gated), an anti-bypass check on upstream audiences. | act_validation, require_delegation (the only product-behaviour claims in this repo, and only for these two) |
| docs/use-cases/confused-deputy-actor-injection.md | The actor comes from the native signed claim, a header only fills in where no native claim exists. | rogue-actor |
| demo_api_server/routes/demoAttackSeeds.js | Read: seeds poisoned data for prompt injection; not reused. | boundary check only |
| docs/adr/0002-mcp-resource-server-skips-token-introspection.md | Read: local JWT validation trade-off; not reused. | boundary check only |

## Not verified (labelled UNVERIFIED in the UI)

- OWASP API Security, Broken Object Level Authorization (not fetched).
- RFC 8693 impersonation versus delegation semantics (only 4.1 and 4.4 read).
- RFC 8414 AS metadata issuer-versus-URL matching (not fetched; the app does not rely on it).
- Any claim that a specific Ping product ships a given control, beyond the two controls above.

## Scope boundaries

D33 (this app) owns multi-step attacks. C23 owns token-shape errors (a single wrong token), D13 explains denials, D6 and D7 are hostile servers and agents, C22 is the stolen-token lab (bearer vs DPoP). None of those is rebuilt here.
