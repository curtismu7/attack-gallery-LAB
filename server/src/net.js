// A fake network: a table of names and addresses plus handlers. Nothing here opens a socket or does a DNS lookup.
export class FakeNet {
  constructor() { this.hosts = new Map(); this.services = new Map(); this.lookups = []; this.attempts = []; }
  // addresses: array, or array of arrays (one answer per lookup; the last repeats) to model DNS rebinding.
  addHost(name, addresses) { this.hosts.set(name.toLowerCase(), { seq: Array.isArray(addresses[0]) ? addresses : [addresses], n: 0 }); return this; }
  addService(address, handler, host = '*') { this.services.set(`${address}|${host}`, handler); return this; }
  async resolve(name) {
    const h = this.hosts.get(name.toLowerCase().replace(/\.$/, ''));
    this.lookups.push(name);
    if (!h) return [];
    const answer = h.seq[Math.min(h.n, h.seq.length - 1)]; h.n += 1;
    return [...answer];
  }
  async connect({ address, host, url, method = 'GET' }) {
    const path = new URL(url).pathname;
    this.attempts.push({ address, host, method, path });
    const handler = this.services.get(`${address}|${host}`) || this.services.get(`${address}|*`);
    if (!handler) return { status: 0, error: 'ECONNREFUSED', headers: {}, body: null };
    const r = await handler({ host, path, method, url });
    return { headers: {}, ...r };
  }
}
