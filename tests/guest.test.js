const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const guestSource = fs.readFileSync(path.join(__dirname, '..', 'guest.js'), 'utf8');

async function loadGuest(search, data) {
  const elements = new Map();
  function getElementById(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        children: [],
        hidden: false,
        textContent: '',
        innerHTML: '',
        href: '',
        className: '',
        style: { setProperty() {} },
        replaceChildren() { this.children = []; },
        appendChild(child) { this.children.push(child); },
        append(...children) { this.children.push(...children); }
      });
    }
    return elements.get(id);
  }
  const document = {
    getElementById,
    createElement(tag) {
      return {
        tag,
        children: [],
        append(...children) { this.children.push(...children); }
      };
    }
  };
  vm.runInNewContext(guestSource, {
    document,
    location: { search, hash: '' },
    URLSearchParams,
    Date,
    Math,
    encodeURIComponent,
    fetch: async () => ({ ok: true, json: async () => data }),
    window: { setInterval() {}, addEventListener() {} }
  });
  await new Promise(setImmediate);
  return elements;
}

const invitations = {
  featured: 'wedding',
  events: [
    { id: 'wedding', public: true, names: 'Sara & Ahmed', env: 'garden' },
    { id: 'party', public: true, names: 'Birthday party', env: 'classic' },
    { id: 'private', public: false, names: 'Private event', env: 'classic' }
  ]
};

test('shows the event selected by its public link', async () => {
  const elements = await loadGuest('?event=party', invitations);

  assert.equal(elements.get('names').textContent, 'Birthday party');
});

test('shows the featured event and only links to other public events', async () => {
  const elements = await loadGuest('', invitations);
  const links = elements.get('more').children.slice(1);

  assert.equal(elements.get('names').textContent, 'Sara & Ahmed');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, '?event=party');
});
