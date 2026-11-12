(function () {
  var service = window.invitationData;
  var client = null;
  var events = [];
  var selectedId = null;
  var featuredId = null;
  var dirty = false;

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(message) {
    $('status').textContent = message;
  }

  function setLoginStatus(message) {
    $('loginStatus').textContent = message;
  }

  function selectedEvent() {
    return events.find(function (event) {
      return event.id === selectedId;
    }) || null;
  }

  function makeEventId() {
    return window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : 'event-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function publicUrl(event) {
    return new URL('./?event=' + encodeURIComponent(event.id), location.href).href;
  }

  function renderEvents() {
    var list = $('eventList');
    list.replaceChildren();
    events.forEach(function (event) {
      var button = document.createElement('button');
      var title = (event.emoji ? event.emoji + ' ' : '') + (event.names || 'Untitled event');
      button.textContent = title;
      button.setAttribute('aria-pressed', event.id === selectedId ? 'true' : 'false');
      var detail = document.createElement('small');
      detail.textContent = (event.is_public ? 'Public' : 'Private') +
        (event.id === featuredId ? ' · Main invitation' : '');
      button.appendChild(detail);
      button.addEventListener('click', function () {
        if (dirty && !window.confirm('Discard unsaved changes?')) return;
        selectedId = event.id;
        dirty = false;
        fillForm();
        renderEvents();
      });
      list.appendChild(button);
    });
  }

  function fillForm() {
    var event = selectedEvent();
    var form = $('eventForm');
    form.hidden = !event;
    $('editorTitle').textContent = event ? 'Edit event' : 'Add an event';
    $('deleteEvent').disabled = !event;
    $('featureEvent').disabled = !event || !event.is_public;
    $('copyLink').disabled = !event || !event.is_public;
    if (!event) {
      $('shareLink').value = '';
      return;
    }
    Array.prototype.forEach.call(form.elements, function (input) {
      if (!input.name) return;
      if (input.type === 'checkbox') input.checked = Boolean(event[input.name]);
      else input.value = event[input.name] || '';
    });
    $('shareLink').value = event.is_public ? publicUrl(event) : 'Publish this event to enable its link.';
    $('featureEvent').textContent = event.id === featuredId
      ? 'Main invitation'
      : 'Set as main invitation';
  }

  async function loadEvents() {
    var result = await client.from('events').select('*').order('created_at', { ascending: true });
    if (result.error) throw result.error;
    var settings = await client.from('invitation_settings')
      .select('featured_event_id').eq('id', 1).single();
    if (settings.error) throw settings.error;
    events = result.data || [];
    featuredId = settings.data.featured_event_id;
    if (!events.some(function (event) { return event.id === selectedId; })) {
      selectedId = events.some(function (event) { return event.id === featuredId; })
        ? featuredId
        : (events[0] ? events[0].id : null);
    }
    renderEvents();
    fillForm();
  }

  async function verifyAdmin(user) {
    var result = await client.from('invitation_admins')
      .select('user_id').eq('user_id', user.id).maybeSingle();
    if (result.error) throw result.error;
    return Boolean(result.data);
  }

  async function showPortal(user) {
    if (!(await verifyAdmin(user))) {
      await client.auth.signOut();
      throw new Error('This account is not permitted to administer invitations.');
    }
    await loadEvents();
    $('login').hidden = true;
    $('portal').hidden = false;
    $('signOut').hidden = false;
    client.channel('admin-event-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, function () {
        if (!dirty) loadEvents().catch(function (error) {
          setStatus('Could not refresh events: ' + error.message);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitation_settings' }, function () {
        if (!dirty) loadEvents().catch(function (error) {
          setStatus('Could not refresh settings: ' + error.message);
        });
      })
      .subscribe();
  }

  async function signIn(password) {
    var result = await client.auth.signInWithPassword({
      email: service.adminEmail,
      password: password
    });
    if (result.error) throw new Error('Sign-in failed. Check the admin password and try again.');
    await showPortal(result.data.user);
    setLoginStatus('');
  }

  $('loginForm').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!service.isConfigured()) {
      setLoginStatus('Admin service is not configured. See the setup instructions in README.');
      return;
    }
    var button = $('loginButton');
    button.disabled = true;
    setLoginStatus('Signing in…');
    try {
      client = service.getClient();
      signIn($('password').value)
        .then(function () { $('password').value = ''; })
        .catch(function (error) { setLoginStatus(error.message); })
        .finally(function () { button.disabled = false; });
    } catch (error) {
      setLoginStatus(error.message);
      button.disabled = false;
    }
  });

  $('eventForm').addEventListener('input', function () {
    dirty = true;
  });

  $('eventForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    var form = event.currentTarget;
    var button = $('saveEvent');
    var previous = selectedEvent();
    var isNew = !previous || previous._new;
    var values = Object.fromEntries(new FormData(form).entries());
    values.id = selectedId;
    values.emoji = values.emoji.trim();
    values.kicker = values.kicker.trim();
    values.names = values.names.trim();
    values.event = values.event.trim();
    values.venue = values.venue.trim();
    values.message = values.message.trim();
    values.info = values.info.trim();
    values.is_public = form.elements.is_public.checked;
    values.date = values.date || null;
    values.time = values.time || null;
    values.updated_at = new Date().toISOString();
    button.disabled = true;
    setStatus('Saving…');
    try {
      var result = isNew
        ? await client.from('events').insert(values).select().single()
        : await client.from('events').update(values).eq('id', selectedId).select().single();
      if (result.error) throw result.error;
      selectedId = result.data.id;
      dirty = false;
      await loadEvents();
      setStatus('Changes saved. Public invitations update automatically.');
    } catch (error) {
      setStatus('Could not save event: ' + error.message);
    } finally {
      button.disabled = false;
    }
  });

  $('addEvent').addEventListener('click', function () {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    var draft = {
      id: makeEventId(),
      emoji: '🎉',
      kicker: 'You’re invited to',
      names: 'New event',
      event: 'New event',
      date: null,
      time: null,
      venue: '',
      message: '',
      info: '',
      env: 'classic',
      is_public: false,
      created_at: new Date().toISOString(),
      _new: true
    };
    events.push(draft);
    selectedId = draft.id;
    dirty = true;
    renderEvents();
    fillForm();
    setStatus('New event. Save it before sharing.');
  });

  $('featureEvent').addEventListener('click', async function () {
    var event = selectedEvent();
    if (!event || !event.is_public) return;
    $('featureEvent').disabled = true;
    try {
      var result = await client.from('invitation_settings')
        .update({ featured_event_id: event.id }).eq('id', 1);
      if (result.error) throw result.error;
      featuredId = event.id;
      renderEvents();
      fillForm();
      setStatus('Main invitation updated.');
    } catch (error) {
      setStatus('Could not select the main invitation: ' + error.message);
    } finally {
      $('featureEvent').disabled = false;
    }
  });

  $('deleteEvent').addEventListener('click', async function () {
    var event = selectedEvent();
    if (!event || !window.confirm('Delete "' + (event.names || 'this event') + '"?')) return;
    $('deleteEvent').disabled = true;
    try {
      var result = await client.from('events').delete().eq('id', event.id);
      if (result.error) throw result.error;
      dirty = false;
      await loadEvents();
      setStatus('Event deleted.');
    } catch (error) {
      setStatus('Could not delete event: ' + error.message);
    } finally {
      $('deleteEvent').disabled = false;
    }
  });

  $('copyLink').addEventListener('click', async function () {
    var event = selectedEvent();
    if (!event || !event.is_public) return;
    try {
      await navigator.clipboard.writeText(publicUrl(event));
      setStatus('Public link copied.');
    } catch (error) {
      $('shareLink').focus();
      $('shareLink').select();
      setStatus('Copy was blocked. Select the link and copy it manually.');
    }
  });

  $('signOut').addEventListener('click', async function () {
    var result = await client.auth.signOut();
    if (result.error) {
      setStatus('Could not sign out: ' + result.error.message);
      return;
    }
    location.reload();
  });

  if (!service.isConfigured()) {
    setLoginStatus('Admin service is not configured. See the setup instructions in README.');
    return;
  }

  client = service.getClient();
  client.auth.getSession().then(function (result) {
    if (result.error) throw result.error;
    if (result.data.session) return showPortal(result.data.session.user);
  }).catch(function (error) {
    setLoginStatus(error.message);
  });
})();
