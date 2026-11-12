(function () {
  var MUSIC_TRACKS = {
    beethovenAdagio: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Beethoven%2C_Sonata_No._8_in_C_Minor_Pathetique%2C_Op._13_-_II._Adagio_cantabile.ogg',
    beethovenVariations: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Beethoven_-_32_Variations_in_C_Minor%2C_WoO_80.ogg',
    chopinRomance: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Chopin_-_Piano_Concerto_no._1%2C_Op._11_%28string_quartet%29-2.ogg',
    beethovenHammerklavier: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Beethoven%2C_Piano_Sonata_No._29_in_B-flat_Major,_Op._106_Hammerklavier_-_III._Adagio_sostenuto.ogg'
  };
  var $ = function (id) { return document.getElementById(id); };
  var invitationData = null;
  var currentEvent = null;
  var startDate = null;
  var audioContext = null;
  var masterGain = null;
  var ambientGain = null;
  var ambientOn = false;
  var opened = false;
  var muted = false;
  var musicUrl = '';
  function safeLocationUrl(value) {
    if (!value) return '';
    try {
      var url = new URL(value, location.href);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function safeMediaUrl(value) {
    if (!value) return '';
    try {
      var url = new URL(value, location.href);
      return url.protocol === 'https:' ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function selectedEventId() {
    return new URLSearchParams(location.search).get('event') || location.hash.slice(1);
  }

  function coupleNames(event) {
    var groom = event.groomName || '';
    var bride = event.brideName || '';
    if ((!groom || !bride) && event.names) {
      var parts = event.names.split(/\s*&\s*/);
      if (!groom) groom = parts[0] || '';
      if (!bride && parts.length > 1) bride = parts.slice(1).join(' & ');
    }
    return { groom: groom, bride: bride };
  }

  function dateParts(value) {
    if (!value) return { weekday: '', day: '', month: '', year: '' };
    var date = new Date(value + 'T12:00:00Z');
    return {
      weekday: new Intl.DateTimeFormat('ar-EG', { timeZone: 'UTC', weekday: 'long' }).format(date),
      day: new Intl.DateTimeFormat('ar-EG', { timeZone: 'UTC', day: 'numeric' }).format(date),
      month: new Intl.DateTimeFormat('ar-EG', { timeZone: 'UTC', month: 'long' }).format(date),
      year: new Intl.DateTimeFormat('ar-EG', { timeZone: 'UTC', year: 'numeric' }).format(date)
    };
  }

  function eventDate() {
    if (!currentEvent.date) return null;
    var parts = currentEvent.date.split('-').map(Number);
    var time = (currentEvent.time || '00:00').split(':').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], time[0] || 0, time[1] || 0);
  }

  function calendarTime(date) {
    function pad(value) { return String(value).padStart(2, '0'); }
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) +
      'T' + pad(date.getHours()) + pad(date.getMinutes()) + '00';
  }

  function setText(id, value) {
    $(id).textContent = value || '';
  }

  function setColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  }

  function updateColors(event) {
    var background = setColor(event.customBackgroundColor, '#fbfaf4');
    var accent = setColor(event.customAccentColor, '#3d5a2e');
    var channels = [1, 3, 5].map(function (index) {
      return parseInt(background.slice(index, index + 2), 16);
    });
    var light = '#' + channels.map(function (channel) {
      return ('0' + Math.round(channel + (255 - channel) * .12).toString(16)).slice(-2);
    }).join('');
    var root = document.documentElement.style;
    root.setProperty('--bg', background);
    root.setProperty('--bg2', light);
    root.setProperty('--gold', accent);
    root.setProperty('--line', accent + '59');
    root.setProperty('--card', accent + '0f');
    $('cover').style.setProperty('--gold', '#ecd9a6');
  }

  function renderDate(event, names) {
    var date = dateParts(event.date);
    setText('dWeek', date.weekday);
    setText('dDay', date.day);
    setText('dMonth', date.month);
    setText('dYear', date.year);
    setText('heroDate', [date.weekday, [date.day, date.month, date.year].filter(Boolean).join(' ')].filter(Boolean).join('\n'));
    setText('footDate', [date.weekday, date.day, date.month, date.year].filter(Boolean).join(' '));
    var mainTime = event.time
      ? new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' })
        .format(new Date('2000-01-01T' + event.time))
      : '';
    setText('dTime', mainTime);
    startDate = eventDate();
    $('calBtn').hidden = !startDate;
    if (startDate) {
      var end = new Date(startDate.getTime() + 4 * 60 * 60 * 1000);
      $('calBtn').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
        encodeURIComponent('زفاف ' + (event.groomFull || names.groom) + ' و' + (event.brideFull || names.bride)) +
        '&dates=' + calendarTime(startDate) + '/' + calendarTime(end) +
        '&location=' + encodeURIComponent(event.venue || '');
    }

    var lunchDate = dateParts(event.lunchDate);
    setText('lunchDate', event.lunchDate
      ? 'يوم ' + lunchDate.weekday + ' الموافق ' + lunchDate.day + ' ' + lunchDate.month + ' ' + lunchDate.year
      : '');
    var henna = dateParts(event.hennaDate);
    setText('hDate', event.hennaDate
      ? henna.weekday + '\n' + henna.day + ' ' + henna.month + ' ' + henna.year
      : '');
    setText('hTime', event.hennaTime
      ? 'الساعة ' + new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' })
        .format(new Date('2000-01-01T' + event.hennaTime))
      : '');
  }

  function renderSections(event) {
    var wedding = !event.eventType || event.eventType === 'wedding';
    $('verseSec').hidden = !wedding || event.showVerse === false;
    $('hennaSec').hidden = !wedding || event.showHenna !== true;
    $('privacy').hidden = !wedding || event.showHenna !== true ||
      event.showPrivacy !== true || !event.privacyText;
    $('lunchSec').hidden = !wedding || event.showLunch !== true;
    $('katb').hidden = !wedding || event.showKatb !== true;
    $('cardsSec').hidden = !wedding || event.showParents !== true;
  }

  function renderCalendarAndMap(event) {
    var map = safeLocationUrl(event.locationUrl);
    $('mapBtn').hidden = !map;
    if (map) $('mapBtn').href = map;
  }

  function renderImage(event) {
    var image = safeMediaUrl(event.contractImageUrl);
    $('katbImg').hidden = !image || event.showKatb === false;
    $('katbImg').src = image || '';
    $('katbImg').alt = event.contractImageCaption || 'وثيقة عقد القران';
  }

  function renderInvitation(event) {
    currentEvent = event;
    var names = coupleNames(event);
    var groomFull = event.groomFull || [event.groomTitle, names.groom].filter(Boolean).join(' ');
    var brideFull = event.brideFull || [event.brideTitle, names.bride].filter(Boolean).join(' ');
    setText('coverGroom', names.groom);
    setText('coverBride', names.bride);
    setText('groom', names.groom);
    setText('bride', names.bride);
    setText('footerGroom', names.groom);
    setText('footerBride', names.bride);
    setText('groomFull', groomFull);
    setText('brideFull', brideFull);
    setText('groomFather', event.groomFather);
    setText('brideFather', event.brideFather);
    setText('parentsInviteText', event.parentsInviteText || 'بدعوة سيادتكم لحضور حفل زفاف');
    setText('poem', event.poem);
    setText('verse', event.quranVerse);
    setText('verseRef', event.quranReference);
    setText('heading', event.kicker);
    setText('invite', event.message);
    setText('inviteNames', event.inviteNames || [groomFull, brideFull].filter(Boolean).join(' و '));
    setText('hennaBride', names.bride);
    setText('hennaVerse', event.hennaVerse);
    setText('hennaPlace', event.hennaPlace);
    setText('hennaNote', event.hennaNote);
    setText('privacyText', event.privacyText);
    setText('lunchTitle', event.lunchTitle);
    setText('lunchPlace', event.lunchPlace);
    setText('lunchTime', event.lunchTime);
    setText('cdNote', event.countdownNote);
    setText('venue', event.venue);
    setText('venueAddr', event.venueAddress);
    setText('katbText', event.katbText || event.contractImageCaption);
    setText('closing', event.closing);
    document.title = 'دعوة زفاف ' + [groomFull, brideFull].filter(Boolean).join(' و');
    updateColors(event);
    renderDate(event, names);
    renderSections(event);
    renderCalendarAndMap(event);
    renderImage(event);
    renderWreath();
    renderMusic(event);
  }

  function renderCountdown() {
    if (!startDate) {
      ['cdD', 'cdH', 'cdM', 'cdS'].forEach(function (id) { setText(id, '٠٠'); });
      return;
    }
    var remaining = Math.max(0, startDate.getTime() - Date.now());
    var formatter = new Intl.NumberFormat('ar-EG', { minimumIntegerDigits: 2, useGrouping: false });
    setText('cdD', formatter.format(Math.floor(remaining / 86400000)));
    setText('cdH', formatter.format(Math.floor(remaining / 3600000) % 24));
    setText('cdM', formatter.format(Math.floor(remaining / 60000) % 60));
    setText('cdS', formatter.format(Math.floor(remaining / 1000) % 60));
  }

  function createAudioContext() {
    if (!audioContext) {
      var Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      audioContext = new Context();
      masterGain = audioContext.createGain();
      masterGain.gain.value = muted ? 0 : .9;
      masterGain.connect(audioContext.destination);
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function playOpeningSound() {
    var context = createAudioContext();
    if (!context) return;
    var length = context.sampleRate * 2;
    var buffer = context.createBuffer(1, length, context.sampleRate);
    var samples = buffer.getChannelData(0);
    for (var index = 0; index < length; index++) samples[index] = Math.random() * 2 - 1;
    var source = context.createBufferSource();
    var filter = context.createBiquadFilter();
    var gain = context.createGain();
    var now = context.currentTime;
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.Q.value = .8;
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(1500, now + 1);
    filter.frequency.exponentialRampToValueAtTime(400, now + 1.8);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(.35, now + .45);
    gain.gain.linearRampToValueAtTime(0, now + 1.9);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
  }

  function playChime() {
    var context = createAudioContext();
    if (!context) return;
    [523.25, 659.25, 783.99, 1046.5].forEach(function (frequency, index) {
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      var time = context.currentTime + 1 + index * .16;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(.16, time + .02);
      gain.gain.exponentialRampToValueAtTime(.001, time + 1.8);
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start(time);
      oscillator.stop(time + 1.9);
    });
  }

  function playAmbientStep() {
    if (!ambientOn || !audioContext) return;
    var chords = [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]];
    var chord = chords[Math.floor(Date.now() / 5500) % chords.length];
    var now = audioContext.currentTime;
    chord.forEach(function (frequency) {
      [1, 1.003].forEach(function (detune, index) {
        var oscillator = audioContext.createOscillator();
        var gain = audioContext.createGain();
        oscillator.type = index ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency * detune;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(.035, now + 2);
        gain.gain.linearRampToValueAtTime(0, now + 5.2);
        oscillator.connect(gain);
        gain.connect(ambientGain);
        oscillator.start(now);
        oscillator.stop(now + 5.3);
      });
    });
    window.setTimeout(playAmbientStep, 5000);
  }

  function startAmbientMusic() {
    if (ambientOn) return;
    var context = createAudioContext();
    if (!context) return;
    ambientGain = context.createGain();
    ambientGain.gain.value = 1;
    ambientGain.connect(masterGain);
    ambientOn = true;
    playAmbientStep();
  }

  function updateSoundButton() {
    $('snd').textContent = muted ? '🔇' : '🔊';
    $('snd').setAttribute('aria-pressed', muted ? 'true' : 'false');
  }

  function renderMusic(event) {
    var directUrl = safeMediaUrl(event.musicUrl);
    var nextUrl = event.musicTrack && MUSIC_TRACKS[event.musicTrack]
      ? MUSIC_TRACKS[event.musicTrack]
      : directUrl;
    var audio = $('backgroundMusic');
    if (nextUrl !== musicUrl) {
      audio.pause();
      musicUrl = nextUrl || '';
      if (musicUrl) audio.src = musicUrl;
      else audio.removeAttribute('src');
      audio.load();
    }
    audio.muted = muted;
  }

  function openCover() {
    if (opened) return;
    opened = true;
    $('cover').classList.add('open');
    playOpeningSound();
    playChime();
    var audio = $('backgroundMusic');
    if (musicUrl) {
      window.setTimeout(function () { audio.play().catch(function () {}); }, 1200);
    } else {
      window.setTimeout(startAmbientMusic, 1200);
    }
    window.setTimeout(function () { $('cover').classList.add('gone'); }, 4200);
  }

  function renderWreath() {
    function leaf(x, y, angle, length, color) {
      return '<path transform="translate(' + x + ' ' + y + ') rotate(' + angle + ')" d="M0 0Q' +
        length * .35 + ' ' + -length * .3 + ' ' + length + ' 0Q' + length * .35 + ' ' +
        length * .3 + ' 0 0Z" fill="' + color + '" opacity=".85"/>';
    }
    var leaves = '';
    var greens = ['#8fae86', '#b7cfa8', '#6f9566'];
    for (var index = 0; index < 44; index++) {
      var degrees = index * 360 / 44;
      var radians = Math.PI / 180 * degrees;
      var x = (Math.cos(radians) * 80).toFixed(1);
      var y = (Math.sin(radians) * 80).toFixed(1);
      leaves += leaf(x, y, degrees + (index % 2 ? 100 : -10), 16, greens[index % greens.length]);
      if (index % 4 === 0) {
        leaves += '<circle cx="' + (x * 1.12).toFixed(1) + '" cy="' +
          (y * 1.12).toFixed(1) + '" r="1.8" fill="#c9b27a"/>';
      }
    }
    $('wreath').innerHTML = leaves;
    var cornerColors = ['#4d7a45', '#6f9566', '#a9c3a0', '#33582f'];
    Array.prototype.forEach.call(document.querySelectorAll('.corner'), function (corner) {
      var decoration = '';
      for (var i = 0; i < 16; i++) decoration += leaf(0, 0, 5 + i * 5.5, 70 + (i % 4) * 14, cornerColors[i % 4]);
      for (var j = 0; j < 10; j++) decoration += leaf(10, 8, 15 + j * 8, 48, cornerColors[(j + 1) % 4]);
      decoration += '<circle cx="26" cy="26" r="20" fill="#f3efe2"/><circle cx="26" cy="26" r="9" fill="#e7dcc0"/>';
      corner.innerHTML = decoration;
    });
  }

  function updateCountdown() {
    renderCountdown();
  }

  $('cover').addEventListener('click', openCover);
  $('snd').addEventListener('click', function () {
    muted = !muted;
    $('backgroundMusic').muted = muted;
    if (masterGain && audioContext) masterGain.gain.setTargetAtTime(muted ? 0 : .9, audioContext.currentTime, .1);
    updateSoundButton();
  });

  async function loadInvitation() {
    try {
      var response = await fetch('./invitations.json?updated=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('تعذر تحميل الدعوة.');
      invitationData = await response.json();
      if (!Array.isArray(invitationData.events)) throw new Error('بيانات الدعوة غير صالحة.');
      var requestedId = selectedEventId();
      currentEvent = invitationData.events.find(function (event) { return event.id === requestedId; }) ||
        invitationData.events.find(function (event) { return event.id === invitationData.featured; }) ||
        invitationData.events[0];
      if (!currentEvent) throw new Error('لا توجد دعوة منشورة.');
      renderInvitation(currentEvent);
      updateSoundButton();
      updateCountdown();
    } catch (error) {
      document.title = 'دعوة زفاف';
      $('cover').hidden = true;
      setText('heading', error.message);
      $('mainInviteSection').hidden = false;
    }
  }

  loadInvitation();
  window.setInterval(updateCountdown, 1000);
})();
