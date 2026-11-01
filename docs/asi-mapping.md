# OWASP ASI mapping

Generated from `server/src/asi.js` and `server/src/catalog.js` by `node scripts/build-docs.mjs`. Do not edit by hand; the same data is served at `GET /api/asi`.

**Ping release claim, UNVERIFIED on our tenant.** The table of ASI01 to ASI10 is slide 55 of Ping's "ID4AI Workforce - H2 2026" deck (release dated 2026-11-02). Which attack touches which row is the lab's own reading (lab reading): the deck does not map attacks. The gallery's controls are mocks (lab-invented), not Privilege features, and nothing here was run on a Ping tenant.

## Attack to row

| Attack | Stopped by (mock control) | Primary row | Related rows |
| --- | --- | --- | --- |
| `wrong-scope` (Wrong scope) | `scope_check` | ASI03 Identity & Privilege Abuse | ASI02 Tool Misuse & Exploitation |
| `other-account` (Another user's account) | `ownership_check` | ASI03 Identity & Privilege Abuse | none |
| `bad-client` (Bad client) | `client_allowlist` | ASI03 Identity & Privilege Abuse | none |
| `rogue-actor` (Rogue actor in the act claim) | `act_validation` | ASI03 Identity & Privilege Abuse | ASI10 Rogue Agents |
| `impersonation` (Impersonation) | `require_delegation` | ASI03 Identity & Privilege Abuse | none |
| `raw-forwarding` (Raw token forwarding) | `no_token_forwarding` | ASI03 Identity & Privilege Abuse | none |
| `issuer-mixup` (Issuer mix-up (RFC 9207)) | `iss_check` | ASI03 Identity & Privilege Abuse | ASI04 Agentic Supply Chain |
| `audience-confusion` (Token passthrough and audience confusion (RFC 8707)) | `audience_binding` | ASI03 Identity & Privilege Abuse | none |
| `confused-deputy-dcr` (Confused deputy via static client ID and DCR) | `consent_check` | ASI03 Identity & Privilege Abuse | none |
| `ssrf-metadata` (SSRF via metadata) | `ssrf_guard` | ASI02 Tool Misuse & Exploitation | ASI04 Agentic Supply Chain |

## Row to attack, with the deck text

Field tags: name, deck text, status and qualifier are a deck claim; the attack list is a lab reading; the "in this gallery" text is lab-invented.

| Row | The deck says | Status in the deck | Attacks mapped here | In this gallery |
| --- | --- | --- | --- | --- |
| ASI01 Agent Goal Hijack | AIGuard: injection, jailbreak and hidden-instruction detection on requests and responses. | stated in the deck | none | No gallery attack maps here. The gallery attacks the token and authorization layer, not prompt content. Content inspection is not built. |
| ASI02 Tool Misuse & Exploitation | AIGuard: path traversal, destructive commands, SSRF and over-broad scope detection. | stated in the deck | `wrong-scope` (related), `ssrf-metadata` (primary) | SSRF via metadata is the attack the deck names here, and the wrong-scope attack is a related reading of over-broad scope. The mock SSRF guard and scope check are controls of that kind, not the AIGuard detection the deck names. |
| ASI03 Identity & Privilege Abuse | Gateway + AIGuard: per-user virtual keys, least-privilege scopes, per-application RBAC, live revocation. | stated in the deck | `wrong-scope` (primary), `other-account` (primary), `bad-client` (primary), `rogue-actor` (primary), `impersonation` (primary), `raw-forwarding` (primary), `issuer-mixup` (primary), `audience-confusion` (primary), `confused-deputy-dcr` (primary) | Most gallery attacks are identity or privilege abuse at the token layer. The mock controls (scope, ownership, client allowlist, actor, delegation, audience, forwarding, consent, issuer) are generic gateway controls of this kind. Virtual keys, RBAC and live revocation are not built. |
| ASI04 Agentic Supply Chain | AIGuard: description-injection and typosquatting detection on tool definitions; fingerprint pinning pending. **Fingerprint pinning is PENDING in the deck.** Do not present this row as full coverage. | PENDING part | `issuer-mixup` (related), `ssrf-metadata` (related) | Two attacks involve a hostile server in the chain (issuer mix-up, SSRF via metadata) and map here as a related reading. Tool-definition description-injection, typosquatting detection and fingerprint pinning are not built. |
| ASI05 Unexpected Code Execution | AIGuard: shell metacharacter, template-injection and fetch-and-execute rules. | stated in the deck | none | No gallery attack maps here. There is no code-execution attack in this set. |
| ASI06 Memory & Context Poisoning | AIGuard: memory-write inspection shipped; gateway integration in progress. **Memory-write inspection is shipped, but the gateway integration is IN PROGRESS in the deck.** Do not present this row as full coverage. | IN PROGRESS | none | No gallery attack maps here. There is no memory or context attack in this set. |
| ASI07 Insecure Inter-Agent Comm | Gateway + AIGuard: A2A chokepoint with a dedicated scope, plus inter-agent abuse rules. | stated in the deck | none | No gallery attack maps here. There is no agent-to-agent attack in this set, and the A2A chokepoint and its scope are not built. |
| ASI08 Cascading Agent Failures | Gateway: rate and budget ceilings cap blast radius; guardrail circuit breaker; full event stream to your SIEM. **The deck adds: in-gateway behaviour scoring now supplements it.** Treat this as a supplementary note, not full coverage on its own. | deck adds a note | none | No gallery attack maps here. Rate and budget ceilings, the circuit breaker and the SIEM stream are not built. |
| ASI09 Human-Agent Trust Exploit | AIGuard: enforced by the shared jailbreak, exfiltration, prompt-leak and PII rules on every exchange; findings report under their detection category. **The deck says this is enforced by the shared jailbreak, exfiltration, prompt-leak and PII rules and that findings report under their detection category.** That reads as there being no dedicated ASI09 detector. | deck adds a note | none | No gallery attack maps here. Content rules are not built. |
| ASI10 Rogue Agents | Gateway: no agent reaches a model, tool or peer without a valid scoped key; instant revocation; bounded spend. **The deck adds: in-gateway rogue-agent access scoring supplements it.** Treat this as a supplementary note, not full coverage on its own. | deck adds a note | `rogue-actor` (related) | The rogue-actor attack is the closest reading: an agent that should not be acting holds a token that names it. The mock shows an actor allow-list refusing it, not scoped keys, revocation or spend bounds, which are not built. |
