import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { DOCS, buildDocs } from './build-docs.mjs';

test('docs/attack-catalog.md, controls.md, asi-mapping.md and talk-track.md are exactly what the generator produces (run: node scripts/build-docs.mjs)', async () => {
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
  const tests = ['server/test/safety.test.js', 'server/test/api.test.js', 'server/test/ssrf.test.js', 'server/test/keys.test.js', 'server/test/attacks.test.js', 'web/src/__tests__/app.test.jsx', 'web/src/__tests__/asi.test.jsx', 'server/test/asi.test.js', 'scripts/compose.test.mjs'];
  const body = tests.map((f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  const quoted = [...safety.matchAll(/"([^"]{20,})"/g)].map((m) => m[1]);
  assert.ok(quoted.length >= 8);
  for (const q of quoted) assert.ok(body.includes(q.replace(/\.\.\.$/, '')), `safety.md quotes a test name that does not exist: ${q}`);
});

test('docs/talk-track.md covers every attack and every ASI row, carries the claim label, and marks Why it matters as Ping claims', async () => {
  const talk = fs.readFileSync(DOCS.talkTrack, 'utf8');
  const { ATTACKS } = await import('../server/src/catalog.js');
  const { ASI_IDS, CLAIM_LABEL, asiForAttack, asiTable } = await import('../server/src/asi.js');
  assert.ok(talk.includes(`**${CLAIM_LABEL}.**`));
  for (const a of ATTACKS) { assert.ok(talk.includes(`### ${a.name}`), a.id); for (const m of asiForAttack(a.id)) assert.ok(talk.split(`### ${a.name}`)[1].split('###')[0].includes(`${m.id} `), `${a.id} ${m.id}`); }
  for (const r of asiTable().rows.filter((x) => x.attacks.length === 0)) assert.ok(talk.includes(`**${r.id} ${r.name}.**`), r.id);
  for (const id of ASI_IDS) assert.ok(fs.readFileSync(DOCS.asi, 'utf8').includes(`| ${id} `), id);
  const why = talk.split('## Why it matters:')[1].split('\n## ')[0];
  assert.match(why, /Ping claim, slide 55/); assert.match(why, /Challenge:/); assert.match(why, /Technical:/); assert.match(why, /Business:/); assert.match(why, /Ping claims, unverified on our tenant/);
  assert.ok(!talk.includes('{{'), 'no undefined cast token');
  assert.match(talk, /Do not present those rows as full coverage/); assert.match(talk, /not a Privilege feature/);
});
