const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
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
    checked: false,
    style: { setProperty() {} },
    handlers: {},
    addEventListener(name, handler) { this.handlers[name] = handler; },
    appendChild(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    setAttribute() {},
    focus() {},
    select() {}
  };
}

async function loadAdmin(initialData) {
  const elements = new Map();
  const copied = [];
  function getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeNode(id));
    return elements.get(id);
  }
  const fields = ['names', 'emoji', 'kicker', 'date', 'time', 'venue', 'message', 'info', 'event', 'env']
    .map(function (name) {
      const field = makeNode(name);
      field.name = name;
      field.type = 'text';
      return field;
    });
  getElementById('eventForm').elements = fields;
  const document = {
    getElementById,
    createElement: makeNode
  };
  const location = { href: 'https://ahmedadelabosaif.github.io/invitation/admin.html' };
  const navigator = { clipboard: { writeText: async (value) => copied.push(value) } };
  const window = { confirm: () => true, addEventListener() {} };
  vm.runInNewContext(adminSource, {
    document,
    location,
    navigator,
    window,
    URL,
    Date,
    Array,
    JSON,
    fetch: async () => ({ ok: true, json: async () => initialData })
  });
  await new Promise(setImmediate);
  return { elements, fields, copied };
}

test('admin form previews edits and copies publishable invitation data', async () => {
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
      message: 'Join us',
      info: '',
      env: 'garden'
    }]
  };
  const { elements, fields, copied } = await loadAdmin(data);
  const names = fields.find((field) => field.name === 'names');

  assert.equal(elements.get('previewNames').textContent, 'Sara & Ahmed');
  names.value = 'Sara & Ahmed’s wedding';
  elements.get('eventForm').handlers.input({ target: names });
  assert.equal(elements.get('previewNames').textContent, 'Sara & Ahmed’s wedding');

  await elements.get('copyData').handlers.click();
  assert.equal(JSON.parse(copied[0]).events[0].names, 'Sara & Ahmed’s wedding');
  assert.match(elements.get('status').textContent, /replace the file contents, and commit/);
});
