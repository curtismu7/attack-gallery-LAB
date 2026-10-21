import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeNet } from '../src/net.js';
import { guardedFetch, rawFetch, SsrfBlocked } from '../src/ssrf.js';
import { isPublicAddress, parseIPv6 } from '../src/ipguard.js';

const ok = (body = { ok: true }) => () => ({ status: 200, body });
function world() {
  const n = new FakeNet();
  n.addHost('good.example', ['93.184.216.50']).addService('93.184.216.50', ok());
  n.addHost('lo.evil.example', ['127.0.0.1']).addHost('ll.evil.example', ['169.254.169.254']).addHost('priv.evil.example', ['10.1.2.3'])
    .addHost('mixed.evil.example', ['93.184.216.50', '192.168.1.10']).addHost('v6.evil.example', ['::ffff:7f00:1'])
    .addHost('rebind.evil.example', [['93.184.216.50'], ['169.254.169.254']])
    .addHost('redir.evil.example', ['93.184.216.51']).addHost('loop.evil.example', ['93.184.216.52']);
  for (const a of ['127.0.0.1', '169.254.169.254', '10.1.2.3', '192.168.1.10']) n.addService(a, ok({ internal: a }));
  n.addService('93.184.216.51', () => ({ status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data/' } }));
  n.addService('93.184.216.52', () => ({ status: 302, headers: { location: 'https://loop.evil.example/again' } }));
  return n;
}
const blocked = (p, reasonRe) => assert.rejects(p, (e) => e instanceof SsrfBlocked && reasonRe.test(e.reason));
const internalAttempts = (n) => n.attempts.filter((a) => !a.address.startsWith('93.184.216.'));

test('a public https name is fetched', async () => {
  const n = world(); const r = await guardedFetch(n, 'https://good.example/x'); assert.equal(r.status, 200);
});
for (const [label, url, re] of [
  ['loopback literal', 'https://127.0.0.1/', /loopback/], ['loopback ::1', 'https://[::1]/', /loopback/],
  ['link-local literal', 'https://169.254.169.254/latest/', /link-local/], ['10/8', 'https://10.0.0.5/', /private-10/], ['172.16/12', 'https://172.16.5.5/', /private-172/],
  ['192.168/16', 'https://192.168.0.1/', /private-192/], ['CGNAT', 'https://100.64.0.1/', /cgnat/], ['unique-local v6', 'https://[fd00::1]/', /unique-local/], ['link-local v6', 'https://[fe80::1]/', /link-local/],
  ['IPv4-mapped dotted', 'https://[::ffff:127.0.0.1]/', /ipv4-mapped/], ['IPv4-mapped hex', 'https://[::ffff:7f00:1]/', /ipv4-mapped/], ['IPv4-mapped metadata', 'https://[::ffff:a9fe:a9fe]/', /ipv4-mapped/],
  ['NAT64 of loopback', 'https://[64:ff9b::7f00:1]/', /nat64/], ['6to4 of private', 'https://[2002:0a00:0001::1]/', /6to4/],
  ['hex IPv4 form', 'https://0x7f.0.0.1/', /loopback/], ['octal IPv4 form', 'https://0177.0.0.1/', /loopback/], ['decimal IPv4 form', 'https://2130706433/', /loopback/], ['short form', 'https://127.1/', /loopback/],
  ['name to loopback', 'https://lo.evil.example/', /loopback/], ['name to link-local', 'https://ll.evil.example/', /link-local/], ['name to private', 'https://priv.evil.example/', /private-10/],
  ['name with one internal answer among public ones', 'https://mixed.evil.example/', /private-192/], ['name to mapped v6', 'https://v6.evil.example/', /ipv4-mapped/],
  ['plain http', 'http://good.example/', /scheme_not_https/], ['credentials in URL', 'https://u:p@good.example/', /credentials/], ['file scheme', 'file:///etc/passwd', /scheme_not_https/],
  ['javascript scheme', 'javascript:alert(1)', /scheme_not_https/], ['unresolvable name', 'https://nope.invalid/', /unresolvable/],
]) {
  test(`governed fetch refuses: ${label}`, async () => {
    const n = world(); await blocked(guardedFetch(n, url), re); assert.equal(internalAttempts(n).length, 0, 'no connection to an internal address was attempted');
  });
}
test('redirect to an internal address is refused on the second hop, before connecting', async () => {
  const n = world(); await blocked(guardedFetch(n, 'https://redir.evil.example/'), /link-local/);
  assert.equal(n.attempts.length, 1); assert.equal(internalAttempts(n).length, 0);
});
test('redirect loops stop', async () => { await blocked(guardedFetch(world(), 'https://loop.evil.example/'), /too_many_redirects/); });
test('DNS rebinding: the validated address is pinned; the second answer is never used', async () => {
  const n = world(); const r = await guardedFetch(n, 'https://rebind.evil.example/');
  assert.equal(r.hops[0].address, '93.184.216.50'); assert.equal(internalAttempts(n).length, 0); assert.equal(n.lookups.length, 1);
});
test('control experiment: validate-then-resolve-again is exploitable by rebinding; the raw client reaches the internal address', async () => {
  const n = world();
  const first = await n.resolve('rebind.evil.example'); assert.ok(isPublicAddress(first[0]).public); // the naive check passes...
  const r = await rawFetch(n, 'https://rebind.evil.example/'); // ...and the later fetch re-resolves
  assert.equal(r.hops[0].address, '169.254.169.254'); assert.equal(r.status, 200);
});
test('the ungoverned client follows a redirect into the private range', async () => {
  const n = world(); const r = await rawFetch(n, 'https://redir.evil.example/'); assert.equal(r.body.internal, '169.254.169.254');
});
test('address classifier: public vs not, and parser edge cases', () => {
  for (const a of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111']) assert.equal(isPublicAddress(a).public, true, a);
  for (const a of ['0.0.0.0', '255.255.255.255', '192.0.2.1', '::', 'zzz', '::ffff:10.0.0.1', '1::2::3']) assert.equal(isPublicAddress(a).public, false, a);
  assert.deepEqual(parseIPv6('::1'), [0, 0, 0, 0, 0, 0, 0, 1]); assert.equal(parseIPv6('fe80::1%eth0'), null);
});
