# Changelog

## 0.1.0 (unreleased)

- H2 2026 release update (Ping deck, slide 55; every product claim is a Ping release claim, UNVERIFIED on our tenant): OWASP ASI tab and `GET /api/asi` (ASI01 to ASI10 as the deck qualifies them: ASI04 pending, ASI06 in progress, ASI08 to ASI10 noted); each attack carries the rows it maps to (lab reading) on the gallery card, the attack page and in `/api/catalog`; the release-claim banner on the gallery, attack, ASI and honest-limits pages and in the presenter bar; per-field source tags; a page guard so a throwing page cannot blank the app; generated `docs/asi-mapping.md` and `docs/talk-track.md` with drift tests; content pack gains the `owasp-asi` term, an ASI card and a "Why it matters" card. Federated Identity display rename: 0 hits (the app never used the Non-Human Identity name), nothing changed.
- Wire detail: an "On the wire" panel per trail step (request, response, decoded token with claim notes, deciding field highlighted) and a with/without-control wire comparison on the Compare page. Example data only; signature is always `sig-not-real`.
- GA2: Dockerfile and docker-compose.yml (loopback-only publish, pinned by a test); `scripts/live-check.mjs` and `scripts/safety-scan.mjs`; `docs/shelf-entry.json`; `content-pack.json` with generator and ajv validator; generated `docs/attack-catalog.md` and `docs/controls.md`; `docs/safety.md`, `docs/architecture.md`, `docs/family.md`; MCP security best practices page fetched and recorded.
- GA1: web UI (gallery, attack runs with control toggle, controls, compare, limits, stories, ReactFlow diagram, presenter mode) and the Playwright e2e.
- GA0: scaffold, mock stack, ten attacks and ten controls, API, safety tests.
