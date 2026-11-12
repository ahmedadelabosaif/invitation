const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { TextDecoder, TextEncoder } = require('node:util');
const vm = require('node:vm');

const adminSource = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');

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
    focus() { this.focused = true; },
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
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
  const fields = [
    'names', 'emoji', 'kicker', 'introDescription', 'date', 'time', 'venue', 'locationUrl',
    'message', 'info', 'event', 'env', 'religiousOpening', 'quranVerse', 'quranReference',
    'hostNames', 'groomTitle', 'groomName', 'brideTitle', 'brideName', 'preEventTitle',
    'preEventDate', 'preEventTime', 'preEventVenue', 'preEventLocationUrl',
    'preEventDetails', 'contractImageUrl', 'contractImageCaption', 'backgroundMode',
    'backgroundPreset', 'musicTrack', 'musicUrl'
  ]
    .map(function (name) {
      const field = makeNode(name);
      field.name = name;
      if ([
        'names', 'kicker', 'introDescription', 'venue', 'message', 'info', 'event',
        'religiousOpening', 'quranVerse', 'quranReference', 'hostNames', 'groomTitle',
        'groomName', 'brideTitle', 'brideName', 'preEventTitle', 'preEventTime',
        'preEventVenue', 'preEventDetails', 'contractImageCaption'
      ].includes(name)) field.tagName = 'TEXTAREA';
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
  getElementById('newEventType').value = 'wedding';
  getElementById('newEventPanel').hidden = true;
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
  const introDescription = fields.find((field) => field.name === 'introDescription');

  introDescription.value = 'With our families, we invite you to celebrate this special day.';
  elements.get('eventForm').handlers.input({ target: introDescription });
  const backgroundMode = fields.find((field) => field.name === 'backgroundMode');
  backgroundMode.value = 'full';
  elements.get('eventForm').handlers.input({ target: backgroundMode });
  const musicUrl = fields.find((field) => field.name === 'musicUrl');
  musicUrl.value = 'https://media.example.test/music.mp3';
  elements.get('eventForm').handlers.input({ target: musicUrl });
  const backgroundUpload = elements.get('backgroundUpload');
  backgroundUpload.files = [{ name: 'photo.png', type: 'image/png' }];
  await backgroundUpload.handlers.change({ target: backgroundUpload });
  const noPhotos = fields.find((field) => field.value === 'noPhotos');
  assert.equal(noPhotos.value, 'noPhotos');
  noPhotos.checked = true;
  elements.get('eventForm').handlers.change({ target: noPhotos });

  elements.get('addToken').handlers.click();
  elements.get('githubToken').value = 'fine-grained-test-token';
  elements.get('saveToken').handlers.click();
  assert.equal(tokenStorage.get('invitation.github.publish-token'), 'fine-grained-test-token');

  names.value = 'Sara & Ahmed’s wedding';
  elements.get('eventForm').handlers.input({ target: names });
  assert.equal(elements.get('formTitle').textContent, 'Sara & Ahmed’s wedding');

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
  assert.equal(savedEvent.introDescription, introDescription.value);
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
  assert.equal(reopened.elements.get('formTitle').textContent, 'Updated after reopening');
});

test('admin publishes a background design and a selected public-domain music track', async () => {
  const data = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Sara & Ahmed',
      etiquette: [],
      env: 'garden'
    }]
  };
  const storage = new Map([['invitation.github.publish-token', 'fine-grained-test-token']]);
  const { elements, fields, saved, uploaded } = await loadAdmin(data, storage);
  const backgroundPreset = fields.find((field) => field.name === 'backgroundPreset');
  backgroundPreset.value = 'goldenArch';
  elements.get('eventForm').handlers.input({ target: backgroundPreset });
  assert.equal(backgroundPreset.value, 'goldenArch');

  const musicTrack = fields.find((field) => field.name === 'musicTrack');
  musicTrack.value = 'chopinRomance';
  elements.get('eventForm').handlers.input({ target: musicTrack });
  await elements.get('publishButton').handlers.click();

  assert.equal(uploaded.length, 0);
  assert.equal(saved.length, 1, elements.get('status').textContent);
  const request = JSON.parse(saved[0].options.body);
  const bytes = Uint8Array.from(atob(request.content), (character) => character.charCodeAt(0));
  const savedEvent = JSON.parse(new TextDecoder().decode(bytes)).events[0];
  assert.equal(savedEvent.backgroundPreset, 'goldenArch');
  assert.equal(savedEvent.backgroundMode, 'full');
  assert.equal(savedEvent.musicTrack, 'chopinRomance');
  assert.equal(savedEvent.musicUrl, '');
});

test('editor no longer renders a live preview panel or preview button', () => {
  assert.doesNotMatch(adminHtml, /id="previewPanel"/);
  assert.doesNotMatch(adminHtml, /id="previewButton"/);
});

test('formats selected invitation text and updates the clickable canvas', async () => {
  const data = {
    featured: 'wedding',
    events: [{ id: 'wedding', eventType: 'wedding', names: 'Sara & Ahmed', env: 'islamic' }]
  };
  const { elements, fields } = await loadAdmin(data);
  const message = fields.find((field) => field.name === 'message');
  message.value = 'Join us';
  message.selectionStart = 0;
  message.selectionEnd = message.value.length;
  elements.get('eventForm').handlers.focusin({ target: message });
  elements.get('richTextToolbar').handlers.click({
    target: { getAttribute(name) { return name === 'data-format' ? 'gold' : null; } }
  });

  assert.equal(message.value, '[gold]Join us[/gold]');
  assert.equal(data.events[0].message, '[gold]Join us[/gold]');
  assert.equal(elements.get('canvas-message').innerHTML, '<span class="text-gold">Join us</span>');

  elements.get('designCanvas').handlers.click({ target: elements.get('canvas-message') });
  assert.equal(message.focused, true);
});

