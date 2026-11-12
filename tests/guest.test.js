const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const guestSource = fs.readFileSync(path.join(__dirname, '..', 'guest.js'), 'utf8');
const guestHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function makeNode(id) {
  const attributes = {};
  const classes = new Set();
  return {
    id,
    children: [],
    hidden: false,
    disabled: false,
    paused: true,
    muted: false,
    textContent: '',
    innerHTML: '',
    href: '',
    src: '',
    alt: '',
    handlers: {},
    attributes,
    playAttempts: 0,
    style: {
      properties: {},
      setProperty(name, value) { this.properties[name] = value; }
    },
    classList: {
      add(name) { classes.add(name); },
      contains(name) { return classes.has(name); }
    },
    addEventListener(name, handler) { this.handlers[name] = handler; },
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) { return attributes[name] || null; },
    removeAttribute(name) { delete attributes[name]; this[name] = ''; },
    load() {},
    play() {
      this.playAttempts++;
      this.paused = false;
      return Promise.resolve();
    },
    pause() { this.paused = true; }
  };
}

async function loadGuest(search, data) {
  const elements = new Map();
  const timers = [];
  function getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeNode(id));
    return elements.get(id);
  }
  const corners = ['tl', 'tr', 'bl', 'br'].map((name) => makeNode(name));
  const document = {
    title: 'Wedding invitation',
    documentElement: { style: makeNode('root').style },
    getElementById,
    querySelectorAll(selector) { return selector === '.corner' ? corners : []; }
  };
  const location = {
    search,
    hash: '',
    href: 'https://ahmedadelabosaif.github.io/invitation/',
    origin: 'https://ahmedadelabosaif.github.io'
  };
  const window = {
    setInterval() {},
    setTimeout(callback) { timers.push(callback); },
    addEventListener() {}
  };
  vm.runInNewContext(guestSource, {
    document,
    location,
    window,
    URL,
    URLSearchParams,
    Date,
    Math,
    Intl,
    encodeURIComponent,
    fetch: async () => ({ ok: true, json: async () => data })
  });
  await new Promise(setImmediate);
  elements.document = document;
  elements.corners = corners;
  elements.timers = timers;
  return elements;
}

test('public page uses only the attached Arabic invitation layout', () => {
  for (const id of [
    'cover', 'poem', 'wreath', 'verseSec', 'hennaSec', 'lunchSec', 'cdD',
    'mapBtn', 'katb', 'cardsSec', 'snd'
  ]) {
    assert.match(guestHtml, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(guestHtml, /تخصيص الدعوة|id="fab"|id="panel"|id="more"/);
  assert.doesNotMatch(guestHtml, /layout-config\.js|invitationContent|Guest etiquette/);
});

test('renders names, copy, date, and Arabic calendar link from the selected event', async () => {
  const data = {
    featured: 'wedding',
    events: [
      { id: 'wedding', groomName: 'أحمد', brideName: 'أمينة', date: '2027-05-27', time: '20:00', venue: 'City Hall' },
      { id: 'party', groomName: 'علي', brideName: 'نور', date: '2027-06-03', kicker: 'حفلة' }
    ]
  };
  const elements = await loadGuest('?event=party', data);

  assert.equal(elements.get('groom').textContent, 'علي');
  assert.equal(elements.get('bride').textContent, 'نور');
  assert.equal(elements.get('heading').textContent, 'حفلة');
  assert.equal(elements.get('dWeek').textContent, 'الخميس');
  assert.equal(elements.get('dDay').textContent, '٣');
  assert.equal(elements.get('dMonth').textContent, 'يونيو');
  assert.equal(elements.get('dYear').textContent, '٢٠٢٧');
  assert.equal(elements.get('calBtn').hidden, false);
  assert.match(elements.get('calBtn').href, /20270603T000000/);
  assert.equal(elements.get('verseSec').hidden, false);
  assert.equal(elements.document.title, 'دعوة زفاف علي ونور');
  assert.ok(elements.get('wreath').innerHTML.includes('<path'));
  assert.equal(elements.corners.length, 4);
});

test('falls back to legacy couple names and keeps invitation content as text', async () => {
  const data = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: '<script>Ahmed & Amina</script>',
      message: '<img src=x onerror=alert(1)>',
      date: '2027-06-12'
    }]
  };
  const elements = await loadGuest('', data);

  assert.equal(elements.get('groom').textContent, '<script>Ahmed');
  assert.equal(elements.get('bride').textContent, 'Amina</script>');
  assert.equal(elements.get('invite').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(elements.get('invite').innerHTML, '');
});

