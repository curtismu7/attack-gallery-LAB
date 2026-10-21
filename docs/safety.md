# Safety

The gallery simulates attacks, so it is built to do nothing real. Each rule below names the test that enforces it. Run them all with `npm test`. Test names are quoted exactly; `scripts/docs.test.mjs` fails if a quoted name no longer exists.

| Rule | Enforced by |
| --- | --- |
| The server binds loopback only and refuses any other host unless `GALLERY_BIND` is set. | `server/test/safety.test.js`: "bind: loopback by default; a non-loopback host is refused unless GALLERY_BIND is set". |
| No real outbound request. Every party (good AS, evil AS, gateway, backend, proxy) is an in-process handler; the only listener is the app. | `safety.test.js`: "netguard: running every attack in every mode through the API makes zero outbound attempts" (a guard on sockets and DNS records every attempt and allows only the app's own loopback port), and "netguard self-test: it records and blocks a connection and a lookup" (so a clean result means something). |
| The SSRF attack uses an injected fake resolver and fake network: a table of names and addresses. No DNS lookup or connection to an internal address is ever attempted. | `server/test/ssrf.test.js`: "governed fetch refuses" (loopback, link-local, private, rebinding names), "redirect to an internal address is refused on the second hop, before connecting", "DNS rebinding: the validated address is pinned", "control experiment: validate-then-resolve-again is exploitable by rebinding", "address classifier: public vs not, and parser edge cases". The network guard above runs while these attacks run through the API. |
| Tokens are fake JWTs signed with keys generated at startup; a compact token is never returned or printed. The UI shows decoded claims and redacted requests only. | `server/test/keys.test.js`: "mint then verify, and the description never contains the signature"; `server/test/attacks.test.js`: "trace shows decoded claims only, never a compact JWT"; `web/src/__tests__/app.test.jsx`: "decoded claims are shown and the compact token is never on the page". |
| Payload hostnames are only `.example`, `.invalid` or the apex of example.com/net/org. IP literals are reserved or private. | `safety.test.js`: "every hostname in the catalog and in every trace is .example, .invalid, or the apex of example.com/net/org". The same scan over a running instance: `scripts/live-check.mjs` (`scripts/safety-scan.mjs`, tested by `scripts/safety-scan.test.mjs`). |
| No real secret, PingOne id or private host in the source. | `safety.test.js`: "no secret-looking material: tokens never leave as compact JWTs, and the source has no PingOne ids or private hosts". `.githooks/pre-commit` and the CI `secrets` job run gitleaks. |
| Untrusted strings (claims, labels, requests, gain, refusal text) render as inert text, and the page cannot run inline script or talk to another origin. | `web/src/__tests__/app.test.jsx`: "claims, labels, requests, gain and refusal render as plain text" and "the index page ships no inline script"; `server/test/api.test.js`: "responses carry a CSP that forbids inline script and outside connections". |
| The container publishes its port on loopback only, runs as a non-root user and is locked down. | `scripts/compose.test.mjs`: "docker-compose.yml publishes only on 127.0.0.1", "the parser flags an unbound or wildcard publish", "the image runs as a non-root user on Node 22 and the container is locked down". Also a live check, below. |
| Request bodies are small and validated. | `server/test/api.test.js`: "validation: bad id, bad mode, bad JSON, missing body, huge body". |

## The one opt-in

Inside the container the server must listen on all interfaces, so the image sets `GALLERY_HOST=0.0.0.0` and `GALLERY_BIND=1`. That is the explicit opt-in, and it is safe only because compose publishes the port on `127.0.0.1`. If you run the image some other way, publish it the same way. Run as host process, the default is `127.0.0.1`.

## What is not covered

- The compose publish rule is checked by a file parse and by a live check (a request to the host's LAN address was refused); it is not checked on every CI run against a real engine.
- A browser extension or proxy on your machine can see what the page shows. Nothing sensitive is shown.
- Nothing here proves a vendor product is safe. See `docs/controls.md`, the section Limits that apply to every control.
