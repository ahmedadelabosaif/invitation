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
        attributes: {},
        style: {
          properties: {},
          setProperty(name, value) { this.properties[name] = value; }
        },
        replaceChildren() { this.children = []; },
        removeAttribute(name) { delete this.attributes[name]; },
        setAttribute(name, value) { this.attributes[name] = value; },
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
    URL,
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
    { id: 'wedding', names: 'Sara & Ahmed', env: 'garden' },
    { id: 'party', names: 'Birthday party', env: 'classic' }
  ]
};

test('shows the event selected by its public link', async () => {
  const elements = await loadGuest('?event=party', invitations);

  assert.equal(elements.get('names').textContent, 'Birthday party');
});

test('shows a clickable map link when a valid location URL is provided', async () => {
  const withMapLink = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Sara & Ahmed',
      venue: 'Venue name',
      locationUrl: 'https://maps.example.test/venue',
      env: 'garden'
    }]
  };
  const elements = await loadGuest('', withMapLink);

  assert.equal(elements.get('venue').textContent, 'Venue name');
  assert.equal(elements.get('locationLink').hidden, false);
  assert.equal(elements.get('locationLink').href, 'https://maps.example.test/venue');
});

test('does not make unsafe location URLs clickable', async () => {
  const withUnsafeLink = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Sara & Ahmed',
      locationUrl: 'javascript:alert(1)',
      env: 'garden'
    }]
  };
  const elements = await loadGuest('', withUnsafeLink);

  assert.equal(elements.get('locationLink').hidden, true);
});

test('renders the Islamic wedding theme with its emerald and gold decor', async () => {
  const islamicTheme = {
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Amina & Omar', env: 'islamic' }]
  };
  const elements = await loadGuest('', islamicTheme);

  assert.equal(elements.get('card').style.properties['--cbg'], '#153b35');
  assert.equal(elements.get('card').style.properties['--cacc'], '#d8b46a');
  assert.match(elements.get('decor').innerHTML, /☾/);
});

test('shows only selected etiquette notes on the guest invitation', async () => {
  const withEtiquette = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Amina & Omar',
      etiquette: ['noPhotos', 'prayerSpace'],
      env: 'islamic'
    }]
  };
  const elements = await loadGuest('', withEtiquette);
  const notes = elements.get('etiquette').children;

  assert.equal(elements.get('etiquette').hidden, false);
  assert.deepEqual(notes.map((note) => note.textContent), [
    '🚫📷 No photos or video, please',
    '🕌 Prayer space available'
  ]);
});

test('ignores legacy non-array etiquette data on the guest invitation', async () => {
  const withLegacyEtiquette = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Amina & Omar',
      etiquette: '',
      env: 'islamic'
    }]
  };
  const elements = await loadGuest('', withLegacyEtiquette);

  assert.equal(elements.get('etiquette').hidden, true);
  assert.equal(elements.get('etiquette').children.length, 0);
});

test('shows the featured event and links to other events', async () => {
  const elements = await loadGuest('', invitations);
  const links = elements.get('more').children.slice(1);

  assert.equal(elements.get('names').textContent, 'Sara & Ahmed');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, '?event=party');
});
