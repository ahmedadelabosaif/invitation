const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const guestSource = fs.readFileSync(path.join(__dirname, '..', 'guest.js'), 'utf8');

async function loadGuest(search, data, blockFirstPlay = false) {
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
        playAttempts: 0,
        contentWindow: { messages: [], postMessage(message, origin) { this.messages.push({ message, origin }); } },
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
        play() {
          this.playAttempts++;
          if (blockFirstPlay && this.id === 'backgroundMusic' && this.playAttempts === 1) {
            return Promise.reject(new Error('Autoplay blocked'));
          }
          this.paused = false;
          if (this.handlers.play) this.handlers.play();
          return Promise.resolve();
        },
        pause() { this.paused = true; if (this.handlers.pause) this.handlers.pause(); }
      });
    }
    return elements.get(id);
  }
  const document = {
    title: 'Wedding invitation',
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
    location: {
      search,
      hash: '',
      href: 'https://ahmedadelabosaif.github.io/invitation/',
      origin: 'https://ahmedadelabosaif.github.io'
    },
    URLSearchParams,
    URL,
    Date,
    Math,
    encodeURIComponent,
    fetch: async () => ({ ok: true, json: async () => data }),
    window: { setInterval() {}, addEventListener() {} }
  });
  await new Promise(setImmediate);
  elements.document = document;
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

test('personalizes the browser title from the invitation names', async () => {
  const eventData = {
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Ahmed & Amina' }]
  };
  const elements = await loadGuest('', eventData);

  assert.equal(elements.document.title, "Ahmed & Amina's wedding invitation");
});

test('shows an optional intro description beneath the invitation intro', async () => {
  const withIntroDescription = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Ahmed & Amina',
      kicker: 'You are invited',
      introDescription: 'With our families, we invite you to celebrate this special day.'
    }]
  };
  const elements = await loadGuest('', withIntroDescription);

  assert.equal(elements.get('kicker').textContent, 'You are invited');
  assert.equal(elements.get('introDescription').textContent, withIntroDescription.events[0].introDescription);
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
  assert.equal(elements.get('themeMark').hidden, false);
  assert.match(elements.get('decor').className, /islamic-decor/);
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

test('autoplays a full-page invitation soundtrack and lets guests mute and unmute', async () => {
  const withMedia = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Amina & Omar',
      backgroundImage: 'images/wedding.jpg',
      backgroundMode: 'full',
      musicTrack: 'beethovenAdagio',
      env: 'garden'
    }]
  };
  const elements = await loadGuest('', withMedia);
  const backdrop = elements.get('pageBackdrop');
  const audio = elements.get('backgroundMusic');

  assert.equal(backdrop.hidden, false);
  assert.match(elements.get('pageBackgroundImage').src, /images\/wedding\.jpg/);
  assert.equal(elements.get('musicControls').hidden, false);
  assert.equal(audio.src, 'https://upload.wikimedia.org/wikipedia/commons/6/63/Beethoven%2C_Sonata_No._8_in_C_Minor_Pathetique%2C_Op._13_-_II._Adagio_cantabile.ogg');
  assert.equal(audio.paused, false);
  assert.match(elements.get('musicToggle').textContent, /Mute music/);

  elements.get('musicToggle').handlers.click();
  assert.equal(audio.muted, true);
  assert.match(elements.get('musicToggle').textContent, /Unmute music/);
  assert.equal(audio.paused, false);

  elements.get('musicToggle').handlers.click();
  assert.equal(audio.muted, false);
  assert.equal(audio.paused, false);

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
  assert.match(cardImage.get('cardBackground').src, /images\/wedding\.jpg/);
});

test('offers play control when browser blocks automatic music playback', async () => {
  const withMusic = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Amina & Omar',
      musicTrack: 'beethovenAdagio',
      env: 'garden'
    }]
  };
  const elements = await loadGuest('', withMusic, true);

  assert.equal(elements.get('backgroundMusic').paused, true);
  assert.match(elements.get('musicToggle').textContent, /Play music/);
  assert.match(elements.get('notice').textContent, /Tap Play music/);

  elements.get('musicToggle').handlers.click();
  await new Promise(setImmediate);
  assert.equal(elements.get('backgroundMusic').paused, false);
  assert.match(elements.get('musicToggle').textContent, /Mute music/);
});

test('renders a selected background design and music preset', async () => {
  const withPresets = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Amina & Omar',
      backgroundPreset: 'goldenArch',
      backgroundMode: 'full',
      musicTrack: 'chopinRomance',
      env: 'garden'
    }]
  };
  const elements = await loadGuest('', withPresets);

  assert.equal(elements.get('pageBackdrop').hidden, false);
  assert.match(elements.get('pageBackgroundImage').src, /golden-arch\.svg/);
  assert.equal(elements.get('musicControls').hidden, false);
  assert.match(elements.get('backgroundMusic').src, /Chopin_-_Piano_Concerto/);
});

test('does not render a video player or play a video-page URL as audio', async () => {
  const withYoutube = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Amina & Omar',
      musicUrl: 'https://www.youtube.com/watch?v=PJrfUKDy3E4',
      env: 'garden'
    }]
  };
  const elements = await loadGuest('', withYoutube);

  assert.equal(elements.get('musicControls').hidden, true);
  assert.ok(!elements.get('backgroundMusic').src);
});

test('shows selected card background designs in a visible image layer', async () => {
  const withBackground = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Amina & Omar',
      backgroundPreset: 'roseGarden',
      backgroundMode: 'card',
      env: 'garden'
    }]
  };
  const elements = await loadGuest('', withBackground);

  assert.equal(elements.get('cardBackground').hidden, false);
  assert.match(elements.get('cardBackground').src, /rose-garden\.svg/);
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
