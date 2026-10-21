// Metadata fetching, in two flavours. The governed one refuses non-public targets, pins the address it validated,
// and re-validates every redirect hop. The ungoverned one is the flawed client: resolve, connect, follow redirects blindly.
import { isIP } from 'node:net';
import { isPublicAddress } from './ipguard.js';

export class SsrfBlocked extends Error {
  constructor(reason, url, address) { super(`ssrf_blocked: ${reason}`); this.code = 'ssrf_blocked'; this.reason = reason; this.url = url; this.address = address; }
}
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const bare = (h) => h.replace(/^\[|\]$/g, '');

export async function guardedFetch(net, rawUrl, { maxRedirects = 3 } = {}) {
  let url = rawUrl; const hops = [];
  for (let i = 0; i <= maxRedirects; i++) {
    let u; try { u = new URL(url); } catch { throw new SsrfBlocked('bad_url', url); }
    if (u.protocol !== 'https:') throw new SsrfBlocked('scheme_not_https', url);
    if (u.username || u.password) throw new SsrfBlocked('credentials_in_url', url);
    const host = bare(u.hostname);
    const addrs = isIP(host) ? [host] : await net.resolve(host);
    if (!addrs.length) throw new SsrfBlocked('unresolvable', url);
    for (const a of addrs) { const c = isPublicAddress(a); if (!c.public) throw new SsrfBlocked(`non_public_address:${c.reason}`, url, a); }
    const address = addrs[0]; // pinned: the connection goes to exactly the address that was validated
    const res = await net.connect({ address, host, url: u.href });
    hops.push({ url: u.href, address, status: res.status });
    if (REDIRECTS.has(res.status) && res.headers.location) { url = new URL(res.headers.location, u).href; continue; }
    return { ...res, hops };
  }
  throw new SsrfBlocked('too_many_redirects', url);
}

export async function rawFetch(net, rawUrl, { maxRedirects = 3 } = {}) {
  let url = rawUrl; const hops = [];
  for (let i = 0; i <= maxRedirects; i++) {
    const u = new URL(url); const host = bare(u.hostname);
    const addrs = isIP(host) ? [host] : await net.resolve(host);
    const res = await net.connect({ address: addrs[0], host, url: u.href });
    hops.push({ url: u.href, address: addrs[0], status: res.status });
    if (REDIRECTS.has(res.status) && res.headers.location) { url = new URL(res.headers.location, u).href; continue; }
    return { ...res, hops };
  }
  return { status: 0, error: 'too_many_redirects', headers: {}, hops };
}
