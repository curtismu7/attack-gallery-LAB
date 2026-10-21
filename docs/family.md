# The demo family: which demo shows which attack, and which control

The gallery owns the multi-step authorization attacks (catalog item D33). The other demos own neighbouring ground. Ports are the shelf's registered ones (see each demo's `docs/shelf-entry.json` or the shelf registry); this repo does not call any of them, and nothing here is verified by a cross-demo test beyond this table naming them.

| Demo (catalog item) | URL | Shows which attack | Which control | Not this gallery's job |
| --- | --- | --- | --- | --- |
| Attack gallery (D33), this repo | http://localhost:5181 | `wrong-scope`, `other-account`, `bad-client`, `rogue-actor`, `impersonation`, `raw-forwarding`, `issuer-mixup`, `audience-confusion`, `confused-deputy-dcr`, `ssrf-metadata` | `scope_check`, `ownership_check`, `client_allowlist`, `act_validation`, `require_delegation`, `no_token_forwarding`, `iss_check`, `audience_binding`, `consent_check`, `ssrf_guard` | |
| Hostile MCP (D6) | http://localhost:4701 | Poisoned tool metadata (descriptions, schemas), the rug-pull (a tool that changes after approval), injection in a tool result | Tool pinning on the client; the Privilege demo defends the call path | OAuth discovery metadata. The gallery's `ssrf-metadata` is about the authorization metadata URLs a client fetches, not about tool descriptions |
| Hostile A2A (D7) | http://localhost:4901 | A poisoned agent card and what it makes a delegating agent do | Pinned-card client | Authorization-server attacks |
| MCP tools (D3 inspector, D4 scanner) | http://localhost:4810 | Scans server metadata for poison before an agent ingests it. It reports and never blocks | A metadata scan (reports only) | Authorization flows; D35 (conformance scorecard) is meant to build on it |
| Privilege demo (PEP) | http://localhost:4510 | Not an attack demo: a policy enforcement point deciding allow, deny or hold for each tool call | Call control by policy | The gallery's `scope_check` and `ownership_check` are mock logic of this kind, not the demo's engine |

## Boundaries with other catalog items

- **C23** (wrong-token tester) owns single wrong tokens: expired, malformed, bad signature, wrong audience as a one-off error. The gallery's `audience-confusion` is a multi-step story, not an error-message tester.
- **D13** (caught errors) explains every denial. The gallery launches attacks; each refusal carries its reason and control name, but it does not try to be the explainer for denials across the product.
- **C22** (stolen-token lab, bearer versus DPoP) owns replay of a captured token and key binding. The gallery does not cover it.
- **D35** (MCP authorization conformance scorecard) scores a server against the spec. The gallery attacks mock servers; it never scores a real one.

Stories and glossary terms are packaged in `content-pack.json` for the Learning Hub; `docs/shelf-entry.json` registers the gallery on the shelf.
