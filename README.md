# Agent Attack Gallery

A self-contained gallery where an SE launches NAMED attacks against a mock MCP-style stack and sees each one refused, with the reason and the named control. Every attack runs twice: UNGOVERNED (the mock stack has the flaw, so the attack succeeds and you see what the attacker gets) and GOVERNED (the named control refuses with an educational error).

## Status

| Part | State |
| --- | --- |
| Engine: 10 attacks, 10 controls, mock good AS, evil AS, gateway, resource server, DCR proxy, SSRF fake network | built, tested |
| API: `/api/catalog`, `/api/run` (optional `controlsOff`), `/api/matrix`, `/api/controls`, `/api/reset`, `/api/health` (demo-health/1) | built, tested |
| Web UI | Gallery, attack page (ungoverned / governed / both, control toggle), controls, compare matrix, honest limits, stories, ReactFlow diagram (movable boxes, Simulate, Reset, speed), presenter mode, light/dark |
| Docker (OrbStack) | `Dockerfile` + `docker-compose.yml`, loopback-only publish pinned by a test; verified live (see Docker) |
| Shelf entry | `docs/shelf-entry.json`; verified against a running demo-shelf (state `ready`) |
| Learning Hub content pack | `content-pack.json`, validated with ajv against `docs/content-pack.schema.json` (a copy of the kit's schema) |
| Docs | `docs/safety.md`, `docs/architecture.md`, `docs/family.md`, `docs/controls.md` and `docs/attack-catalog.md` (both generated), `docs/references.md`, `CHANGELOG.md` |

## Attacks

Pack 1: wrong scope; another user's account; bad client; rogue actor in `act`; impersonation; raw token forwarding.
Pack 2 (MCP authorization): issuer mix-up (RFC 9207); token passthrough and audience confusion (RFC 8707); confused deputy via static client ID plus DCR; SSRF via metadata.

Each attack is stopped by exactly one control (a flag in the policy). The tests prove it: with all controls on except one, only that control's attack succeeds.

## Safety

- Binds loopback only. A non-loopback `GALLERY_HOST` is refused unless `GALLERY_BIND` is set.
- No real outbound request. Every party is an in-process mock. The SSRF attack runs on a fake network (a table of names and addresses with an injected resolver); no DNS lookup or connection to any internal address is ever attempted. A netguard test records zero attempts beyond the app's own loopback port, and a self-test shows it trips.
- Tokens are fake JWTs signed with keys generated at startup; the API returns decoded claims only, never a compact token.
- Payload hostnames are `.example`, `.invalid`, or the apex of example.com/net/org (tested).

## Honest notes

- Mock parties are in-process handlers, not separate listening sockets. The only listener is the app itself.
- The mock gateway is not any Ping product. Only the two controls cited in `docs/references.md` (actor allow-list, impersonation block) have a seed file in the AI-DEMO2 repo showing the behaviour; every other control is described as "a gateway control of this kind".
- Spec citations are limited to pages fetched and read, listed in `docs/references.md`; everything else is labelled UNVERIFIED.

## Run

Needs Node 20 or newer (the image uses 22).

```
npm install
npm run build
npm start          # http://127.0.0.1:5181
npm run dev        # API on 5181, Vite on 5182
npm test           # server, web and scripts suites
npm run doctor
npm run e2e        # needs npm run build first; Chromium via Playwright
```

Change the port with `GALLERY_PORT=5185 npm start`. A host other than loopback is refused unless `GALLERY_BIND=1`.

### Docker (OrbStack)

```
HOST_PORT=5181 docker compose up --build -d     # http://127.0.0.1:5181
node scripts/live-check.mjs http://127.0.0.1:5181
docker compose down
```

The compose file publishes `127.0.0.1` only (`scripts/compose.test.mjs` pins it). The image is Node 22, non-root, read-only filesystem, all capabilities dropped. `scripts/live-check.mjs` verifies a running instance, host or container, by content: health is `ready`, the page is served, each of the ten attacks run in both modes succeeds ungoverned and is refused by its named control governed, and everything returned passes the safety scan.

### Shelf

`docs/shelf-entry.json` is a registry entry for the demo shelf (D33, port 5181). Copy it into the shelf's `.data/demos.local.json` (edit `composeFile` to your checkout path). With the gallery running, the shelf shows it as Ready.

### Learning Hub

`npm run content-pack` regenerates and validates `content-pack.json` (glossary of ten terms, cards, the two stories). Sources are only URLs recorded as fetched in `docs/references.md`.

### Browser run (not CI)

`npm run e2e` starts the built app on `E2E_PORT` (default 5191), drives every attack in both modes in Chromium, the control toggle, compare, the diagram, presenter mode, dark theme and a 375 px width, and fails if anything leaves the app origin. Screenshots go to `.data/e2e-screenshots` (git-ignored). Set `E2E_CHROMIUM` to use an existing browser.

`.githooks/pre-commit` runs gitleaks on staged files when it is installed (`npm install` wires it).

## More

- [docs/safety.md](docs/safety.md): every rule and the test that enforces it
- [docs/architecture.md](docs/architecture.md)
- [docs/attack-catalog.md](docs/attack-catalog.md) and [docs/controls.md](docs/controls.md): generated from the data
- [docs/family.md](docs/family.md): which demo shows which attack and control
- [docs/references.md](docs/references.md): what was fetched and read

## Honest limits

See [docs/controls.md](docs/controls.md) (what each control does not stop) and the Honest limits page in the app. The mocks are not a test of any product. Cross-demo links in `docs/family.md` are documentation only, not live integration.
