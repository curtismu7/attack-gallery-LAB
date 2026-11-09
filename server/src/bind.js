// The gallery binds loopback only. Anything else is refused unless GALLERY_BIND is set on purpose.
export const isLoopbackHost = (h) => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(h) || /^127\.\d+\.\d+\.\d+$/.test(h);
import { isMockOnly, parseAllowedHosts } from './mockonly.js';
import { parseLabHosts } from './sameorigin.js';
export function resolveBind(env = process.env) {
  const host = env.GALLERY_HOST || '127.0.0.1';
  const port = Number(env.GALLERY_PORT || 5181);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`GALLERY_PORT is not a valid port: ${env.GALLERY_PORT}`);
  if (!isLoopbackHost(host) && !env.GALLERY_BIND) throw new Error(`Refusing to bind ${host}: the gallery is loopback only. Set GALLERY_BIND=1 to override on purpose.`);
  // GALLERY_ALLOWED_HOSTS: comma-separated Host names (no port) the gallery will answer; anything else gets 403.
  const allowedHosts = parseAllowedHosts(env.GALLERY_ALLOWED_HOSTS);
  // A hosted mock on a non-loopback bind must name its hosts; it never falls back to answering any Host.
  if (isMockOnly(env) && !isLoopbackHost(host) && !allowedHosts.length) throw new Error('MOCK_ONLY on a non-loopback GALLERY_HOST requires GALLERY_ALLOWED_HOSTS');
  // LAB_ALLOWED_HOSTS: extra Host names (no port) a local run answers besides loopback, on GALLERY_PORT; Docker defaults it
  // to the family lab-proxy's name for this app. Only on those Hosts is the proxy's forwarded origin believed.
  const labHosts = parseLabHosts(env.LAB_ALLOWED_HOSTS);
  return { host, port, allowedHosts, labHosts };
}
