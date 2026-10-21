// Records every attempt to open a socket or resolve a name, and BLOCKS anything that is not the app's own loopback port.
// Nothing blocked is ever sent. Install it before the code under test, uninstall in `after`.
import net from 'node:net';
import dns from 'node:dns';

export function installNetguard({ allowedPorts = [] } = {}) {
  const attempts = []; const violations = [];
  const origConnect = net.Socket.prototype.connect; const origLookup = dns.lookup; const origPLookup = dns.promises.lookup;
  const loopback = (h) => ['127.0.0.1', '::1', 'localhost', undefined].includes(h);
  const record = (kind, target, ok) => { const e = { kind, target }; attempts.push(e); if (!ok) violations.push(e); return ok; };
  net.Socket.prototype.connect = function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const o = typeof first === 'object' && first !== null ? first : { port: first, host: typeof args[1] === 'string' ? args[1] : undefined };
    const target = o.path ? `unix:${o.path}` : `${o.host ?? 'localhost'}:${o.port}`;
    if (!record('connect', target, !o.path && loopback(o.host) && allowedPorts.includes(Number(o.port)))) throw new Error(`netguard: blocked connect to ${target}`);
    return origConnect.apply(this, args);
  };
  dns.lookup = function (host, ...rest) {
    if (!record('lookup', host, loopback(host))) { const cb = rest.at(-1); const err = new Error(`netguard: blocked lookup of ${host}`); if (typeof cb === 'function') return process.nextTick(cb, err); throw err; }
    return origLookup.call(dns, host, ...rest);
  };
  dns.promises.lookup = async function (host, ...rest) {
    if (!record('lookup', host, loopback(host))) throw new Error(`netguard: blocked lookup of ${host}`);
    return origPLookup.call(dns.promises, host, ...rest);
  };
  return {
    attempts, violations,
    allow(port) { allowedPorts.push(port); },
    uninstall() { net.Socket.prototype.connect = origConnect; dns.lookup = origLookup; dns.promises.lookup = origPLookup; },
  };
}
