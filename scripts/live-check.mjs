#!/usr/bin/env node
// Verifies a RUNNING gallery by content (host-run or in Docker): health, page, every attack in both modes through the API,
// and a safety scan of everything it returned (no compact JWT, no hostname outside .example/.invalid/example.com|net|org,
// no secret-shaped material). Makes requests only to the URL you pass.
//   node scripts/live-check.mjs http://127.0.0.1:5185
import { scanText } from './safety-scan.mjs';
const base = (process.argv[2] || 'http://127.0.0.1:5181').replace(/\/$/, '');
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures++; };

const health = await (await fetch(`${base}/api/health`)).json();
check(health.schema === 'demo-health/1' && health.state === 'ready', `health: ${health.schema} state=${health.state}`);
const page = await fetch(`${base}/`); const html = await page.text();
check(page.status === 200 && /<div id="root">/.test(html), 'page: index.html served with the app root');
check(/default-src 'self'/.test(page.headers.get('content-security-policy') || ''), 'page: CSP header present');
const catalog = await (await fetch(`${base}/api/catalog`)).json();
check(catalog.attacks.length === 10, `catalog: ${catalog.attacks.length} attacks`);
const seen = []; // run traces only: catalog reference links are citations to the public specs, not payloads
for (const a of catalog.attacks) {
  const r = await (await fetch(`${base}/api/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attackId: a.id, mode: 'both' }) })).json();
  seen.push(JSON.stringify(r));
  const [un, gv] = r.runs;
  check(un?.succeeded === true && gv?.succeeded === false && gv?.refusal?.control === a.control, `${a.id}: ungoverned succeeds, governed refused by ${gv?.refusal?.control}`);
}
const findings = scanText(seen.join('\n'));
check(findings.length === 0, `safety scan of every response: ${findings.length ? findings.slice(0, 5).join('; ') : 'clean'}`);
console.log(failures ? `${failures} check(s) FAILED` : 'live-check: all passed');
process.exit(failures ? 1 : 0);
