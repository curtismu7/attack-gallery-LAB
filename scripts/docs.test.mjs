import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { DOCS, buildDocs } from './build-docs.mjs';

test('docs/attack-catalog.md and docs/controls.md are exactly what the generator produces (run: node scripts/build-docs.mjs)', async () => {
  const out = await buildDocs();
  for (const k of Object.keys(DOCS)) assert.equal(fs.readFileSync(DOCS[k], 'utf8'), out[k], `${k} is stale`);
});

test('docs/shelf-entry.json is a valid shelf registry entry for D33 on port 5181', () => {
  const { demos } = JSON.parse(fs.readFileSync(new URL('../docs/shelf-entry.json', import.meta.url), 'utf8'));
  assert.equal(demos.length, 1);
  const d = demos[0];
  assert.match(d.id, /^[a-z0-9-]{2,41}$/);
  assert.equal(d.catalogId, 'D33');
  assert.equal(d.url, 'http://localhost:5181');
  assert.equal(d.healthPath, '/api/health');
  assert.ok(d.composeFile.endsWith('docker-compose.yml'));
  assert.ok(!d.composeFile.includes('/Users/') && !d.composeFile.startsWith('/'), 'composeFile must be a placeholder, not a machine-specific absolute path');
});

test('docs/family.md names every attack and every control, and every sibling demo by its shelf port', async () => {
  const fam = fs.readFileSync(new URL('../docs/family.md', import.meta.url), 'utf8');
  const { ATTACKS } = await import('../server/src/catalog.js');
  for (const a of ATTACKS) assert.ok(fam.includes(`\`${a.id}\``) && fam.includes(`\`${a.control}\``), a.id);
  for (const port of ['4701', '4901', '4810', '4510']) assert.ok(fam.includes(`localhost:${port}`), port);
});

test('docs/safety.md names a test that exists for every rule', () => {
  const safety = fs.readFileSync(new URL('../docs/safety.md', import.meta.url), 'utf8');
  const tests = ['server/test/safety.test.js', 'server/test/api.test.js', 'server/test/ssrf.test.js', 'server/test/keys.test.js', 'server/test/attacks.test.js', 'web/src/__tests__/app.test.jsx', 'scripts/compose.test.mjs'];
  const body = tests.map((f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  const quoted = [...safety.matchAll(/"([^"]{20,})"/g)].map((m) => m[1]);
  assert.ok(quoted.length >= 8);
  for (const q of quoted) assert.ok(body.includes(q.replace(/\.\.\.$/, '')), `safety.md quotes a test name that does not exist: ${q}`);
});
