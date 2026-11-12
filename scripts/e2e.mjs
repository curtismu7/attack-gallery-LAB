#!/usr/bin/env node
// Real-browser run of the built app (pattern: hostile-mcp scripts/e2e.mjs). Screenshots go to .data/e2e-screenshots (git-ignored).
//   npm run build && npm run e2e            starts the server on E2E_PORT (default 5191), drives it, stops it
//   npm run e2e -- <url>                    drives a server that is already running
// Makes no outbound request; any request outside the app's own origin is counted and fails the run.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, '.data', 'e2e-screenshots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures++; };

const given = process.argv.slice(2).find((a) => a.startsWith('http'));
const port = Number(process.env.E2E_PORT) || 5191;
const base = given ? given.replace(/\/$/, '') : `http://127.0.0.1:${port}`;
let server;
if (!given) {
  if (!fs.existsSync(path.join(root, 'web', 'dist', 'index.html'))) { console.error('Run `npm run build` first.'); process.exit(2); }
  server = spawn(process.execPath, ['server/src/index.js'], { cwd: root, env: { ...process.env, GALLERY_HOST: '127.0.0.1', GALLERY_PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* not up yet */ } await sleep(250); }
}
fs.rmSync(shots, { recursive: true, force: true }); fs.mkdirSync(shots, { recursive: true });

const ATTACKS = ['wrong-scope', 'other-account', 'bad-client', 'rogue-actor', 'impersonation', 'raw-forwarding', 'issuer-mixup', 'audience-confusion', 'confused-deputy-dcr', 'ssrf-metadata'];
const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM || undefined });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const shot = (name) => page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
  const go = async (hash) => { await page.goto(`${base}/#/${hash}`); await page.reload(); };
  const external = []; const errors = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== new URL(base).origin && !/^(data|blob):/.test(r.url())) external.push(r.url()); });
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // keyboard: skip link
  await go('gallery'); await page.getByTestId('card-wrong-scope').waitFor();
  await page.keyboard.press('Tab');
  check((await page.evaluate(() => document.activeElement.textContent)) === 'Skip to content', 'first Tab stop is the skip link');
  await page.keyboard.press('Enter');
  check(await page.evaluate(() => document.activeElement.id) === 'main', 'skip link moves focus to main');
  check((await page.getByTestId('banner').innerText()).includes('Nothing leaves this machine'), 'banner says all parties are mocks');
  check((await page.locator('[data-testid^="card-"]').count()) === 10, 'gallery shows ten attack cards');
  check((await page.locator('.badge', { hasText: /^UNVERIFIED$/ }).count()) > 0 && (await page.locator('.badge', { hasText: /^VERIFIED$/ }).count()) > 0, 'cards carry VERIFIED and UNVERIFIED badges');
  await shot('01-gallery-light');

  // every attack, both modes, side by side
  for (const id of ATTACKS) {
    await go(`attack/${id}`); await page.getByRole('button', { name: 'Launch both' }).click();
    const un = page.getByTestId('side-ungoverned'); const gv = page.getByTestId('side-governed');
    await un.getByTestId('gain').waitFor(); await gv.getByTestId('flag').waitFor();
    const gain = await un.getByTestId('gain').innerText();
    const flag = await gv.getByTestId('flag').innerText(); const name = await gv.getByTestId('control-name').innerText();
    check(gain.length > 20 && (await gv.getByTestId('gain').count()) === 0 && flag.length > 3 && name.length > 3 && (await gv.getByTestId('refusal-message').innerText()).length > 20, `${id}: ungoverned gain "${gain.slice(0, 50)}..." / governed ${flag} -> ${name}`);
    await shot(`attack-${id}`);
  }

  // the toggle proves the control
  await go('attack/audience-confusion');
  await page.getByRole('button', { name: 'Launch governed' }).click();
  const gv = page.getByTestId('side-governed'); await gv.getByTestId('error-code').waitFor();
  check((await gv.getByTestId('error-code').innerText()) === 'invalid_token', 'governed: refused with invalid_token');
  await gv.getByRole('checkbox').check(); await gv.getByTestId('gain').waitFor();
  check((await gv.getByTestId('flag-state').innerText()).includes('OFF'), 'toggle off: the same attack now succeeds on the governed side');
  await shot('toggle-off');
  await gv.getByRole('checkbox').uncheck(); await gv.getByTestId('error-code').waitFor();
  check((await gv.getByTestId('flag-state').innerText()).includes('ON'), 'toggle on again: refused again');

  // controls and compare
  await go('controls'); await page.getByTestId('control-scope_check').waitFor();
  check((await page.locator('[data-testid^="control-"]').count()) === 10, 'controls table has ten rows'); await shot('controls');
  await go('compare'); await page.getByTestId('matrix').waitFor(); await page.waitForSelector('.cell--hit');
  check((await page.locator('.cell--hit').count()) === 10, 'compare matrix: ten succeeding cells, one per attack'); await shot('compare');
  await go('limits'); await page.getByTestId('unverified-list').waitFor();
  check((await page.getByTestId('unverified-list').locator('li').count()) >= 2, 'honest limits lists unverified claims'); await shot('limits');

  // OWASP ASI (slide 55): the deck's table as qualified, the claim banner, the lab's attack mapping
  await go('asi'); await page.getByTestId('asi-table').waitFor();
  check((await page.locator('[data-testid^="asi-ASI"]').count()) === 10, 'asi: ten rows, ASI01 to ASI10');
  check((await page.getByTestId('claim-banner').innerText()).includes('Ping release claim, UNVERIFIED on our tenant'), 'asi: the release-claim banner is on the page');
  check((await page.getByTestId('status-ASI04').innerText()) === 'PENDING part' && (await page.getByTestId('status-ASI06').innerText()) === 'IN PROGRESS', 'asi: ASI04 pending and ASI06 in progress are kept as the deck states them'); await shot('asi');
  await go('attack/ssrf-metadata'); await page.getByTestId('asi-map-ASI04').waitFor();
  check((await page.getByTestId('asi-panel').innerText()).includes('not a Privilege feature'), 'attack page: the ASI panel says the control is a mock'); await shot('attack-asi-panel');

  // stories
  await go('stories'); await page.getByTestId('story-panel').waitFor();
  await page.getByRole('button', { name: 'Control blocks' }).click(); await page.getByLabel('Vertical').selectOption('airlines');
  check((await page.getByTestId('story-panel').innerText()).includes('crew-payroll API'), 'story G1 re-skins to the airlines pack');
  await shot('story-g1-airlines');
  await page.getByRole('button', { name: 'Which authorization server is this?' }).click(); await page.getByLabel('Vertical').selectOption('banking');
  check((await page.getByTestId('story-panel').innerText()).includes('bank'), 'story G2 in the banking pack'); await shot('story-g2-banking');
  // presenter
  await page.getByRole('button', { name: 'Present' }).click(); await page.getByTestId('present-count').waitFor();
  const c1 = await page.getByTestId('present-count').innerText(); await page.keyboard.press('ArrowRight');
  check(c1 !== (await page.getByTestId('present-count').innerText()), `presenter: ArrowRight moves the step (${c1})`); await shot('presenter');
  await page.keyboard.press('Escape');

  // diagram. The Attack select is found by its label element: getByLabel('Attack') also matches the edges' aria-labels ("Edge from ... attacker"), which flicker in and out of the DOM and made this step flaky.
  await go('diagram'); await page.getByTestId('flow').waitFor(); await page.getByTestId('ctrl-iss_check').waitFor();
  await page.locator('label.field', { hasText: /^Attack/ }).locator('select').selectOption('issuer-mixup'); await page.getByLabel('Speed').selectOption('4');
  await page.waitForFunction(() => !document.querySelector('button.primary').disabled);
  const node = page.locator('.react-flow__node', { hasText: 'Evil AS' }); const b0 = await node.boundingBox();
  await page.mouse.move(b0.x + 20, b0.y + 20); await page.mouse.down(); await page.mouse.move(b0.x + 140, b0.y + 120, { steps: 8 }); await page.mouse.up();
  await sleep(200); const b1 = await node.boundingBox(); check(Math.abs(b1.x - b0.x) > 50, 'diagram: a box can be dragged');
  await page.getByRole('button', { name: 'Simulate' }).click(); await page.getByTestId('diagram-outcome').waitFor({ timeout: 8000 });
  check((await page.getByTestId('diagram-outcome').innerText()).includes('iss_mismatch'), 'diagram: governed simulation stops at the iss check');
  check((await page.getByTestId('hopnum-3').getAttribute('class')).includes('hopnum--stop') && (await page.getByTestId('hopnum-1').getAttribute('class')).includes('hopnum--on'), 'diagram: hop badges light up and the stopping hop turns red');
  await shot('diagram-governed');
  await page.getByRole('button', { name: 'Reset' }).click(); check((await page.getByTestId('diagram-outcome').count()) === 0, 'diagram: Reset clears the run');
  { // ReactFlow applies a controlled node position one render after the click (the transform is written from its own store), so a single read right after Reset can still see the dragged position. Poll until it settles.
    let b2 = await node.boundingBox();
    for (let i = 0; i < 40 && !(Math.abs(b2.x - b0.x) < 2 && Math.abs(b2.y - b0.y) < 2); i++) { await sleep(50); b2 = await node.boundingBox(); }
    check(Math.abs(b2.x - b0.x) < 2 && Math.abs(b2.y - b0.y) < 2, 'diagram: Reset restores the dragged box to its starting position'); }
  { // control-point chips: no overlap, no truncation (nowrap text fits its chip)
    const chips = await page.locator('[data-testid^="ctrl-"].dctrl').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.testid, x: r.x, y: r.y, w: r.width, h: r.height, clipped: e.scrollWidth > e.clientWidth + 1 }; }));
    const overlap = []; for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) { const a = chips[i], c = chips[j]; if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) overlap.push(`${a.id}/${c.id}`); }
    check(chips.length === 10 && overlap.length === 0 && chips.every((c) => !c.clipped), `diagram: ten control chips, none overlap or truncate ${overlap.join(',')}`);
  }
  // governed SSRF: the real run attempts and refuses hops 2-4
  await page.locator('label.field', { hasText: /^Attack/ }).locator('select').selectOption('ssrf-metadata');
  await page.waitForFunction(() => !document.querySelector('button.primary').disabled);
  await page.getByRole('button', { name: 'Simulate' }).click(); await page.getByTestId('diagram-outcome').waitFor({ timeout: 10000 });
  { const cls = await Promise.all([1, 2, 3, 4].map((n) => page.getByTestId(`hopnum-${n}`).getAttribute('class')));
    check(!cls[0].includes('hopnum--stop') && cls.slice(1).every((c) => c.includes('hopnum--stop')), 'diagram: governed ssrf-metadata refuses hops 2, 3 and 4'); }
  await page.locator('label.field', { hasText: /^Attack/ }).locator('select').selectOption('issuer-mixup');
  await page.waitForFunction(() => !document.querySelector('button.primary').disabled);
  await page.getByRole('button', { name: 'Ungoverned' }).click(); await page.waitForFunction(() => !document.querySelector('button.primary').disabled);
  await page.getByRole('button', { name: 'Simulate' }).click(); await page.getByTestId('diagram-outcome').waitFor({ timeout: 8000 });
  check((await page.getByTestId('diagram-outcome').innerText()).includes('Attacker gained'), 'diagram: ungoverned simulation ends with the gain'); await shot('diagram-ungoverned');

  // hostile strings stay inert: the API is made to return script/onerror payloads in every attacker-controlled field
  const evil = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
  await page.route('**/api/run', async (route) => {
    const real = await (await route.fetch()).json();
    const taint = (v) => (typeof v === 'string' ? v.replaceAll('agent-rogue', evil).replaceAll('attacker.example', evil) : Array.isArray(v) ? v.map(taint) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, taint(x)])) : v);
    await route.fulfill({ json: taint(real) });
  });
  await go('attack/rogue-actor'); await page.getByRole('button', { name: 'Launch both' }).click(); await page.getByTestId('side-governed').getByTestId('flag').waitFor();
  check((await page.evaluate(() => window.__pwned)) === undefined && (await page.locator('main img[src="x"], main script').count()) === 0, 'hostile payload in claims/messages renders as text; nothing executes');
  check((await page.getByTestId('side-ungoverned').innerText()).includes('<img src=x onerror='), 'the payload is visible as literal text');
  await shot('inert-payload'); await page.unroute('**/api/run');

  // dark theme and narrow width
  await go('attack/issuer-mixup'); await page.getByRole('button', { name: 'Launch both' }).click(); await page.getByTestId('side-governed').getByTestId('flag').waitFor();
  await page.getByTestId('theme-select').selectOption('dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor); check(bg === 'rgb(5, 23, 39)', `dark theme applied (body ${bg})`); await shot('attack-dark');
  for (const hash of ['gallery', 'diagram', 'compare']) { await go(hash); await sleep(500); await shot(`dark-${hash}`); }
  const dark = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' }); const dp = await dark.newPage();
  await dp.goto(`${base}/#/gallery`); await dp.getByTestId('card-wrong-scope').waitFor();
  check((await dp.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(5, 23, 39)', 'dark system preference is followed'); await dark.close();
  await page.getByTestId('theme-select').selectOption('light');
  await page.setViewportSize({ width: 375, height: 800 });
  for (const hash of ['gallery', 'attack/audience-confusion', 'controls', 'compare', 'asi', 'stories', 'diagram', 'limits']) {
    await go(hash); await sleep(400);
    if (hash.startsWith('attack')) { await page.getByRole('button', { name: 'Launch both' }).click(); await page.getByTestId('side-governed').getByTestId('flag').waitFor(); }
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(over <= 1, `375px: no horizontal page scroll on ${hash} (overflow ${over}px)`); await shot(`narrow-${hash.replace('/', '-')}`);
  }
  check(external.length === 0, `no request left the app origin (${external.length})`);
  check(errors.length === 0, `no console or page errors (${errors.length}) ${errors.slice(0, 2).join(' | ')}`);
} finally { await browser.close(); server?.kill(); }
console.log(failures ? `\n${failures} FAILED` : '\nall checks passed'); process.exit(failures ? 1 : 0);
