import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { PACK_PATH, buildPack, serialize } from './build-content-pack.mjs';
import { validatePack } from './validate-content-pack.mjs';

test('content-pack.json is exactly what the generator produces (run: node scripts/build-content-pack.mjs)', () => {
  assert.equal(fs.readFileSync(PACK_PATH, 'utf8'), serialize(buildPack()));
});
test('content-pack.json validates against docs/content-pack.schema.json', () => assert.deepEqual(validatePack(JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'))), []));
test('the validator rejects a broken pack', () => {
  const pack = buildPack(); pack.cards[0].terms = ['no-such-term']; delete pack.title;
  assert.ok(validatePack(pack).length >= 2);
});
test('the schema copy matches the kit schema when the kit is beside this repo', () => {
  const kit = new URL('../../id-jag-standalone/docs/content-pack.schema.json', import.meta.url);
  if (!fs.existsSync(kit)) return;
  assert.equal(fs.readFileSync(new URL('../docs/content-pack.schema.json', import.meta.url), 'utf8'), fs.readFileSync(kit, 'utf8'));
});
test('the ten required terms are present and every source URL is recorded in docs/references.md', () => {
  const pack = buildPack();
  for (const id of ['mix-up-attack', 'issuer-identification', 'audience-binding', 'resource-indicator', 'token-passthrough', 'confused-deputy', 'actor-injection', 'dynamic-client-registration', 'ssrf', 'object-level-authorization']) assert.ok(pack.glossary.some((g) => g.id === id), id);
  const refs = fs.readFileSync(new URL('../docs/references.md', import.meta.url), 'utf8');
  for (const s of pack.sources) assert.ok(refs.includes(s.url), `${s.url} is in docs/references.md`);
  assert.equal(pack.cards.filter((c) => c.story).length, 2);
});
test('a commit is recorded only when passed', () => { assert.equal(buildPack().source, undefined); assert.equal(buildPack({ commit: 'abc1234' }).source.commit, 'abc1234'); });

test('the pack has the OWASP ASI card and a Why it matters entry (challenge, technical, business) marked as Ping claims; the glossary term says UNVERIFIED', () => {
  const pack = buildPack(); const t = JSON.stringify(pack).toLowerCase();
  assert.equal(pack.cards.find((c) => c.id === 'asi-mapping').action.href, '/#/asi');
  const d = pack.cards.find((c) => c.id === 'concept-why-owasp').description;
  assert.match(d, /Challenge:/); assert.match(d, /Technical:/); assert.match(d, /Business:/); assert.match(d, /Ping claims, unverified on our tenant/);
  assert.match(pack.cards.find((c) => c.id === 'concept-why-owasp').label, /Ping claim, slide 55/);
  assert.match(pack.glossary.find((g) => g.id === 'owasp-asi').definition, /UNVERIFIED on our tenant/); assert.match(pack.glossary.find((g) => g.id === 'owasp-asi').definition, /lab reading/);
  assert.ok(!/https?:\/\/(?!(localhost|www\.rfc-editor\.org|modelcontextprotocol\.io))/.test(t), 'only localhost and the already-recorded spec hosts');
  assert.ok(!/\bdoor\b/.test(t), 'say P1 Privilege Agent App, not door'); assert.ok(!/\d+ ?%/.test(d), 'no Ping percentage quoted');
});
