(function () {
  var ENVS = {
    classic: { bg: '#fff', ink: '#1f2a44', mut: '#5c6780', acc: '#b4476b', motion: 'fall', emojis: ['✨', '🤍'], count: 8 },
    garden: { bg: '#ddebdd', ink: '#1e3a2a', mut: '#4f6b58', acc: '#3f7a55', motion: 'fall', emojis: ['🌸', '🍃', '🌼'], count: 10 },
    beach: { bg: '#d9eef3', ink: '#123b4a', mut: '#3d6272', acc: '#1b7f9a', motion: 'rise', emojis: ['🫧', '🐚'], count: 10 },
    sunset: { bg: '#fbe3d6', ink: '#4a2335', mut: '#7a5260', acc: '#c2492f', motion: 'rise', emojis: ['🎈', '✨'], count: 7 },
    night: { bg: '#1a2142', ink: '#eef0ff', mut: '#a9b1d6', acc: '#f2c46d', motion: 'twinkle', emojis: ['✦', '⭐', '✧'], count: 18 }
  };
  var fallback = JSON.parse(document.getElementById('preview-data').textContent);
  var client = null;
  var currentStart = null;
  var currentEventId = null;
  var eventChannel = null;
  var settingsChannel = null;
  var latestRequest = 0;
  var lastEnvironment = null;

  function $(id) {
    return document.getElementById(id);
  }

  function requestId() {
    return new URLSearchParams(location.search).get('event') || location.hash.slice(1) || null;
  }

  function dateTime(event) {
    if (!event.date) return null;
    var dateParts = event.date.split('-').map(Number);
    var timeParts = (event.time || '00:00').split(':').map(Number);
    return new Date(
      dateParts[0], dateParts[1] - 1, dateParts[2],
      timeParts[0] || 0, timeParts[1] || 0, 0
    );
  }

  function pad(number) {
    return String(number).padStart(2, '0');
  }

  function timestamp(date) {
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) +
      'T' + pad(date.getHours()) + pad(date.getMinutes()) + '00';
  }

  function drawDecor(environment) {
    var html = '';
    for (var i = 0; i < environment.count; i++) {
      var left = (i * 97) % 100;
      var duration = 9 + (i * 7) % 8;
      var delay = -((i * 5) % duration);
      var size = 0.9 + (i % 4) * 0.25;
      var top = (i * 37) % 90;
      var twinkle = environment.motion === 'twinkle';
      html += '<span style="left:' + left + '%;' + (twinkle ? 'top:' + top + '%;' : '') +
        'font-size:' + size + 'rem;animation-duration:' +
        (twinkle ? 3 + (i % 4) : duration) + 's;animation-delay:' + delay + 's">' +
        environment.emojis[i % environment.emojis.length] + '</span>';
    }
    $('decor').className = 'decor ' + environment.motion;
    $('decor').innerHTML = html;
  }

  function renderEvent(event) {
    var environment = ENVS[event.env] || ENVS.classic;
    $('card').style.setProperty('--cbg', environment.bg);
    $('card').style.setProperty('--cink', environment.ink);
    $('card').style.setProperty('--cmut', environment.mut);
    $('card').style.setProperty('--cacc', environment.acc);
    $('icon').textContent = event.emoji || '';
    $('kicker').textContent = event.kicker || '';
    $('names').textContent = event.names || '';
    currentStart = dateTime(event);
    $('date').textContent = currentStart
      ? currentStart.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : (event.date ? 'Date to be announced' : '');
    $('time').textContent = currentStart && event.time
      ? 'at ' + currentStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : '';
    $('venue').textContent = event.venue || '';
    $('msg').textContent = event.message || '';
    $('info').textContent = event.info || '';
    $('cal').hidden = !currentStart;
    if (currentStart) {
      var end = new Date(currentStart.getTime() + 4 * 3600 * 1000);
      $('cal').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
        encodeURIComponent(event.event || event.names || 'Event') + '&dates=' +
        timestamp(currentStart) + '/' + timestamp(end) + '&details=' +
        encodeURIComponent(event.message || '') + '&location=' + encodeURIComponent(event.venue || '');
    }
    if (event.env !== lastEnvironment) {
      lastEnvironment = event.env;
      drawDecor(environment);
    }
    $('notice').hidden = true;
    updateCountdown();
  }

  function showUnavailable(message) {
    currentStart = null;
    $('names').textContent = 'Invitation unavailable';
    $('kicker').textContent = '';
    $('date').textContent = '';
    $('time').textContent = '';
    $('venue').textContent = '';
    $('msg').textContent = message;
    $('info').textContent = '';
    $('icon').textContent = '';
    $('clock').replaceChildren();
    $('cal').hidden = true;
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

  async function loadEvent() {
    var request = ++latestRequest;
    var requestedId = requestId();
    try {
      if (!requestedId && !settingsChannel) {
        settingsChannel = client.channel('public-invitation-settings')
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'invitation_settings', filter: 'id=eq.1'
          }, loadEvent)
          .subscribe();
      }
      var id = requestedId;
      if (!id) {
        var settings = await client.from('invitation_settings')
          .select('featured_event_id').eq('id', 1).single();
        if (settings.error) throw settings.error;
        id = settings.data.featured_event_id;
      }
      if (!id) {
        if (request === latestRequest) showUnavailable('No invitation is currently featured.');
        return;
      }
      var result = await client.from('events').select('*')
        .eq('id', id).eq('is_public', true).maybeSingle();
      if (result.error) throw result.error;
      if (request !== latestRequest) return;
      if (!result.data) {
        showUnavailable('This invitation is not available to the public.');
        watchEvent(id);
        return;
      }
      renderEvent(result.data);
      watchEvent(result.data.id);
    } catch (error) {
      if (request === latestRequest) {
        showUnavailable('We could not load this invitation. Please try again later.');
        $('notice').textContent = 'Invitation service error: ' + error.message;
        $('notice').hidden = false;
      }
    }
  }

  function watchEvent(id) {
    if (id === currentEventId && eventChannel) return;
    if (eventChannel) client.removeChannel(eventChannel);
    currentEventId = id;
    eventChannel = client.channel('public-invitation-event-' + id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'events', filter: 'id=eq.' + id
      }, loadEvent)
      .subscribe();
  }

  if (!window.invitationData.isConfigured()) {
    renderEvent(fallback);
    $('notice').textContent = 'Preview mode: connect the invitation service to use live event links.';
    $('notice').hidden = false;
    return;
  }

  try {
    client = window.invitationData.getClient();
    loadEvent();
    window.setInterval(loadEvent, 30000);
    window.addEventListener('hashchange', loadEvent);
    window.addEventListener('popstate', loadEvent);
    window.setInterval(updateCountdown, 1000);
  } catch (error) {
    showUnavailable('We could not connect to the invitation service.');
    $('notice').textContent = error.message;
    $('notice').hidden = false;
  }
})();