test('shows only enabled wedding sections and respects the verse toggle', async () => {
  const data = {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      eventType: 'wedding',
      groomName: 'Omar',
      brideName: 'Amina',
      showVerse: false,
      showHenna: true,
      showPrivacy: true,
      privacyText: 'No photos, please',
      showLunch: true,
      lunchTitle: 'غداء العائلة',
      lunchDate: '2027-05-26',
      lunchPlace: 'منزل العائلة',
      lunchTime: 'بعد الظهر',
      showKatb: true,
      katbText: 'الحمد لله',
      showParents: true,
      groomFather: 'الأستاذ رضا',
      brideFather: 'الأستاذ ياسر',
      parentsInviteText: 'يتشرفان بدعوتكم',
      poem: 'أبيات الدعوة',
      hennaDate: '2027-05-25',
      hennaTime: '19:00',
      hennaPlace: 'في المنزل',
      hennaNote: 'الدعوة خاصة',
      hennaVerse: 'أبيات الحنة',
      countdownNote: 'لحد ما نشوفكم',
      closing: 'دمتم لنا فرحة'
    }]
  };
  const elements = await loadGuest('', data);

  assert.equal(elements.get('verseSec').hidden, true);
  assert.equal(elements.get('hennaSec').hidden, false);
  assert.equal(elements.get('privacy').hidden, false);
  assert.equal(elements.get('lunchSec').hidden, false);
  assert.equal(elements.get('katb').hidden, false);
  assert.equal(elements.get('cardsSec').hidden, false);
  assert.equal(elements.get('poem').textContent, 'أبيات الدعوة');
  assert.equal(elements.get('parentsInviteText').textContent, 'يتشرفان بدعوتكم');
  assert.equal(elements.get('hennaPlace').textContent, 'في المنزل');
  assert.equal(elements.get('lunchTitle').textContent, 'غداء العائلة');
  assert.equal(elements.get('katbText').textContent, 'الحمد لله');
  assert.equal(elements.get('closing').textContent, 'دمتم لنا فرحة');
});

test('hides optional sections when they are not selected', async () => {
  const elements = await loadGuest('', {
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Amina & Omar', showHenna: false, showLunch: false, showKatb: false, showParents: false }]
  });

  for (const id of ['hennaSec', 'lunchSec', 'katb', 'cardsSec']) assert.equal(elements.get(id).hidden, true);
  assert.equal(elements.get('verseSec').hidden, false);
});

test('only safe map and image URLs become clickable or loadable', async () => {
  const unsafe = await loadGuest('', {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Sara & Ahmed',
      locationUrl: 'javascript:alert(1)',
      contractImageUrl: 'javascript:alert(1)',
      showKatb: true
    }]
  });
  assert.equal(unsafe.get('mapBtn').hidden, true);
  assert.equal(unsafe.get('katbImg').hidden, true);

  const safe = await loadGuest('', {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Sara & Ahmed',
      venue: 'Hall',
      locationUrl: 'https://maps.example.test/hall',
      contractImageUrl: 'https://images.example.test/katb.jpg',
      contractImageCaption: 'Our contract',
      showKatb: true
    }]
  });
  assert.equal(safe.get('mapBtn').hidden, false);
  assert.equal(safe.get('mapBtn').href, 'https://maps.example.test/hall');
  assert.equal(safe.get('katbImg').hidden, false);
  assert.equal(safe.get('katbImg').src, 'https://images.example.test/katb.jpg');
});

test('applies custom colors and Arabic countdown styling values', async () => {
  const elements = await loadGuest('', {
    featured: 'wedding',
    events: [{
      id: 'wedding',
      names: 'Omar & Amina',
      date: '2027-05-27',
      customBackgroundColor: '#fefefe',
      customAccentColor: '#123456'
    }]
  });

  assert.equal(elements.document.documentElement.style.properties['--bg'], '#fefefe');
  assert.equal(elements.document.documentElement.style.properties['--gold'], '#123456');
  assert.match(elements.get('cdD').textContent, /^[٠-٩]+$/);
});

test('opens the curtain and offers one mute toggle for the soundtrack', async () => {
  const elements = await loadGuest('', {
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Omar & Amina', musicTrack: 'beethovenAdagio' }]
  });
  const cover = elements.get('cover');
  const sound = elements.get('snd');
  const audio = elements.get('backgroundMusic');

  assert.equal(audio.src, 'https://upload.wikimedia.org/wikipedia/commons/6/63/Beethoven%2C_Sonata_No._8_in_C_Minor_Pathetique%2C_Op._13_-_II._Adagio_cantabile.ogg');
  cover.handlers.click();
  assert.equal(cover.classList.contains('open'), true);
  elements.timers[0]();
  await new Promise(setImmediate);
  assert.equal(audio.playAttempts, 1);

  sound.handlers.click();
  assert.equal(audio.muted, true);
  assert.equal(sound.textContent, '🔇');
  assert.equal(sound.getAttribute('aria-pressed'), 'true');
  sound.handlers.click();
  assert.equal(audio.muted, false);
});

test('blocks unsafe audio sources', async () => {
  const elements = await loadGuest('', {
    featured: 'wedding',
    events: [{ id: 'wedding', names: 'Omar & Amina', musicUrl: 'javascript:alert(1)' }]
  });

  assert.equal(elements.get('backgroundMusic').src, '');
});
