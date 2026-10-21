import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the skeleton page has a root, a title, and tokens for both themes', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="root"/); assert.match(html, /<title>Agent Attack Gallery<\/title>/);
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-color-scheme: dark/); assert.ok(!/purple|#[78][0-9a-f]{2}[0-9a-f]{3}f/i.test(css));
});
