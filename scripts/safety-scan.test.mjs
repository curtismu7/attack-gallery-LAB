import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanText } from './safety-scan.mjs';

test('the payload scan finds real hosts, a compact JWT and secret-shaped text, and passes reserved names', () => {
  assert.deepEqual(scanText('https://as.evil-mcp.example/x http://169.254.169.254/ https://example.com/ http://[::1]:1/'), []);
  assert.ok(scanText('see https://real-host.com/path').some((f) => /real-host\.com/.test(f)));
  assert.ok(scanText('http://8.8.8.8/').length === 1);
  const seg = (x) => Buffer.from(x).toString('base64url');
  assert.ok(scanText(`${seg('{"alg":"none"}')}.${seg('{"sub":"mark","x":1}')}.${seg('signature-bytes')}`).includes('compact JWT'));
  assert.ok(scanText('-----BEGIN PRIVATE KEY-----').length === 1 || scanText('BEGIN RSA PRIVATE KEY').length === 1);
});
