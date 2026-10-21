// The control table. A policy is a set of flags: true = the control is ON (governed), false = OFF (ungoverned).
// Product claims: none here. "A gateway control of this kind" is the most this table says, except where a seed file in
// the AI-DEMO2 repo shows the behaviour (see `seed`).
import { REF } from './references.js';

export const CONTROLS = [
  { id: 'scope_check', name: 'Scope check', error: 'insufficient_scope', status: 403,
    message: 'The token does not carry the scope this tool needs. Request a token with the scope, do not widen the tool.',
    does: 'Compares the scope on the token with the scope the tool requires.', refs: [REF.MCP_AUTH_SCOPE_CHALLENGE, REF.MCP_SEC_SCOPE_MIN] },
  { id: 'ownership_check', name: 'Per-user ownership check', error: 'forbidden_object', status: 403,
    message: 'The object belongs to a different user than the token subject. A valid token and a valid scope are not permission to read any account.',
    does: 'Compares the owner of the requested object with the sub claim of the token.', refs: [REF.OWASP_BOLA, REF.MCP_AUTH_PRIV_RESTRICTION] },
  { id: 'client_allowlist', name: 'Client allowlist', error: 'unauthorized_client', status: 403,
    message: 'The client (azp) on the token is not a registered client for this gateway.',
    does: 'Accepts tokens only for clients the gateway operator registered.', refs: [REF.MCP_AUTH_CLIENT_REG, REF.MCP_AUTH_TRUST_POLICY] },
  { id: 'act_validation', name: 'Actor (act claim) validation', error: 'unauthorized_actor', status: 403,
    message: 'The actor in the token act claim is not an allowed actor. The actor is read from the signed token only; a caller-supplied header can never name or replace it.',
    does: 'Checks act.sub against the allowed actors and ignores any actor the caller supplies outside the signed token.',
    refs: [REF.RFC8693_ACT], seed: 'AI-DEMO2 demo_mcp_gateway/src/auth/GatewayTokenPolicy.ts (actor allow-list, error code unauthorized_actor); docs/use-cases/confused-deputy-actor-injection.md' },
  { id: 'require_delegation', name: 'Delegation required (impersonation block)', error: 'delegation_required', status: 403,
    message: 'This tool must be called by an agent acting for a user (act claim present). A plain user token would erase the agent from the record.',
    does: 'Rejects tokens with no act claim on agent-mediated tools.', refs: [REF.RFC8693_IMPERSONATION],
    seed: 'AI-DEMO2 demo_mcp_gateway/src/auth/GatewayTokenPolicy.ts (UC16 impersonation block, error code missing_act)' },
  { id: 'audience_binding', name: 'Audience binding (RFC 8707)', error: 'invalid_token', status: 401,
    message: 'The token was issued for a different resource (aud does not include this gateway). Tokens are only good at the resource they were issued for.',
    does: 'Requires the gateway URI in the aud claim.', refs: [REF.RFC8707_RESOURCE, REF.MCP_AUTH_TOKEN_HANDLING, REF.RFC9728_AUD] },
  { id: 'no_token_forwarding', name: 'No raw token forwarding (exchange instead)', error: 'token_forwarding_blocked', status: 200,
    message: 'The gateway did not pass the caller token upstream. It exchanged it for a separate, short-lived token with its own audience.',
    does: 'Obtains a new upstream token via token exchange instead of forwarding the inbound bearer token.', refs: [REF.MCP_AUTH_PRIV_RESTRICTION, REF.MCP_SEC_PASSTHROUGH] },
  { id: 'iss_check', name: 'Issuer check on the authorization response (RFC 9207)', error: 'iss_mismatch', status: 400,
    message: 'The iss in the authorization response is not the issuer of the server the client sent the request to. The client stops and keeps the code.',
    does: 'Compares the iss response parameter with the expected issuer by simple string comparison.', refs: [REF.RFC9207_VALIDATE] },
  { id: 'consent_check', name: 'Per-client consent (static client + DCR)', error: 'consent_required', status: 200,
    message: 'This client_id has no recorded consent from this user. The proxy shows its own consent page (client name, scopes, redirect URI) before any third-party hop.',
    does: 'Keeps a per-user registry of approved client_id values and checks it before forwarding to the third-party authorization server.', refs: [REF.MCP_SEC_CONFUSED_DEPUTY] },
  { id: 'ssrf_guard', name: 'SSRF guard on metadata fetches', error: 'ssrf_blocked', status: 400,
    message: 'The metadata URL points at a non-public target (loopback, link-local, private range) or reaches one through DNS or a redirect. The client refuses to fetch it.',
    does: 'HTTPS only, public unicast addresses only, validated address pinned for the connection, every redirect hop re-validated.', refs: [REF.MCP_SEC_SSRF, REF.RFC9728_SSRF] },
];
export const CONTROL_IDS = CONTROLS.map((c) => c.id);
export const controlById = (id) => CONTROLS.find((c) => c.id === id);
export const governed = () => Object.fromEntries(CONTROL_IDS.map((id) => [id, true]));
export const ungoverned = () => Object.fromEntries(CONTROL_IDS.map((id) => [id, false]));
export const governedExcept = (off) => ({ ...governed(), [off]: false });
