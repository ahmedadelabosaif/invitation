const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { TextDecoder, TextEncoder } = require('node:util');
const vm = require('node:vm');

const adminSource = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');

function makeNode(id) {
  return {
    id,
    children: [],
    hidden: false,
    disabled: false,
    textContent: '',
    value: '',
    style: { setProperty() {} },
    handlers: {},
    addEventListener(name, handler) { this.handlers[name] = handler; },
    appendChild(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    setAttribute() {},
    scrollIntoView() {}
  };
}

async function loadAdmin(initialData) {
  const elements = new Map();
  const saved = [];
  const remoteData = JSON.parse(JSON.stringify(initialData));
  function getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeNode(id));
    return elements.get(id);
  }
  const fields = ['names', 'emoji', 'kicker', 'date', 'time', 'venue', 'locationUrl', 'message', 'info', 'event', 'env']
    .map(function (name) {
      const field = makeNode(name);
      field.name = name;
      return field;
    });
  getElementById('eventForm').elements = fields;
  getElementById('githubToken').value = 'fine-grained-test-token';
  const dataUrl = 'https://api.github.com/repos/ahmedadelabosaif/invitation/contents/invitations.json';
  const document = { getElementById, createElement: makeNode };
  const window = { confirm: () => true, addEventListener() {} };
  async function fetch(url, options) {
    if (url === './invitations.json') {
      return { ok: true, json: async () => initialData };
    }
    if (!options.method) {
      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(remoteData))));
      return { ok: true, json: async () => ({ content: encoded, sha: 'original-sha' }) };
    }
    saved.push({ url, options });
    return { ok: true, json: async () => ({ commit: { sha: 'published-sha' } }) };
  }
  vm.runInNewContext(adminSource, {
    document,
    location: { href: 'https://ahmedadelabosaif.github.io/invitation/admin.html' },
    window,
    URL,
    Date,
    Array,
    JSON,
    Uint8Array,
    TextEncoder,
    TextDecoder,
    btoa,
    atob,
    fetch
  });
  await new Promise(setImmediate);
  return { elements, fields, saved };
}

test('admin form previews edits and publishes them to GitHub without copying', async () => {
  const data = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Sara & Ahmed',
      emoji: '💍',
      kicker: 'You’re invited',
      event: 'Wedding',
      date: '2027-06-12',
      time: '16:00',
      venue: 'Venue',
      locationUrl: 'https://maps.example.test/event',
      message: 'Join us',
      info: '',
      env: 'garden'
    }]
  };
  const { elements, fields, saved } = await loadAdmin(data);
  const names = fields.find((field) => field.name === 'names');

  assert.equal(elements.get('previewNames').textContent, 'Sara & Ahmed');
  assert.equal(elements.get('previewDirections').href, 'https://maps.example.test/event');
  assert.ok(elements.get('previewDecor').children.length > 0);
  names.value = 'Sara & Ahmed’s wedding';
  elements.get('eventForm').handlers.input({ target: names });
  assert.equal(elements.get('previewNames').textContent, 'Sara & Ahmed’s wedding');

  elements.get('previewButton').handlers.click();
  await elements.get('publishButton').handlers.click();

  assert.equal(saved.length, 1, elements.get('status').textContent);
  assert.equal(saved[0].options.method, 'PUT');
  assert.equal(saved[0].options.headers.Authorization, 'Bearer fine-grained-test-token');
  const request = JSON.parse(saved[0].options.body);
  assert.equal(request.sha, 'original-sha');
  const bytes = Uint8Array.from(atob(request.content), (character) => character.charCodeAt(0));
  assert.equal(JSON.parse(new TextDecoder().decode(bytes)).events[0].names, 'Sara & Ahmed’s wedding');
  assert.equal(elements.get('githubToken').value, 'fine-grained-test-token');
  assert.match(elements.get('status').textContent, /Published/);
});