test('requires choosing an invitation type before creating an event', async () => {
  const data = {
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Amina & Omar' }]
  };
  const { elements } = await loadAdmin(data);

  assert.equal(elements.get('weddingFields').hidden, false);
  elements.get('addEvent').handlers.click();
  assert.equal(elements.get('newEventPanel').hidden, false);
  assert.equal(elements.get('eventList').children.length, 1);
  elements.get('newEventType').value = '';
  elements.get('createEvent').handlers.click();
  assert.equal(elements.get('eventList').children.length, 1);
  elements.get('newEventType').value = 'wedding';
  elements.get('createEvent').handlers.click();

  assert.equal(elements.get('eventList').children.length, 2);
  assert.equal(elements.get('newEventPanel').hidden, true);
  assert.equal(elements.get('weddingFields').hidden, false);
  assert.equal(elements.get('formTitle').textContent, 'New wedding invitation');
});

test('creates non-wedding invitations using the type selected first', async () => {
  const data = {
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Amina & Omar' }]
  };
  const { elements } = await loadAdmin(data);

  elements.get('addEvent').handlers.click();
  elements.get('newEventType').value = 'birthday';
  elements.get('createEvent').handlers.click();

  assert.equal(data.events[1].eventType, 'birthday');
  assert.equal(elements.get('weddingFields').hidden, true);
  assert.equal(elements.get('formTitle').textContent, 'New birthday invitation');
});

test('admin creates an invitation with structured wedding details', async () => {
  const data = {
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Abdelrahman & Omnia' }]
  };
  const storage = new Map([['invitation.github.publish-token', 'fine-grained-test-token']]);
  const { elements, fields, saved } = await loadAdmin(data, storage);
  const values = {
    religiousOpening: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    quranVerse: 'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُمْ',
    quranReference: 'سورة الروم – الآية ٢١',
    hostNames: 'الأستاذ رضا والأستاذ ياسر',
    groomTitle: 'م.',
    groomName: 'عبدالرحمن',
    brideTitle: 'د.',
    brideName: 'أمنية',
    preEventTitle: 'Wedding lunch',
    preEventDate: '2026-11-19',
    preEventTime: 'After Dhuhr prayer',
    preEventVenue: 'Groom’s family home',
    preEventLocationUrl: 'https://maps.example.test/lunch',
    preEventDetails: 'Lunch before the wedding',
    contractImageUrl: 'https://images.example.test/contract.jpg',
    contractImageCaption: 'Alhamdulillah'
  };
  Object.entries(values).forEach(([name, value]) => {
    const field = fields.find((item) => item.name === name);
    field.value = value;
    elements.get('eventForm').handlers.input({ target: field });
  });
  await elements.get('publishButton').handlers.click();

  assert.equal(saved.length, 1, elements.get('status').textContent);
  const request = JSON.parse(saved[0].options.body);
  const bytes = Uint8Array.from(atob(request.content), (character) => character.charCodeAt(0));
  const savedEvent = JSON.parse(new TextDecoder().decode(bytes)).events[0];
  assert.equal(savedEvent.eventType, 'wedding');
  Object.entries(values).forEach(([name, value]) => assert.equal(savedEvent[name], value));
});

test('admin rejects unsafe links in structured wedding fields', async () => {
  const data = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Abdelrahman & Omnia',
      preEventLocationUrl: 'javascript:alert(1)'
    }]
  };
  const storage = new Map([['invitation.github.publish-token', 'fine-grained-test-token']]);
  const { elements, saved } = await loadAdmin(data, storage);

  await elements.get('publishButton').handlers.click();

  assert.equal(saved.length, 0);
  assert.match(elements.get('status').textContent, /valid HTTPS links/);
});

test('admin uploads a custom song with the invitation', async () => {
  const data = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Sara & Ahmed',
      etiquette: [],
      env: 'garden'
    }]
  };
  const storage = new Map([['invitation.github.publish-token', 'fine-grained-test-token']]);
  const { elements, saved, uploaded } = await loadAdmin(data, storage);
  const musicUpload = elements.get('musicUpload');
  musicUpload.files = [{
    type: 'audio/mpeg',
    size: 5,
    arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4, 5]).buffer
  }];
  musicUpload.handlers.change({ target: musicUpload });
  await elements.get('publishButton').handlers.click();

  assert.equal(uploaded.length, 1);
  assert.match(uploaded[0].url, /\/contents\/music\/wedding-/);
  assert.equal(saved.length, 1, elements.get('status').textContent);
  const request = JSON.parse(saved[0].options.body);
  const bytes = Uint8Array.from(atob(request.content), (character) => character.charCodeAt(0));
  const savedEvent = JSON.parse(new TextDecoder().decode(bytes)).events[0];
  assert.match(savedEvent.musicUrl, /^music\/wedding-[a-z0-9]+\.mp3$/);
});

test('admin flags video-page links and blocks publishing them as audio', async () => {
  const data = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Sara & Ahmed',
      musicUrl: 'https://www.youtube.com/watch?v=PJrfUKDy3E4',
      env: 'garden'
    }]
  };
  const storage = new Map([['invitation.github.publish-token', 'fine-grained-test-token']]);
  const { elements, saved } = await loadAdmin(data, storage);

  assert.match(elements.get('musicStatus').textContent, /cannot be played as audio only/);
  await elements.get('publishButton').handlers.click();

  assert.equal(saved.length, 0);
  assert.match(elements.get('status').textContent, /Video-page links cannot be used/);
});
