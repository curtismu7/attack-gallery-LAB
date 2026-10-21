# Agent Attack Gallery

A self-contained gallery where an SE launches NAMED attacks against a mock MCP-style stack and sees each one refused, with the reason and the named control. Every attack runs twice: UNGOVERNED (the mock stack has the flaw, so the attack succeeds and you see what the attacker gets) and GOVERNED (the named control refuses with an educational error).

## Status (step GA0 of the build)

| Part | State |
| --- | --- |
| Engine: 10 attacks, 10 controls, mock good AS, evil AS, gateway, resource server, DCR proxy, SSRF fake network | built, tested |
| API: `/api/catalog`, `/api/run`, `/api/controls`, `/api/reset`, `/api/health` (demo-health/1) | built, tested |
| Web UI | skeleton only: lists the catalog. The gallery UI, ReactFlow diagram (movable boxes, Simulate, Reset, speed), story views, content pack and shelf entry are NOT built yet |
| Docker, e2e browser tests | not built |

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

```
npm install
npm run build
npm start          # http://127.0.0.1:5181
npm run dev        # API on 5181, Vite on 5182
npm test
npm run doctor
```

`.githooks/pre-commit` runs gitleaks on staged files when it is installed (`npm install` wires it).
