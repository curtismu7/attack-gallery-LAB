# Architecture

One Node process (Express) serves the API and the built web app. Nothing else listens.

```
browser (React + Vite, ReactFlow diagram)
   |  fetch /api/*  (same origin; CSP connect-src 'self')
Express app  (server/src/app.js)
   |-- /api/catalog, /api/controls, /api/run, /api/matrix, /api/reset, /api/health (demo-health/1)
   `-- runner.js interprets each attack's steps (catalog.js) against a "world" (parties.js)
         world = good AS + evil AS (in-process mocks, own keys) + gateway (policy flags) + resource server
                 + billing backend + MCP proxy / DCR + fake network for the SSRF attack (ssrf.js, ipguard.js)
```

- **Catalog** (`server/src/catalog.js`): attacks as data, steps interpreted by `runner.js`. One attack, one named control.
- **ASI table** (`server/src/asi.js`): the deck's slide-55 OWASP table as qualified, plus the lab's attack-to-row mapping; served at `GET /api/asi` and as `asi` on each catalog attack. Rows list their attacks by derivation from the mapping, never typed twice.
- **Policy** (`server/src/policy.js`): ten flags. Ungoverned = all off, governed = all on. `/api/run` accepts `controlsOff` for the governed side so the UI toggle can show that the control is what stops the attack.
- **Keys** (`keys.js`): signing keys are generated at startup; `/api/reset` rotates them.
- **SSRF** (`ssrf.js`, `net.js`, `ipguard.js`): the guarded fetch takes an injected resolver and network; the tests inject a table, so no real lookup happens.
- **Web** (`web/src`): hash-routed pages (gallery, attack, controls, compare, stories, diagram, limits), a presenter mode, the story engine copied from the ID-JAG kit.
- **Docs generated from data**: `docs/attack-catalog.md`, `docs/controls.md`; `content-pack.json` from `content/terms.json` and the story files.
- **Container**: `Dockerfile` (two stages, Node 22, non-root) and `docker-compose.yml` (loopback-only publish).
