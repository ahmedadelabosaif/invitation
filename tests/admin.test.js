const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { TextDecoder, TextEncoder } = require('node:util');
const vm = require('node:vm');

const layoutConfigSource = fs.readFileSync(path.join(__dirname, '..', 'layout-config.js'), 'utf8');
const adminSource = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const guestHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function makeNode(id) {
  const attributes = {};
  return {
    id,
    children: [],
    parentNode: null,
    hidden: false,
    disabled: false,
    textContent: '',
    value: '',
    files: [],
    style: {
      properties: {},
      setProperty(name, value) { this.properties[name] = value; }
    },
    dataset: {},
    handlers: {},
    addEventListener(name, handler) { this.handlers[name] = handler; },
    appendChild(child) {
      if (child.parentNode) {
        child.parentNode.children = child.parentNode.children.filter((item) => item !== child);
      }
      this.children.push(child);
      child.parentNode = this;
    },
    replaceChildren() { this.children = []; },
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) { return attributes[name] || null; },
    removeAttribute(name) { delete attributes[name]; },
    getBoundingClientRect() { return { top: 0, height: 100 }; },
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
    'message', 'info', 'event', 'env', 'typography', 'religiousOpening', 'quranVerse', 'quranReference',
    'hostNames', 'groomTitle', 'groomName', 'brideTitle', 'brideName', 'preEventTitle',
    'preEventDate', 'preEventTime', 'preEventVenue', 'preEventLocationUrl',
    'preEventDetails', 'contractImageUrl', 'contractImageCaption', 'backgroundMode',
    'backgroundPreset', 'musicTrack', 'musicUrl', 'poem', 'inviteNames', 'groomFull',
    'brideFull', 'groomFather', 'brideFather', 'venueAddress', 'hennaDate', 'hennaTime',
    'hennaPlace', 'hennaNote', 'hennaVerse', 'privacyText', 'lunchTitle', 'lunchDate',
    'lunchPlace', 'lunchTime', 'katbText', 'parentsInviteText', 'customBackgroundColor', 'customAccentColor',
    'countdownNote', 'closing', 'showParents', 'showVerse', 'showHenna', 'showPrivacy',
    'showLunch', 'showKatb'
  ]
    .map(function (name) {
      const field = makeNode(name);
      field.name = name;
      if (['env', 'typography', 'backgroundPreset', 'backgroundMode', 'musicTrack'].includes(name)) {
        field.tagName = 'SELECT';
      }
      if (name.startsWith('show')) field.type = 'checkbox';
      if (name.startsWith('custom') && name.endsWith('Color')) field.type = 'color';
      if ([
        'names', 'kicker', 'introDescription', 'venue', 'message', 'info', 'event',
        'religiousOpening', 'quranVerse', 'quranReference', 'hostNames', 'groomTitle',
        'groomName', 'brideTitle', 'brideName', 'preEventTitle', 'preEventTime',
        'preEventVenue', 'preEventDetails', 'contractImageCaption', 'poem', 'inviteNames',
        'groomFull', 'brideFull', 'groomFather', 'brideFather', 'venueAddress',
        'hennaPlace', 'hennaNote', 'hennaVerse', 'privacyText', 'lunchTitle', 'lunchPlace',
        'lunchTime', 'katbText', 'parentsInviteText', 'countdownNote', 'closing'
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
  const context = {
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
  };
  vm.runInNewContext(layoutConfigSource, context);
  vm.runInNewContext(adminSource, context);
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

test('editor keeps Editing and Review visible in side-by-side columns', () => {
  assert.doesNotMatch(adminHtml, /id="previewPanel"/);
  assert.doesNotMatch(adminHtml, /id="previewButton"/);
  assert.doesNotMatch(adminHtml, /role="tablist"|id="editingTab"|id="reviewTab"/);
  assert.match(adminHtml, /\.workspace\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(adminHtml, /<section class="panel editor-panel" id="editingPanel">/);
  assert.match(adminHtml, /<aside class="panel design-panel" id="reviewPanel">/);
  assert.match(adminHtml, /@media\(max-width:900px\)\{\.workspace\{grid-template-columns:minmax\(0,1fr\)\}/);
  const review = adminHtml.match(/<aside class="panel design-panel" id="reviewPanel">([\s\S]*?)<\/aside>/);
  assert.ok(review);
  assert.doesNotMatch(review[1], /typography|font|Text color/i);
});

test('editing form groups optional fields into collapsible sections', () => {
  assert.match(adminHtml, /<details class="form-section" open>\s*<summary>The essentials<\/summary>/);
  assert.match(adminHtml, /Couple’s names<textarea name="names"/);
  assert.match(adminHtml, /<summary>Personal touches \(optional\)<\/summary>/);
  assert.match(adminHtml, /<details id="weddingFields" class="form-section wide">[\s\S]*?<summary>Wedding details \(optional\)<\/summary>/);
  assert.match(adminHtml, /<summary>Background and music \(optional\)<\/summary>/);
  assert.match(adminHtml, /<summary>Guest etiquette \(optional\)<\/summary>/);
});

test('event selector is a separate workspace bar and is not placed in the page header', () => {
  const header = adminHtml.match(/<header>([\s\S]*?)<\/header>/);
  assert.ok(header);
  assert.doesNotMatch(header[1], /id="eventList"|id="addEvent"/);
  assert.match(adminHtml, /<section class="panel events-panel" aria-label="Events">[\s\S]*id="eventList"[\s\S]*id="addEvent"[\s\S]*id="newEventPanel"/);
  assert.match(adminHtml, /<section class="panel events-panel"[\s\S]*?<\/section>\s*<div class="layout">/);
});

test('the main invitation cannot be deleted accidentally', async () => {
  const data = {
    featured: 'wedding',
    events: [
      { id: 'wedding', names: 'Amina & Omar' },
      { id: 'engagement', names: 'Engagement' }
    ]
  };
  const { elements } = await loadAdmin(data);

  assert.equal(elements.get('deleteEvent').disabled, true);
  assert.match(elements.get('deleteEventNote').textContent, /main invitation is protected/i);
  elements.get('deleteEvent').handlers.click();

  assert.equal(data.events.length, 2);
  assert.equal(data.events[0].id, 'wedding');
});

test('shared layout and curated typography presets stay aligned across pages', async () => {
  const layoutWindow = {};
  vm.runInNewContext(layoutConfigSource, { window: layoutWindow });

  for (const key of layoutWindow.InvitationLayout.keys) {
    assert.match(adminHtml, new RegExp(`id="layout-${key}"`), `admin preview is missing ${key}`);
    assert.match(
      adminHtml,
      new RegExp(`id="layout-${key}"[^>]*data-layout-item="${key}"[^>]*draggable="true"`),
      `admin preview section ${key} is not draggable`
    );
    assert.match(guestHtml, new RegExp(`id="layout-${key}"`), `guest page is missing ${key}`);
  }
  assert.doesNotMatch(adminHtml, /fieldStyleControls-|Style [^<]+<\/summary>/);
  assert.match(adminHtml, /<select name="typography">[\s\S]*Elegant serif[\s\S]*Classic[\s\S]*Modern sans-serif/);
  assert.ok(adminHtml.indexOf('layout-config.js') < adminHtml.indexOf('admin.js'));
  assert.ok(guestHtml.indexOf('layout-config.js') < guestHtml.indexOf('guest.js'));

  const { elements, fields } = await loadAdmin({
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Sara & Ahmed' }]
  });
  assert.equal(elements.get('layoutOrder').children.length, layoutWindow.InvitationLayout.keys.length);
  assert.equal(fields.find((field) => field.name === 'typography').value, '');
});

test('live review supports drag-and-drop and one typography preset styles every section', async () => {
  const data = {
    featured: 'wedding',
    events: [{ id: 'wedding', eventType: 'wedding', names: 'Sara & Ahmed', env: 'garden' }]
  };
  const { elements, fields, saved } = await loadAdmin(data, new Map([
    ['invitation.github.publish-token', 'fine-grained-test-token']
  ]));

  const message = elements.get('layout-message');
  const venue = elements.get('layout-venue');
  message.setAttribute('data-layout-item', 'message');
  venue.setAttribute('data-layout-item', 'venue');
  elements.get('designCanvas').handlers.dragstart({ target: message });
  let prevented = false;
  elements.get('designCanvas').handlers.drop({
    target: venue,
    clientY: 90,
    preventDefault() { prevented = true; }
  });

  assert.equal(prevented, true);
  assert.equal(message.getAttribute('aria-grabbed'), 'false');
  assert.equal(data.events[0].layout.indexOf('message'), data.events[0].layout.indexOf('venue') + 1);
  const previewOrder = elements.get('designCanvas').children.map((item) => item.id);
  assert.equal(previewOrder.indexOf('layout-message'), previewOrder.indexOf('layout-venue') + 1);
  let keyboardPrevented = false;
  elements.get('designCanvas').handlers.keydown({
    target: message,
    key: 'ArrowDown',
    preventDefault() { keyboardPrevented = true; }
  });
  assert.equal(keyboardPrevented, true);
  assert.equal(data.events[0].layout.indexOf('message'), data.events[0].layout.indexOf('info') + 1);
  const firstLayoutRow = elements.get('layoutOrder').children[0];
  firstLayoutRow.children[2].handlers.click();
  assert.equal(data.events[0].layout[0], 'weddingOpening');
  assert.equal(data.events[0].layout[1], 'emoji');

  const typography = fields.find((field) => field.name === 'typography');
  typography.value = 'modern';
  elements.get('eventForm').handlers.change({ target: typography });

  assert.equal(data.events[0].typography, 'modern');
  for (const key of ['message', 'names', 'venue', 'date']) {
    assert.equal(
      elements.get('layout-' + key).style.fontFamily,
      'Karla, system-ui, sans-serif',
      `${key} should use the global typography preset`
    );
  }

  await elements.get('publishButton').handlers.click();
  const request = JSON.parse(saved[0].options.body);
  const bytes = Uint8Array.from(atob(request.content), (character) => character.charCodeAt(0));
  const published = JSON.parse(new TextDecoder().decode(bytes));
  assert.equal(JSON.stringify(published.events[0].layout), JSON.stringify(data.events[0].layout));
  assert.equal(published.events[0].typography, 'modern');
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

test('editing changes appear immediately in the always-visible review', async () => {
  const data = {
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Birthday', message: 'Before', eventType: 'birthday' }]
  };
  const { elements, fields } = await loadAdmin(data);
  const message = fields.find((field) => field.name === 'message');

  message.value = 'After';
  elements.get('eventForm').handlers.input({ target: message });

  assert.equal(data.events[0].message, 'After');
  assert.equal(elements.get('canvas-message').innerHTML, 'After');
});

test('shows the parchment and olive theme in the live editor preview', async () => {
  const data = {
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Amina & Omar', env: 'arabesque' }]
  };
  const { elements } = await loadAdmin(data);

  assert.equal(elements.get('designCanvas').getAttribute('data-env'), 'arabesque');
});

test('shows the plum and rose gold theme in the live editor preview', async () => {
  const data = {
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Amina & Omar', env: 'plum' }]
  };
  const { elements } = await loadAdmin(data);

  assert.equal(elements.get('designCanvas').getAttribute('data-env'), 'plum');
});

test('admin publishes reference wedding sections and custom invitation colors', async () => {
  const data = {
    featured: 'wedding',
    events: [{ id: 'wedding', eventType: 'wedding', names: 'Amina & Omar', env: 'garden' }]
  };
  const { elements, fields, saved } = await loadAdmin(data, new Map([
    ['invitation.github.publish-token', 'fine-grained-test-token']
  ]));
  const values = {
    poem: 'A line for the couple',
    groomFather: 'Groom’s father',
    brideFather: 'Bride’s father',
    parentsInviteText: 'We are honored to invite you',
    hennaDate: '2027-05-25',
    hennaPlace: 'Family home',
    lunchTitle: 'Wedding lunch',
    lunchDate: '2027-05-26',
    lunchPlace: 'Garden',
    katbText: 'Alhamdulillah',
    countdownNote: 'Until we celebrate together',
    closing: 'We look forward to seeing you'
  };
  Object.entries(values).forEach(([name, value]) => {
    const field = fields.find((item) => item.name === name);
    field.value = value;
    elements.get('eventForm').handlers.input({ target: field });
  });
  for (const name of ['showParents', 'showHenna', 'showPrivacy', 'showLunch', 'showKatb']) {
    const field = fields.find((item) => item.name === name);
    field.checked = true;
    elements.get('eventForm').handlers.change({ target: field });
  }
  const color = fields.find((item) => item.name === 'customAccentColor');
  color.value = '#123456';
  elements.get('eventForm').handlers.input({ target: color });

  assert.equal(elements.get('layout-henna').hidden, false);
  assert.equal(elements.get('layout-lunch').hidden, false);
  assert.equal(elements.get('layout-katb').hidden, false);
  assert.equal(elements.get('layout-parents').hidden, false);
  assert.equal(elements.get('designCanvas').style.properties['--canvas-accent'], '#123456');
  await elements.get('publishButton').handlers.click();

  const request = JSON.parse(saved[0].options.body);
  const bytes = Uint8Array.from(atob(request.content), (character) => character.charCodeAt(0));
  const published = JSON.parse(new TextDecoder().decode(bytes)).events[0];
  Object.entries(values).forEach(([name, value]) => assert.equal(published[name], value));
  for (const name of ['showParents', 'showHenna', 'showPrivacy', 'showLunch', 'showKatb']) {
    assert.equal(published[name], true);
  }
  assert.equal(published.customAccentColor, '#123456');
});

test('admin uploads the marriage-contract photo with the invitation', async () => {
  const data = {
    featured: 'wedding',
    events: [{ id: 'wedding', eventType: 'wedding', names: 'Amina & Omar' }]
  };
  const storage = new Map([['invitation.github.publish-token', 'fine-grained-test-token']]);
  const { elements, saved, uploaded } = await loadAdmin(data, storage);
  const photoUpload = elements.get('contractImageUpload');
  photoUpload.files = [{ name: 'contract.png', type: 'image/png', size: 100 }];

  await photoUpload.handlers.change({ target: photoUpload });
  await elements.get('publishButton').handlers.click();

  assert.equal(uploaded.length, 1);
  assert.match(uploaded[0].url, /\/contents\/images\/wedding-contract-/);
  assert.equal(saved.length, 1, elements.get('status').textContent);
  const request = JSON.parse(saved[0].options.body);
  const bytes = Uint8Array.from(atob(request.content), (character) => character.charCodeAt(0));
  const published = JSON.parse(new TextDecoder().decode(bytes)).events[0];
  assert.match(published.contractImageUrl, /^images\/wedding-contract-[a-z0-9]+\.jpg$/);
  assert.equal(published.showKatb, true);
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
