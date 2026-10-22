// Points fetch at the real server that globalSetup started, so the UI tests run against the real engine (no mocks of the API).
// A refused connection means the request never reached the server (globalSetup restarts it if it was killed), so it is safe to retry, POST included.
const refused = (e) => e?.cause?.code === 'ECONNREFUSED';
export function startApi() {
  const base = process.env.GALLERY_TEST_BASE; const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const target = typeof url === 'string' && url.startsWith('/') ? base + url : url;
    for (let attempt = 0; ; attempt++) {
      try { return await real(target, init); } catch (e) { if (!refused(e) || attempt >= 40) throw e; await new Promise((r) => setTimeout(r, 250)); }
    }
  };
  return { base, stop: () => { globalThis.fetch = real; } };
}
