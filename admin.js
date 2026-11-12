(function () {
  var THEMES = {
    classic: { bg: '#fff', ink: '#1f2a44', accent: '#b4476b' },
    garden: { bg: '#ddebdd', ink: '#1e3a2a', accent: '#3f7a55' },
    beach: { bg: '#d9eef3', ink: '#123b4a', accent: '#1b7f9a' },
    sunset: { bg: '#fbe3d6', ink: '#4a2335', accent: '#c2492f' },
    night: { bg: '#1a2142', ink: '#eef0ff', accent: '#f2c46d' }
  };
  var invitations = null;
  var selectedId = null;
  var changed = false;

  function $(id) {
    return document.getElementById(id);
  }

  function selectedEvent() {
    return invitations.events.find(function (event) {
      return event.id === selectedId;
    }) || null;
  }

  function setStatus(message) {
    $('status').textContent = message;
  }

  function linkFor(event) {
    return new URL('./?event=' + encodeURIComponent(event.id), location.href).href;
  }

  function renderEvents() {
    var list = $('eventList');
    list.replaceChildren();
    invitations.events.forEach(function (event) {
      var button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-pressed', event.id === selectedId ? 'true' : 'false');
      button.textContent = event.emoji ? event.emoji + ' ' + (event.names || 'New event') : (event.names || 'New event');
      var meta = document.createElement('small');
      meta.textContent = event.id === invitations.featured ? 'Main invitation' : 'Guest link available';
      button.appendChild(meta);
      button.addEventListener('click', function () {
        selectedId = event.id;
        $('jsonLabel').hidden = true;
        render();
      });
      list.appendChild(button);
    });
  }

  function renderPreview() {
    var event = selectedEvent();
    if (!event) return;
    var theme = THEMES[event.env] || THEMES.classic;
    $('previewCard').style.setProperty('--preview-bg', theme.bg);
    $('previewCard').style.setProperty('--preview-ink', theme.ink);
    $('previewCard').style.setProperty('--preview-accent', theme.accent);
    $('formTitle').textContent = event.names || 'Invitation details';
    $('setFeatured').textContent = event.id === invitations.featured
      ? 'Main invitation'
      : 'Set as main invitation';
    $('setFeatured').disabled = event.id === invitations.featured;
    $('previewEmoji').textContent = event.emoji || '';
    $('previewKicker').textContent = event.kicker || '';
    $('previewNames').textContent = event.names || 'Your names here';
    var date = event.date
      ? new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
      : 'Date to be announced';
    $('previewDate').textContent = date;
    $('previewTime').textContent = event.time
      ? new Date('2000-01-01T' + event.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : '';
    $('previewVenue').textContent = event.venue || '';
    $('previewMessage').textContent = event.message || '';
    $('previewInfo').textContent = event.info || '';
    var featured = invitations.events.find(function (item) {
      return item.id === invitations.featured;
    });
    $('featuredNote').textContent = event.id === invitations.featured
      ? 'This event appears on the main invitation link.'
      : 'Main invitation: ' + (featured ? featured.names : 'not set');
  }

  function render() {
    renderEvents();
    var event = selectedEvent();
    $('eventForm').hidden = !event;
    if (!event) return;
    Array.prototype.forEach.call($('eventForm').elements, function (control) {
      if (!control.name) return;
      if (control.type === 'checkbox') control.checked = event[control.name] !== false;
      else control.value = event[control.name] || '';
    });
    renderPreview();
  }

  function markChanged() {
    changed = true;
    $('jsonLabel').hidden = true;
    setStatus('Edits are here until you copy and publish them.');
  }

  $('eventForm').addEventListener('input', function (event) {
    var invitation = selectedEvent();
    var control = event.target;
    if (!invitation || !control.name) return;
    invitation[control.name] = control.type === 'checkbox' ? control.checked : control.value;
    markChanged();
    renderEvents();
    renderPreview();
  });

  $('addEvent').addEventListener('click', function () {
    var id = 'event-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    invitations.events.push({
      id: id,
      emoji: '🎉',
      kicker: 'You’re invited to',
      names: 'New event',
      event: 'New event',
      date: '',
      time: '',
      venue: '',
      message: '',
      info: '',
      env: 'classic'
    });
    selectedId = id;
    changed = true;
    render();
    setStatus('New event added. Copy and publish the data when ready.');
  });

  $('deleteEvent').addEventListener('click', function () {
    var event = selectedEvent();
    if (invitations.events.length <= 1) {
      setStatus('Keep at least one event in the invitation.');
      return;
    }
    if (!event || !window.confirm('Delete "' + (event.names || 'this event') + '"?')) return;
    invitations.events = invitations.events.filter(function (item) {
      return item.id !== selectedId;
    });
    if (invitations.featured === selectedId) {
      invitations.featured = invitations.events[0] ? invitations.events[0].id : '';
    }
    selectedId = invitations.events[0] ? invitations.events[0].id : null;
    changed = true;
    render();
    setStatus('Event deleted. Copy and publish the data when ready.');
  });

  $('setFeatured').addEventListener('click', function () {
    var event = selectedEvent();
    if (!event) return;
    invitations.featured = event.id;
    markChanged();
    render();
    setStatus('Main invitation changed. Copy and publish the data when ready.');
  });

  $('copyEventLink').addEventListener('click', async function () {
    var event = selectedEvent();
    if (!event) return;
    try {
      await navigator.clipboard.writeText(linkFor(event));
      setStatus('Guest link copied.');
    } catch (error) {
      setStatus('Could not copy the link. Copy it from the address bar after opening the public page.');
    }
  });

  $('copyData').addEventListener('click', async function () {
    if (!invitations.events.every(function (event) { return event.names && event.names.trim(); })) {
      setStatus('Add a name or title for every event before publishing.');
      return;
    }
    if (!invitations.events.some(function (event) { return event.id === invitations.featured; })) {
      setStatus('Choose a main invitation before publishing.');
      return;
    }
    var text = JSON.stringify(invitations, null, 2);
    var output = $('jsonOutput');
    output.value = text;
    $('jsonLabel').hidden = false;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied. Open “Publish on GitHub”, replace the file contents, and commit.');
    } catch (error) {
      output.focus();
      output.select();
      setStatus('Select and copy the JSON below, then paste it into GitHub and commit.');
    }
  });

  window.addEventListener('beforeunload', function (event) {
    if (!changed) return;
    event.preventDefault();
    event.returnValue = '';
  });

  fetch('./invitations.json', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('Could not load invitations. Refresh and try again.');
      return response.json();
    })
    .then(function (data) {
      if (!Array.isArray(data.events)) throw new Error('Invitation data is invalid.');
      invitations = data;
      selectedId = invitations.events.some(function (event) { return event.id === invitations.featured; })
        ? invitations.featured
        : (invitations.events[0] && invitations.events[0].id);
      render();
    })
    .catch(function (error) {
      setStatus(error.message);
      $('eventForm').hidden = true;
    });
})();
