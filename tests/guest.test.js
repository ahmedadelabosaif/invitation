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
        disabled: false,
        paused: true,
        muted: false,
        textContent: '',
        innerHTML: '',
        href: '',
        className: '',
        attributes: {},
        handlers: {},
        style: {
          properties: {},
          setProperty(name, value) { this.properties[name] = value; }
        },
        addEventListener(name, handler) { this.handlers[name] = handler; },
        replaceChildren() { this.children = []; },
        removeAttribute(name) { delete this.attributes[name]; this[name] = ''; },
        setAttribute(name, value) { this.attributes[name] = value; },
        appendChild(child) { this.children.push(child); },
        append(...children) { this.children.push(...children); },
        load() {},
        play() { this.paused = false; if (this.handlers.play) this.handlers.play(); return Promise.resolve(); },
        pause() { this.paused = true; if (this.handlers.pause) this.handlers.pause(); }
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
    location: { search, hash: '', href: 'https://ahmedadelabosaif.github.io/invitation/' },
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
  assert.equal(elements.get('musicControls').hidden, true);
  assert.equal(elements.get('pageBackdrop').hidden, true);
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

test('shows a full-page image and lets guests play, pause, and mute music', async () => {
  const withMedia = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Amina & Omar',
      backgroundImage: 'images/wedding.jpg',
      backgroundMode: 'full',
      musicUrl: 'https://media.example.test/song.mp3',
      env: 'garden'
    }]
  };
  const elements = await loadGuest('', withMedia);
  const backdrop = elements.get('pageBackdrop');
  const audio = elements.get('backgroundMusic');

  assert.equal(backdrop.hidden, false);
  assert.match(backdrop.style.backgroundImage, /images\/wedding\.jpg/);
  assert.equal(elements.get('musicControls').hidden, false);
  assert.equal(audio.src, 'https://media.example.test/song.mp3');
  assert.equal(audio.paused, true);

  elements.get('musicPlay').handlers.click();
  await new Promise(setImmediate);
  assert.equal(audio.paused, false);
  assert.match(elements.get('musicPlay').textContent, /Pause/);

  elements.get('musicMute').handlers.click();
  assert.equal(audio.muted, true);
  assert.equal(elements.get('musicMute').textContent, 'Unmute');

  elements.get('musicPlay').handlers.click();
  assert.equal(audio.paused, true);

  const cardImage = await loadGuest('', {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Amina & Omar',
      backgroundImage: 'images/wedding.jpg',
      backgroundMode: 'card',
      env: 'garden'
    }]
  });
  assert.equal(cardImage.get('pageBackdrop').hidden, true);
  assert.match(cardImage.get('card').style.backgroundImage, /images\/wedding\.jpg/);
});

test('does not use unsafe background or audio URLs', async () => {
  const withUnsafeMedia = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Amina & Omar',
      backgroundImage: 'javascript:alert(1)',
      backgroundMode: 'full',
      musicUrl: 'javascript:alert(1)',
      env: 'garden'
    }]
  };
  const elements = await loadGuest('', withUnsafeMedia);

  assert.equal(elements.get('pageBackdrop').hidden, true);
  assert.equal(elements.get('musicControls').hidden, true);
});

test('shows the featured event and links to other events', async () => {
  const elements = await loadGuest('', invitations);
  const links = elements.get('more').children.slice(1);

  assert.equal(elements.get('names').textContent, 'Sara & Ahmed');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, '?event=party');
});
