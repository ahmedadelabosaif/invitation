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
    files: [],
    style: { setProperty() {} },
    handlers: {},
    addEventListener(name, handler) { this.handlers[name] = handler; },
    appendChild(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    setAttribute() {},
    focus() {},
    scrollIntoView() {}
  };
}

async function loadAdmin(initialData, storage) {
  const elements = new Map();
  const saved = [];
  const uploaded = [];
  const remoteData = JSON.parse(JSON.stringify(initialData));
  const tokenStorage = storage || new Map();
  function getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeNode(id));
    return elements.get(id);
  }
  const fields = ['names', 'emoji', 'kicker', 'date', 'time', 'venue', 'locationUrl', 'message', 'info', 'event', 'env', 'backgroundMode', 'musicUrl']
    .map(function (name) {
      const field = makeNode(name);
      field.name = name;
      return field;
    });
  ['noPhotos', 'modestDress', 'separateSeating', 'prayerSpace', 'halalFood', 'noMusic']
    .forEach(function (value) {
      const field = makeNode('etiquette-' + value);
      field.name = 'etiquette';
      field.value = value;
      field.type = 'checkbox';
      fields.push(field);
    });
  getElementById('eventForm').elements = fields;
  const document = {
    getElementById,
    createElement(tag) {
      const element = makeNode(tag);
      if (tag === 'canvas') {
        element.getContext = () => ({ fillRect() {}, drawImage() {} });
        element.toBlob = (callback, type) => callback(new Blob(['optimized-image'], { type }));
      }
      return element;
    }
  };
  const window = {
    confirm: () => true,
    addEventListener() {},
    localStorage: {
      getItem(key) { return tokenStorage.get(key) || null; },
      setItem(key, value) { tokenStorage.set(key, value); },
      removeItem(key) { tokenStorage.delete(key); }
    }
  };
  async function fetch(url, options) {
    if (url === './invitations.json') {
      return { ok: true, json: async () => initialData };
    }
    if (!options.method) {
      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(remoteData))));
      return { ok: true, json: async () => ({ content: encoded, sha: 'original-sha' }) };
    }
    const request = JSON.parse(options.body);
    if (url.endsWith('/invitations.json')) {
      saved.push({ url, options });
      const bytes = Uint8Array.from(atob(request.content), (character) => character.charCodeAt(0));
      remoteData.events = JSON.parse(new TextDecoder().decode(bytes)).events;
      remoteData.featured = JSON.parse(new TextDecoder().decode(bytes)).featured;
    } else {
      uploaded.push({ url, options });
    }
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
    createImageBitmap: async () => ({ width: 100, height: 100, close() {} }),
    btoa,
    atob,
    fetch
  });
  await new Promise(setImmediate);
  return { elements, fields, saved, uploaded, tokenStorage };
}

test('admin remembers the saved token and reuses it on later visits', async () => {
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
      etiquette: '',
      env: 'garden'
    }]
  };
  const storage = new Map();
  const { elements, fields, saved, uploaded, tokenStorage } = await loadAdmin(data, storage);
  const names = fields.find((field) => field.name === 'names');

  assert.equal(elements.get('previewNames').textContent, 'Sara & Ahmed');
  assert.equal(elements.get('previewDirections').href, 'https://maps.example.test/event');
  assert.ok(elements.get('previewDecor').children.length > 0);
  const backgroundMode = fields.find((field) => field.name === 'backgroundMode');
  backgroundMode.value = 'full';
  elements.get('eventForm').handlers.input({ target: backgroundMode });
  const musicUrl = fields.find((field) => field.name === 'musicUrl');
  musicUrl.value = 'https://media.example.test/music.mp3';
  elements.get('eventForm').handlers.input({ target: musicUrl });
  const backgroundUpload = elements.get('backgroundUpload');
  backgroundUpload.files = [{ name: 'photo.png', type: 'image/png' }];
  await backgroundUpload.handlers.change({ target: backgroundUpload });
  assert.match(elements.get('previewPanel').style.backgroundImage, /blob:/);
  const noPhotos = fields.find((field) => field.value === 'noPhotos');
  assert.equal(noPhotos.value, 'noPhotos');
  noPhotos.checked = true;
  elements.get('eventForm').handlers.change({ target: noPhotos });
  assert.equal(elements.get('previewEtiquette').hidden, false);
  assert.equal(elements.get('previewEtiquette').children[0].textContent, '🚫📷 No photos or video, please');

  elements.get('addToken').handlers.click();
  elements.get('githubToken').value = 'fine-grained-test-token';
  elements.get('saveToken').handlers.click();
  assert.equal(tokenStorage.get('invitation.github.publish-token'), 'fine-grained-test-token');

  names.value = 'Sara & Ahmed’s wedding';
  elements.get('eventForm').handlers.input({ target: names });
  assert.equal(elements.get('previewNames').textContent, 'Sara & Ahmed’s wedding');

  elements.get('previewButton').handlers.click();
  await elements.get('publishButton').handlers.click();

  assert.equal(saved.length, 1, elements.get('status').textContent);
  assert.equal(uploaded.length, 1);
  assert.match(uploaded[0].url, /\/contents\/images\/wedding-/);
  assert.equal(saved[0].options.method, 'PUT');
  assert.equal(saved[0].options.headers.Authorization, 'Bearer fine-grained-test-token');
  const request = JSON.parse(saved[0].options.body);
  assert.equal(request.sha, 'original-sha');
  const bytes = Uint8Array.from(atob(request.content), (character) => character.charCodeAt(0));
  const savedEvent = JSON.parse(new TextDecoder().decode(bytes)).events[0];
  assert.equal(savedEvent.names, 'Sara & Ahmed’s wedding');
  assert.deepEqual(savedEvent.etiquette, ['noPhotos']);
  assert.equal(savedEvent.backgroundMode, 'full');
  assert.equal(savedEvent.musicUrl, 'https://media.example.test/music.mp3');
  assert.match(savedEvent.backgroundImage, /^images\/wedding-[a-z0-9]+\.jpg$/);
  assert.match(elements.get('status').textContent, /Published/);

  const reopened = await loadAdmin(data, storage);
  assert.equal(reopened.elements.get('tokenSaved').hidden, false);
  const reopenedNames = reopened.fields.find((field) => field.name === 'names');
  reopenedNames.value = 'Updated after reopening';
  reopened.elements.get('eventForm').handlers.input({ target: reopenedNames });
  await reopened.elements.get('publishButton').handlers.click();
  assert.equal(reopened.saved[0].options.headers.Authorization, 'Bearer fine-grained-test-token');
  assert.equal(reopened.elements.get('previewNames').textContent, 'Updated after reopening');
});
