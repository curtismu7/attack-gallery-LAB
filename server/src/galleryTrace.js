// "What Privilege did" for the gallery's own gateway (Rule 25). Mock only: every party is an in-process simulation, so the trace is always
// source 'mock' and every decision is 'checked' (createGateway().handle really computed it, in the order it ran the checks).
// The Authorization header is a placeholder with the token's length: the API never returns a compact token, even a mock one (the decoded
// claims are in the run's trail). The host is a non-real one (.example).
import { bearerForDisplay, mockTrace } from './gatewayTrace.js';
import { URLS } from './world.js';

// tool, args, headers: what the step sent; bearer: the compact token it sent (only its length is shown); r: gateway.handle()'s answer.
export function gatewayExchange({ tool, args = {}, headers = {}, bearer, r }) {
  const { authorization, ...sent } = headers;
  return mockTrace({
    url: URLS.gateway,
    authorization: bearerForDisplay('<mock token>', () => bearer),
    requestHeaders: { accept: 'application/json', ...sent },
    rpc: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } },
    status: r.status,
    headers: { 'content-type': 'application/json', ...(r.wwwAuthenticate ? { 'www-authenticate': r.wwwAuthenticate } : {}) },
    body: r.ok ? r.body : { error: r.error, error_description: r.error_description },
    decisions: r.decisions,
    record: `gateway tool=${tool} status=${r.status}${r.control ? ` control=${r.control}` : ''}${r.ok ? '' : ` error=${r.error}`}`,
  });
}
