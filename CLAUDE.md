# CLAUDE.md

Agent Attack Gallery: a self-contained demo where an SE launches 10 named attacks against a mock MCP-style stack and sees each one succeed UNGOVERNED, then be refused by one named control when GOVERNED. Tier: **Demo**. Node ESM, Express server, React + Vite web, npm workspaces (`server`, `web`).

## Commands

- `npm install`, `npm run build`, `npm start` -> http://127.0.0.1:5181 (`GALLERY_PORT` changes it). `npm run dev`: API 5181, Vite 5182.
- `npm test` runs server, web and scripts suites. Server uses `node --test test/*.test.js`: a glob, never a directory (a directory fails on Node 22).
- `npm run doctor` (exit 1 on a failed check), `npm run e2e` (needs a build first; Chromium via Playwright).
- OWASP ASI (deck slide 55): `server/src/asi.js` (table as qualified + attack mapping), `GET /api/asi`, `#/asi` tab. A Ping release claim, UNVERIFIED on our tenant: keep the claim banner on every page that shows it (`web/src/data/claim.js`), also in presenter mode; keep the deck's gaps (ASI04 pending, ASI06 in progress, ASI08-10 notes). Attack-to-row is a lab reading. `npm run docs` regenerates `docs/asi-mapping.md` and `docs/talk-track.md` (drift-tested).
- Reset: `POST /api/reset` rebuilds keys and world state. Health: `GET /api/health` (`demo-health/1`).
- `npm run content-pack` rebuilds and validates `content-pack.json`; `npm run docs` regenerates `docs/controls.md` and `docs/attack-catalog.md`.
- Test on Node 26 only. CI (GitHub-hosted `ubuntu-latest`): build (Node 26), forbidden-strings and gitleaks jobs on PRs and main.

## Rules that bite

- **Default story: AirGuard Airlines, a fictional airline** (fleet spec 2026-11-28). `DEFAULT_VERTICAL = 'airlines'` in `web/src/story/stories.js` (the `generic` and `banking` packs stay selectable; an unknown or missing id falls back to the default). The mock world is AirGuard Airlines's SkyMiles accounts (`server/src/world.js`: Emma and Noah, balances in miles, tool `transfer_miles`); attack ids, control ids, refusal errors and the `accounts:*` scope names are unchanged. The pack's cast slot ids stay `mark`/`mary` (stories use `{{mark}}`); only the names changed. `server/test/airlineDefault.test.js` fails if bank wording, an old brand or the old cast names come back into what a run shows. Real mode is untouched.

- Loopback-only bind; a non-loopback `GALLERY_HOST` is refused without `GALLERY_BIND`. Docker publishes `127.0.0.1:` only (pinned by a test).
- Netguard: no real outbound call, ever. Every party is an in-process mock; the SSRF attack runs on a fake network. A test asserts zero attempts, with a self-test that proves it trips.
- User-supplied text is rendered inert. Hostnames are `.example` or `.invalid` only.
- Do not use `generateKeyPair`/`generateKeyPairSync` for EC keys (SIGABRT GC race on Node 20.20.2). Use `generateEcKeyPair` in `server/src/keys.js` (createECDH + JWK import); a test guards it.
- The forbidden-strings history scan must print 0; never print or commit the list. No identifiers from other projects. Gitleaks pre-commit hook is on.
- Keep the Real-or-mock modal (shared `mode-modal`, vendored into `web/src/mode-modal/`, never edited here) on the page: it opens on MOCK (this gallery has no live version) and carries the hosted line on the hosted build. Mock tokens are fake JWTs and their decoded header and claims are shown on purpose (education); the API never returns the compact JWT string, and there are no real secrets.
- Every attack is stopped by exactly one control; tests prove it. Spec claims need a source in `docs/references.md`, else label UNVERIFIED.
- What Privilege did (Rule 25): `createGateway().handle` (`parties.js`) returns `decisions` (one per check, in order: baseline token, tool, then the controls; `info` when a control is OFF in this run, `skipped` after an earlier refusal), `runner.js` attaches `gateway: gatewayExchange(...)` (`server/src/galleryTrace.js`, a `mockTrace`) to each `call` and `replay-captured` trail entry, and `GatewayCalls` in `RunPanel.jsx` renders `<GatewayTrace>` under each side's Trail on the attack page. The files are vendored byte-for-byte from AI-DEMO-Standalone `shared/gateway-trace` and pinned by `web/src/gateway-trace/gateway-trace.sha256` (`scripts/gateway-trace.test.mjs`): `web/src/gateway-trace/*` and `server/src/gatewayTrace.js`. Never hand-edit them; re-vendor with cp, then re-pin. Honesty rule: this lab is mock only, so its decisions are `checked` because the simulated gateway computed them; a real gateway reports no per-check detail, so a real trace may only say `inferred` or `observed`. The token is shown as its length only (the API never returns a compact token); the gateway is the lab's own, not a Privilege product, and the panel says so (`basisNote`).

## Where things are

- `server/src`: engine (`parties.js` mock parties, `keys.js` signing, `policy.js` controls, `catalog.js` attacks, `ssrf.js`, `net.js`, `app.js` API).
- `web/src`: gallery UI, ReactFlow diagram (movable boxes, Simulate, Reset, speed), presenter mode.
- `docs/safety.md` (safety model), `docs/references.md` (cited specs), `docs/shelf-entry.json`, `content-pack.json`, `scripts/` (doctor, e2e, docs, live-check).
