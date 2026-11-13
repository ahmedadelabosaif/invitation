const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const config = fs.readFileSync(path.join(__dirname, '..', '_config.yml'), 'utf8');
const excludedPaths = new Set(
  Array.from(config.matchAll(/^\s+-\s+([^\s#]+)\s*$/gm), (match) => match[1])
);

test('GitHub Pages excludes the private editor and retains guest invitation assets', () => {
  for (const editorPath of ['admin.html', 'admin.js', 'layout-config.js', 'README.md', 'tests']) {
    assert.ok(excludedPaths.has(editorPath), `${editorPath} must not be published`);
  }

  for (const guestPath of ['index.html', 'guest.js', 'invitations.json']) {
    assert.ok(!excludedPaths.has(guestPath), `${guestPath} must remain published`);
  }
});
