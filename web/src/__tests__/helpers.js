// Points fetch at the real server that globalSetup started, so the UI tests run against the real engine (no mocks of the API).
export function startApi() {
  const base = process.env.GALLERY_TEST_BASE; const real = globalThis.fetch;
  globalThis.fetch = (url, init) => real(typeof url === 'string' && url.startsWith('/') ? base + url : url, init);
  return { base, stop: () => { globalThis.fetch = real; } };
}
