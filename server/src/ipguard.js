// Address classification for the SSRF guard. Public unicast only: anything else is refused.
// IPv4 comes from the WHATWG URL parser already normalised (hex/octal/decimal forms become dotted decimal).
export function parseIPv4(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((n) => n <= 255) ? o : null;
}
export function parseIPv6(s) {
  if (s.includes('%')) return null; // zone ids are not accepted
  let tail = null;
  const lastColon = s.lastIndexOf(':');
  const v4 = parseIPv4(s.slice(lastColon + 1));
  if (v4) { tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]]; s = s.slice(0, lastColon + 1) + '0:0'; }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const toGroups = (p) => (p === '' ? [] : p.split(':'));
  const head = toGroups(halves[0]), rest = halves.length === 2 ? toGroups(halves[1]) : [];
  const fill = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : fill < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...rest];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g))) return null;
  const nums = groups.map((g) => parseInt(g, 16));
  if (tail) { nums[6] = tail[0]; nums[7] = tail[1]; }
  return nums;
}
const V4_BLOCKS = [
  ['0.0.0.0', 8, 'this-network'], ['10.0.0.0', 8, 'private-10/8'], ['100.64.0.0', 10, 'cgnat'], ['127.0.0.0', 8, 'loopback'],
  ['169.254.0.0', 16, 'link-local'], ['172.16.0.0', 12, 'private-172.16/12'], ['192.0.0.0', 24, 'ietf-protocol'],
  ['192.0.2.0', 24, 'documentation'], ['192.168.0.0', 16, 'private-192.168/16'], ['198.18.0.0', 15, 'benchmark'],
  ['198.51.100.0', 24, 'documentation'], ['203.0.113.0', 24, 'documentation'], ['224.0.0.0', 4, 'multicast'], ['240.0.0.0', 4, 'reserved'],
];
const v4int = (o) => ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
function classify4(o) {
  const n = v4int(o);
  for (const [base, bits, reason] of V4_BLOCKS) {
    const b = v4int(parseIPv4(base)); const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    if (((n & mask) >>> 0) === ((b & mask) >>> 0)) return { public: false, reason };
  }
  return { public: true, reason: 'public' };
}
const embedded = (a, b) => [a >> 8, a & 255, b >> 8, b & 255];
function classify6(g) {
  const zeros = (from, to) => g.slice(from, to).every((x) => x === 0);
  if (zeros(0, 8)) return { public: false, reason: 'unspecified' };
  if (zeros(0, 7) && g[7] === 1) return { public: false, reason: 'loopback' };
  if (zeros(0, 5) && g[5] === 0xffff) { const r = classify4(embedded(g[6], g[7])); return { public: false, reason: `ipv4-mapped:${r.reason}` }; }
  if (zeros(0, 6)) return { public: false, reason: 'ipv4-compatible' };
  if (g[0] === 0x64 && g[1] === 0xff9b && zeros(2, 6)) { const r = classify4(embedded(g[6], g[7])); return r.public ? { public: true, reason: 'nat64-public' } : { public: false, reason: `nat64:${r.reason}` }; }
  if (g[0] === 0x2002) { const r = classify4(embedded(g[1], g[2])); return r.public ? { public: true, reason: '6to4-public' } : { public: false, reason: `6to4:${r.reason}` }; }
  if (g[0] === 0x2001 && g[1] === 0) return { public: false, reason: 'teredo' };
  if (g[0] === 0x2001 && g[1] === 0xdb8) return { public: false, reason: 'documentation' };
  if ((g[0] & 0xfe00) === 0xfc00) return { public: false, reason: 'unique-local' };
  if ((g[0] & 0xffc0) === 0xfe80) return { public: false, reason: 'link-local' };
  if ((g[0] & 0xffc0) === 0xfec0) return { public: false, reason: 'site-local' };
  if ((g[0] & 0xff00) === 0xff00) return { public: false, reason: 'multicast' };
  if ((g[0] & 0xe000) === 0x2000) return { public: true, reason: 'public' };
  return { public: false, reason: 'not-global-unicast' };
}
export function isPublicAddress(addr) {
  const a = String(addr).replace(/^\[|\]$/g, '');
  const v4 = parseIPv4(a); if (v4) return classify4(v4);
  const v6 = parseIPv6(a); if (v6) return classify6(v6);
  return { public: false, reason: 'unparseable' };
}
