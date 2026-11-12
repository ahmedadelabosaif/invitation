(function () {
  var ENVS = {
    classic: { bg: '#fff', ink: '#1f2a44', mut: '#5c6780', acc: '#b4476b', motion: 'fall', emojis: ['✨', '🤍'], count: 8 },
    garden: { bg: '#ddebdd', ink: '#1e3a2a', mut: '#4f6b58', acc: '#3f7a55', motion: 'fall', emojis: ['🌸', '🍃', '🌼'], count: 10 },
    beach: { bg: '#d9eef3', ink: '#123b4a', mut: '#3d6272', acc: '#1b7f9a', motion: 'rise', emojis: ['🫧', '🐚'], count: 10 },
    sunset: { bg: '#fbe3d6', ink: '#4a2335', mut: '#7a5260', acc: '#c2492f', motion: 'rise', emojis: ['🎈', '✨'], count: 7 },
    night: { bg: '#1a2142', ink: '#eef0ff', mut: '#a9b1d6', acc: '#f2c46d', motion: 'twinkle', emojis: ['✦', '⭐', '✧'], count: 18 },
    islamic: { bg: '#153b35', ink: '#fff8e9', mut: '#e5d7b8', acc: '#d8b46a', motion: 'twinkle', emojis: ['☾', '✦', '✧'], count: 14 }
  };
  var BACKGROUNDS = {
    roseGarden: './backgrounds/rose-garden.svg',
    goldenArch: './backgrounds/golden-arch.svg',
    moonlitSky: './backgrounds/moonlit-sky.svg',
    blushOrnament: './backgrounds/blush-ornament.svg'
  };
  var MUSIC_TRACKS = {
    beethovenAdagio: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Beethoven%2C_Sonata_No._8_in_C_Minor_Pathetique%2C_Op._13_-_II._Adagio_cantabile.ogg',
    beethovenVariations: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Beethoven_-_32_Variations_in_C_Minor%2C_WoO_80.ogg',
    chopinRomance: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Chopin_-_Piano_Concerto_no._1%2C_Op._11_%28string_quartet%29-2.ogg',
    beethovenHammerklavier: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Beethoven%2C_Piano_Sonata_No._29_in_B-flat_Major%2C_Op._106_Hammerklavier_-_III._Adagio_sostenuto.ogg'
  };
  var ETIQUETTE = {
    noPhotos: { icon: '🚫📷', label: 'No photos or video, please' },
    modestDress: { icon: '🧕', label: 'Modest dress requested' },
    separateSeating: { icon: '↔️', label: 'Separate seating' },
    prayerSpace: { icon: '🕌', label: 'Prayer space available' },
    halalFood: { icon: '🍽️', label: 'Halal food served' },
    noMusic: { icon: '🔇', label: 'No music' }
  };
  var currentStart = null;
  var currentEvent = null;
  var lastEnvironment = null;
  var currentMusicUrl = '';
  var musicStarted = false;
  var invitations = null;

  function $(id) {
    return document.getElementById(id);
  }

  function pad(number) {
    return String(number).padStart(2, '0');
  }

  function dateTime(event) {
    if (!event.date) return null;
    var date = event.date.split('-').map(Number);
    var time = (event.time || '00:00').split(':').map(Number);
    return new Date(date[0], date[1] - 1, date[2], time[0] || 0, time[1] || 0);
  }

  function calendarTime(date) {
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) +
      'T' + pad(date.getHours()) + pad(date.getMinutes()) + '00';
  }

  function safeLocationUrl(value) {
    if (!value) return '';
    try {
      var url = new URL(value);
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

  function isVideoPageUrl(value) {
    if (!value) return false;
    try {
      var url = new URL(value);
      var host = url.hostname.toLowerCase();
      return host === 'youtu.be' ||
        ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host);
    } catch (error) {
      return false;
    }
  }

  function updateMusicControls() {
    var audio = $('backgroundMusic');
    var toggle = $('musicToggle');
    toggle.textContent = !musicStarted ? '♫ Play music' : (audio.muted ? 'Unmute music' : 'Mute music');
    toggle.setAttribute('aria-pressed', musicStarted && !audio.muted ? 'true' : 'false');
  }

  $('musicToggle').addEventListener('click', function () {
    var audio = $('backgroundMusic');
    if (!musicStarted) {
      audio.play().then(function () {
        musicStarted = true;
        updateMusicControls();
      }).catch(function () {
        musicStarted = false;
        $('notice').textContent = 'Music could not be played. Check the music link and try again.';
        $('notice').hidden = false;
        updateMusicControls();
      });
    } else {
      audio.muted = !audio.muted;
      if (audio.muted) audio.pause();
      else audio.play().catch(function () {
        audio.muted = true;
        $('notice').textContent = 'Music could not be played. Check the music link and try again.';
        $('notice').hidden = false;
      });
      updateMusicControls();
    }
  });

  $('backgroundMusic').addEventListener('play', updateMusicControls);
  $('backgroundMusic').addEventListener('volumechange', updateMusicControls);

  function drawDecor(environment) {
    var html = '';
    var islamic = environment === ENVS.islamic;
    for (var i = 0; i < environment.count; i++) {
      var left = (i * 97) % 100;
      var duration = 9 + (i * 7) % 8;
      var delay = -((i * 5) % duration);
      var size = 0.9 + (i % 4) * 0.25;
      var twinkle = environment.motion === 'twinkle';
      html += '<span style="left:' + left + '%;' +
        (twinkle ? 'top:' + (i * 37) % 90 + '%;' : '') +
        'font-size:' + size + 'rem;animation-duration:' +
        (twinkle ? 3 + i % 4 : duration) + 's;animation-delay:' + delay + 's">' +
        environment.emojis[i % environment.emojis.length] + '</span>';
    }
    $('decor').className = 'decor ' + environment.motion + (islamic ? ' islamic-decor' : '');
    $('decor').innerHTML = html;
  }

  function renderEvent(event) {
    var environment = ENVS[event.env] || ENVS.classic;
    $('themeMark').hidden = event.env !== 'islamic';
    document.title = event.names
      ? event.names.trim() + "'s wedding invitation"
      : 'Wedding invitation';
    $('card').style.setProperty('--cbg', environment.bg);
    $('card').style.setProperty('--cink', environment.ink);
    $('card').style.setProperty('--cmut', environment.mut);
    $('card').style.setProperty('--cacc', environment.acc);
    var imageUrl = safeMediaUrl(event.backgroundImage) ||
      safeMediaUrl(BACKGROUNDS[event.backgroundPreset]);
    var imageMode = imageUrl && (event.backgroundMode === 'card' || event.backgroundMode === 'full')
      ? event.backgroundMode
      : '';
    $('pageBackdrop').hidden = imageMode !== 'full';
    $('pageBackgroundImage').hidden = imageMode !== 'full';
    $('pageBackgroundImage').src = imageMode === 'full' ? imageUrl : '';
    $('cardBackground').hidden = imageMode !== 'card';
    $('cardBackground').src = imageMode === 'card' ? imageUrl : '';
    $('icon').textContent = event.emoji || '';
    $('kicker').textContent = event.kicker || '';
    $('introDescription').textContent = event.introDescription || '';
    $('names').textContent = event.names || '';
    currentStart = dateTime(event);
    $('date').textContent = currentStart
      ? currentStart.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'Date to be announced';
    $('time').textContent = currentStart && event.time
      ? 'at ' + currentStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : '';
    $('venue').textContent = event.venue || '';
    var locationUrl = safeLocationUrl(event.locationUrl);
    $('locationLink').hidden = !locationUrl;
    if (locationUrl) $('locationLink').href = locationUrl;
    $('msg').textContent = event.message || '';
    $('info').textContent = event.info || '';
    renderEtiquette(event.etiquette || []);
    var linkedMusicUrl = safeMediaUrl(event.musicUrl);
    var musicUrl = MUSIC_TRACKS[event.musicTrack] || (isVideoPageUrl(linkedMusicUrl) ? '' : linkedMusicUrl);
    var audio = $('backgroundMusic');
    if (musicUrl !== currentMusicUrl) {
      audio.pause();
      audio.muted = false;
      musicStarted = false;
      currentMusicUrl = musicUrl;
      if (musicUrl) {
        audio.src = musicUrl;
      } else {
        audio.removeAttribute('src');
      }
      audio.load();
    }
    $('musicControls').hidden = !musicUrl;
    updateMusicControls();
    $('cal').hidden = !currentStart;
    if (currentStart) {
      var end = new Date(currentStart.getTime() + 4 * 3600 * 1000);
      $('cal').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
        encodeURIComponent(event.event || event.names || 'Event') + '&dates=' +
        calendarTime(currentStart) + '/' + calendarTime(end) + '&details=' +
        encodeURIComponent(event.message || '') + '&location=' + encodeURIComponent(event.venue || '');
    }
    if (event.env !== lastEnvironment) {
      lastEnvironment = event.env;
      drawDecor(environment);
    }
    $('notice').hidden = true;
    updateCountdown();
  }

  function renderEtiquette(items) {
    var section = $('etiquette');
    section.replaceChildren();
    (Array.isArray(items) ? items : []).forEach(function (item) {
      var option = ETIQUETTE[item];
      if (!option) return;
      var note = document.createElement('p');
      note.className = 'etiquette-note';
      note.textContent = option.icon + ' ' + option.label;
      section.appendChild(note);
    });
    section.hidden = !section.children.length;
  }

  function updateCountdown() {
    if (!currentStart) {
      $('clock').replaceChildren();
      return;
    }
    var difference = currentStart.getTime() - Date.now();
    if (difference <= 0) {
      $('clock').innerHTML = '<p class="done">Thank you for celebrating with us.</p>';
      return;
    }
    var seconds = Math.floor(difference / 1000);
    var values = [
      [Math.floor(seconds / 86400), 'days'],
      [pad(Math.floor(seconds % 86400 / 3600)), 'hours'],
      [pad(Math.floor(seconds % 3600 / 60)), 'minutes'],
      [pad(seconds % 60), 'seconds']
    ];
    $('clock').innerHTML = '<div class="clock">' + values.map(function (value) {
      return '<div><b>' + value[0] + '</b><span>' + value[1] + '</span></div>';
    }).join('') + '</div>';
  }

  function requestedId() {
    return new URLSearchParams(location.search).get('event') || location.hash.slice(1);
  }

  function sortedEvents() {
    return invitations.events
      .slice()
      .sort(function (a, b) { return (a.date || '9999').localeCompare(b.date || '9999'); });
  }

  function renderMore() {
    var section = $('more');
    section.replaceChildren();
    var others = sortedEvents().filter(function (event) {
      return event.id !== currentEvent.id;
    });
    section.hidden = others.length === 0;
    if (!others.length) return;

    var heading = document.createElement('h2');
    heading.textContent = 'More events';
    section.appendChild(heading);
    others.forEach(function (event) {
      var link = document.createElement('a');
      link.className = 'mrow';
      link.href = '?event=' + encodeURIComponent(event.id);
      var icon = document.createElement('span');
      icon.textContent = event.emoji || '✨';
      var details = document.createElement('span');
      var title = document.createElement('b');
      title.textContent = event.names || event.event || 'Event';
      var date = document.createElement('small');
      var starts = dateTime(event);
      date.textContent = starts
        ? starts.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Date to be announced';
      details.append(title, date);
      link.append(icon, details);
      section.appendChild(link);
    });
  }

  function render() {
    var events = sortedEvents();
    var id = requestedId();
    currentEvent = (id && events.find(function (event) { return event.id === id; })) ||
      events.find(function (event) { return event.id === invitations.featured; }) ||
      events[0] || null;
    if (!currentEvent) {
      currentStart = null;
      document.title = 'Wedding invitation';
      $('names').textContent = 'Invitation unavailable';
      $('icon').textContent = '';
      $('kicker').textContent = '';
      $('date').textContent = '';
      $('time').textContent = '';
      $('venue').textContent = '';
      $('locationLink').hidden = true;
      $('locationLink').removeAttribute('href');
      $('msg').textContent = 'There are no public invitations right now.';
      $('info').textContent = '';
      $('etiquette').replaceChildren();
      $('etiquette').hidden = true;
      $('pageBackdrop').hidden = true;
      $('pageBackgroundImage').hidden = true;
      $('cardBackground').hidden = true;
      $('musicControls').hidden = true;
      $('backgroundMusic').pause();
      $('clock').replaceChildren();
      $('cal').hidden = true;
      $('more').hidden = true;
      return;
    }
    renderEvent(currentEvent);
    renderMore();
  }

  async function loadInvitations() {
    try {
      var response = await fetch('./invitations.json?updated=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load invitations.');
      invitations = await response.json();
      if (!Array.isArray(invitations.events)) throw new Error('Invitation data is invalid.');
      render();
    } catch (error) {
      $('notice').textContent = error.message;
      $('notice').hidden = false;
    }
  }

  loadInvitations();
  window.setInterval(updateCountdown, 1000);
  window.setInterval(loadInvitations, 30000);
  window.addEventListener('hashchange', render);
  window.addEventListener('popstate', render);
})();
