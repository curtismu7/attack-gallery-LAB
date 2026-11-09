// Pattern copied from hostile-mcp scripts/compose.test.mjs. Run by `npm test`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

// A small line parser (no YAML dependency): the list items under each `ports:` key.
export function publishedPorts(text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)ports:\s*$/.exec(lines[i]);
    if (!m) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const item = /^\s*-\s*["']?([^"'\s#]+)["']?/.exec(lines[j]);
      if (!item || lines[j].search(/\S/) <= m[1].length) break;
      out.push(item[1]);
    }
  }
  return out;
}

test('docker-compose.yml publishes only on 127.0.0.1', () => {
  const ports = publishedPorts(fs.readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8'));
  assert.ok(ports.length > 0, 'the parser found the published port');
  for (const p of ports) assert.match(p, /^127\.0\.0\.1:/, `${p} must start with 127.0.0.1:`);
});

test('the parser flags an unbound or wildcard publish', () => {
  for (const bad of ['- "5181:5181"', '- "0.0.0.0:5181:5181"', '- 5181']) {
    const ports = publishedPorts(`services:\n  a:\n    ports:\n      ${bad}\n`);
    assert.equal(ports.length, 1);
    assert.doesNotMatch(ports[0], /^127\.0\.0\.1:/);
  }
});

test('the image runs as a non-root user on Node 22 and the container is locked down', () => {
  const df = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(df, /^FROM node:22/m);
  assert.match(df, /^USER node$/m);
  const dc = fs.readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');
  for (const s of ['read_only: true', 'cap_drop: [ALL]', 'no-new-privileges:true']) assert.ok(dc.includes(s), s);
});

test('compose allows the family lab-proxy name by default, never the bare proxy name', () => {
  const dc = fs.readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');
  assert.match(dc, /LAB_ALLOWED_HOSTS: \$\{LAB_ALLOWED_HOSTS:-attack-gallery\.local\.ping-devops\.com\}/);
});
