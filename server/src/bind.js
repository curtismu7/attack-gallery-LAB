// The gallery binds loopback only. Anything else is refused unless GALLERY_BIND is set on purpose.
export const isLoopbackHost = (h) => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(h) || /^127\.\d+\.\d+\.\d+$/.test(h);
export function resolveBind(env = process.env) {
  const host = env.GALLERY_HOST || '127.0.0.1';
  const port = Number(env.GALLERY_PORT || 5181);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`GALLERY_PORT is not a valid port: ${env.GALLERY_PORT}`);
  if (!isLoopbackHost(host) && !env.GALLERY_BIND) throw new Error(`Refusing to bind ${host}: the gallery is loopback only. Set GALLERY_BIND=1 to override on purpose.`);
  return { host, port };
}
