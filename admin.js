(function () {
  var THEMES = {
    classic: { bg: '#fff', ink: '#1f2a44', accent: '#b4476b', motion: 'fall', emojis: ['✨', '🤍'], count: 8 },
    garden: { bg: '#ddebdd', ink: '#1e3a2a', accent: '#3f7a55', motion: 'fall', emojis: ['🌸', '🍃', '🌼'], count: 10 },
    beach: { bg: '#d9eef3', ink: '#123b4a', accent: '#1b7f9a', motion: 'rise', emojis: ['🫧', '🐚'], count: 10 },
    sunset: { bg: '#fbe3d6', ink: '#4a2335', accent: '#c2492f', motion: 'rise', emojis: ['🎈', '✨'], count: 7 },
    night: { bg: '#1a2142', ink: '#eef0ff', accent: '#f2c46d', motion: 'twinkle', emojis: ['✦', '⭐', '✧'], count: 18 },
    islamic: { bg: '#153b35', ink: '#fff8e9', accent: '#d8b46a', motion: 'twinkle', emojis: ['☾', '✦', '✧'], count: 14 }
  };
  var REPO_CONTENTS_URL = 'https://api.github.com/repos/ahmedadelabosaif/invitation/contents/';
  var CONTENTS_URL = REPO_CONTENTS_URL + 'invitations.json';
  var TOKEN_KEY = 'invitation.github.publish-token';
  var ETIQUETTE = {
    noPhotos: { icon: '🚫📷', label: 'No photos or video, please' },
    modestDress: { icon: '🧕', label: 'Modest dress requested' },
    separateSeating: { icon: '↔️', label: 'Separate seating' },
    prayerSpace: { icon: '🕌', label: 'Prayer space available' },
    halalFood: { icon: '🍽️', label: 'Halal food served' },
    noMusic: { icon: '🔇', label: 'No music' }
  };
  var invitations = null;
  var originalData = null;
  var selectedId = null;
  var changed = false;
  var previewTheme = null;
  var savedToken = '';
  var editingToken = false;
  var pendingImages = {};

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

  function renderTokenControls() {
    $('tokenSaved').hidden = !savedToken;
    $('changeToken').hidden = !savedToken || editingToken;
    $('removeToken').hidden = !savedToken || editingToken;
    $('addToken').hidden = Boolean(savedToken) || editingToken;
    $('tokenEditor').hidden = !editingToken;
    $('saveToken').textContent = savedToken ? 'Save replacement token' : 'Save token in this browser';
  }

  function readSavedToken() {
    try {
      savedToken = window.localStorage.getItem(TOKEN_KEY) || '';
    } catch (error) {
      savedToken = '';
      setStatus('This browser blocks local storage. Allow site storage to save your token between visits.');
    }
    renderTokenControls();
  }

  function linkFor(event) {
    return new URL('./?event=' + encodeURIComponent(event.id), location.href).href;
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

  function normalizeInvitations(data) {
    data.events.forEach(function (event) {
      event.etiquette = Array.isArray(event.etiquette)
        ? event.etiquette.filter(function (item) { return Object.prototype.hasOwnProperty.call(ETIQUETTE, item); })
        : [];
    });
    return data;
  }

  function drawPreviewDecor(theme) {
    var decor = $('previewDecor');
    decor.replaceChildren();
    decor.className = 'preview-decor ' + theme.motion;
    for (var i = 0; i < theme.count; i++) {
      var span = document.createElement('span');
      var duration = 9 + (i * 7) % 8;
      span.textContent = theme.emojis[i % theme.emojis.length];
      span.style.left = (i * 97) % 100 + '%';
      if (theme.motion === 'twinkle') span.style.top = (i * 37) % 90 + '%';
      span.style.fontSize = 0.75 + (i % 4) * 0.2 + 'rem';
      span.style.animationDuration = (theme.motion === 'twinkle' ? 3 + i % 4 : duration) + 's';
      span.style.animationDelay = -((i * 5) % duration) + 's';
      decor.appendChild(span);
    }
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
    var pendingImage = pendingImages[event.id];
    var imageUrl = pendingImage ? pendingImage.previewUrl : safeMediaUrl(event.backgroundImage);
    var imageMode = imageUrl && (event.backgroundMode === 'card' || event.backgroundMode === 'full')
      ? event.backgroundMode
      : '';
    $('previewCard').style.backgroundImage = imageMode === 'card'
      ? 'linear-gradient(color-mix(in srgb,' + theme.bg + ' 84%,transparent),color-mix(in srgb,' +
        theme.bg + ' 84%,transparent)),url("' + imageUrl + '")'
      : '';
    $('previewCard').style.backgroundSize = 'cover';
    $('previewCard').style.backgroundPosition = 'center';
    $('previewPanel').style.backgroundImage = imageMode === 'full'
      ? 'linear-gradient(rgba(255,255,255,.55),rgba(255,255,255,.55)),url("' + imageUrl + '")'
      : '';
    $('previewPanel').style.backgroundSize = 'cover';
    $('previewPanel').style.backgroundPosition = 'center';
    $('previewMusicNote').hidden = !safeMediaUrl(event.musicUrl);
    if (previewTheme !== event.env) {
      previewTheme = event.env;
      drawPreviewDecor(theme);
    }
    $('formTitle').textContent = event.names || 'Invitation details';
    $('setFeatured').textContent = event.id === invitations.featured
      ? 'Main invitation'
      : 'Set as main invitation';
    $('setFeatured').disabled = event.id === invitations.featured;
    $('viewEventLink').href = linkFor(event);
    $('previewEmoji').textContent = event.emoji || '';
    $('previewKicker').textContent = event.kicker || '';
    $('previewNames').textContent = event.names || 'Your names here';
    $('previewDate').textContent = event.date
      ? new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
      : 'Date to be announced';
    $('previewTime').textContent = event.time
      ? new Date('2000-01-01T' + event.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : '';
    $('previewVenue').textContent = event.venue || '';
    var locationUrl = safeLocationUrl(event.locationUrl);
    $('previewDirections').href = locationUrl || '#';
    $('previewDirections').setAttribute('aria-disabled', locationUrl ? 'false' : 'true');
    $('previewDirections').tabIndex = locationUrl ? 0 : -1;
    $('previewDirections').hidden = !locationUrl;
    $('previewMessage').textContent = event.message || '';
    $('previewInfo').textContent = event.info || '';
    var etiquette = $('previewEtiquette');
    etiquette.replaceChildren();
    (Array.isArray(event.etiquette) ? event.etiquette : []).forEach(function (item) {
      var option = ETIQUETTE[item];
      if (!option) return;
      var note = document.createElement('p');
      note.textContent = option.icon + ' ' + option.label;
      etiquette.appendChild(note);
    });
    etiquette.hidden = !etiquette.children.length;
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
      if (control.name === 'etiquette') {
        control.checked = Array.isArray(event.etiquette) && event.etiquette.includes(control.value);
      } else if (control.name) {
        control.value = event[control.name] || '';
      }
    });
    var pendingImage = pendingImages[event.id];
    $('imageStatus').textContent = pendingImage
      ? (pendingImage.uploadedPath ? 'Image uploaded; publish to apply it.' : 'Image ready. It will upload when you publish.')
      : (event.backgroundImage ? 'An image is saved for this invitation.' : 'Choose a JPG, PNG, or WebP. It will be optimized and uploaded with the invitation when you publish.');
    $('removeImage').disabled = !pendingImage && !event.backgroundImage;
    renderPreview();
  }

  function discardPendingImage(eventId) {
    var pendingImage = pendingImages[eventId];
    if (!pendingImage) return;
    URL.revokeObjectURL(pendingImage.previewUrl);
    delete pendingImages[eventId];
  }

  async function optimizeImage(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Choose a JPG, PNG, or WebP image.');
    }
    if (file.size > 25000000) {
      throw new Error('Choose an image smaller than 25 MB.');
    }
    if (typeof createImageBitmap !== 'function') {
      throw new Error('This browser cannot optimize image uploads. Try a current version of Chrome, Safari, or Firefox.');
    }
    var bitmap = await createImageBitmap(file);
    try {
      var scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      var canvas = document.createElement('canvas');
      var context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare that image. Try another file.');
      for (var attempt = 0; attempt < 4; attempt++) {
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (var quality of [0.82, 0.68, 0.54]) {
          var blob = await new Promise(function (resolve, reject) {
            try {
              canvas.toBlob(function (result) {
                if (!result) reject(new Error('Could not encode that image. Try another file.'));
                else resolve(result);
              }, 'image/jpeg', quality);
            } catch (error) {
              reject(error);
            }
          });
          if (blob.size <= 900000) return blob;
        }
        scale *= 0.75;
      }
      throw new Error('That image is too large to optimize. Choose a smaller image.');
    } finally {
      bitmap.close();
    }
  }

  $('backgroundUpload').addEventListener('change', async function (event) {
    var file = event.target.files && event.target.files[0];
    var invitation = selectedEvent();
    if (!file || !invitation) return;
    $('imageStatus').textContent = 'Preparing image…';
    try {
      var blob = await optimizeImage(file);
      discardPendingImage(invitation.id);
      pendingImages[invitation.id] = {
        blob: blob,
        previewUrl: URL.createObjectURL(blob)
      };
      if (!invitation.backgroundMode) invitation.backgroundMode = 'card';
      markChanged();
      render();
      setStatus('Image ready. Publish to add it to the invitation.');
    } catch (error) {
      $('imageStatus').textContent = error.message;
      setStatus(error.message);
    } finally {
      event.target.value = '';
    }
  });

  $('removeImage').addEventListener('click', function () {
    var invitation = selectedEvent();
    if (!invitation) return;
    discardPendingImage(invitation.id);
    invitation.backgroundImage = '';
    invitation.backgroundMode = '';
    $('backgroundUpload').value = '';
    markChanged();
    render();
  });

  function markChanged() {
    changed = true;
    setStatus('Unpublished changes.');
  }

  function updateField(event) {
    var invitation = selectedEvent();
    var control = event.target;
    if (!invitation || !control.name) return;
    if (control.name === 'etiquette') {
      var choices = new Set(Array.isArray(invitation.etiquette) ? invitation.etiquette : []);
      if (control.checked) choices.add(control.value);
      else choices.delete(control.value);
      invitation.etiquette = Array.from(choices);
    } else {
      invitation[control.name] = control.value;
    }
    markChanged();
    renderEvents();
    renderPreview();
  }

  $('eventForm').addEventListener('input', function (event) {
    if (event.target.name !== 'etiquette') updateField(event);
  });
  $('eventForm').addEventListener('change', function (event) {
    if (event.target.name === 'etiquette') updateField(event);
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
      etiquette: [],
      env: 'classic'
    });
    selectedId = id;
    markChanged();
    render();
  });

  $('deleteEvent').addEventListener('click', function () {
    var event = selectedEvent();
    if (invitations.events.length <= 1) {
      setStatus('Keep at least one event in the invitation.');
      return;
    }
    if (!event || !window.confirm('Delete "' + (event.names || 'this event') + '"?')) return;
    discardPendingImage(selectedId);
    invitations.events = invitations.events.filter(function (item) {
      return item.id !== selectedId;
    });
    if (invitations.featured === selectedId) {
      invitations.featured = invitations.events[0].id;
    }
    selectedId = invitations.events[0].id;
    markChanged();
    render();
  });

  $('setFeatured').addEventListener('click', function () {
    var event = selectedEvent();
    if (!event) return;
    invitations.featured = event.id;
    markChanged();
    render();
  });

  $('addToken').addEventListener('click', function () {
    editingToken = true;
    $('githubToken').value = '';
    renderTokenControls();
    $('githubToken').focus();
  });

  $('changeToken').addEventListener('click', function () {
    editingToken = true;
    $('githubToken').value = '';
    renderTokenControls();
    $('githubToken').focus();
  });

  $('cancelToken').addEventListener('click', function () {
    editingToken = false;
    $('githubToken').value = '';
    renderTokenControls();
  });

  $('saveToken').addEventListener('click', function () {
    var token = $('githubToken').value.trim();
    if (!token) {
      setStatus('Paste your fine-grained GitHub token first.');
      return;
    }
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
      savedToken = token;
      editingToken = false;
      $('githubToken').value = '';
      renderTokenControls();
      setStatus('Token saved in this browser. You can publish without entering it again.');
    } catch (error) {
      setStatus('Could not save the token in this browser. Allow site storage and try again.');
    }
  });

  $('removeToken').addEventListener('click', function () {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      savedToken = '';
      editingToken = false;
      $('githubToken').value = '';
      renderTokenControls();
      setStatus('Saved token removed from this browser. Revoke it in GitHub too if you no longer need it.');
    } catch (error) {
      setStatus('Could not remove the saved token. Clear this site’s browser storage or revoke the token on GitHub.');
    }
  });

  $('previewButton').addEventListener('click', function () {
    renderPreview();
    $('previewCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setStatus('Preview updated.');
  });

  function encodeBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    bytes.forEach(function (byte) {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function encodeBytesBase64(bytes) {
    var binary = '';
    bytes.forEach(function (byte) {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function decodeBase64(text) {
    var binary = atob(text.replace(/\s/g, ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function responseJson(response) {
    try {
      return await response.json();
    } catch (error) {
      throw new Error('GitHub returned an unreadable response. Try again.');
    }
  }

  async function uploadPendingImage(event, headers) {
    var pendingImage = pendingImages[event.id];
    if (!pendingImage) return;
    if (pendingImage.uploadedPath) {
      event.backgroundImage = pendingImage.uploadedPath;
      return;
    }
    var safeId = event.id.replace(/[^a-z0-9-]/gi, '-').slice(0, 40) || 'event';
    var fileName = safeId + '-' + Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6) + '.jpg';
    var path = 'images/' + fileName;
    var response = await fetch(REPO_CONTENTS_URL + path, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify({
        message: 'Upload invitation background image',
        content: encodeBytesBase64(new Uint8Array(await pendingImage.blob.arrayBuffer())),
        branch: 'main'
      })
    });
    var result = await responseJson(response);
    if (!response.ok) {
      throw new Error(result.message || 'GitHub could not upload the background image.');
    }
    event.backgroundImage = path;
    pendingImage.uploadedPath = path;
    if (event.id === selectedId) {
      $('imageStatus').textContent = 'Image uploaded; publish to apply it.';
      renderPreview();
    }
  }

  $('publishButton').addEventListener('click', async function () {
    if (!invitations.events.every(function (event) { return event.names && event.names.trim(); })) {
      setStatus('Add a name or title for every event before publishing.');
      return;
    }
    if (invitations.events.some(function (event) {
      return event.locationUrl && !safeLocationUrl(event.locationUrl);
    })) {
      setStatus('Use a valid map link starting with https:// or http://.');
      return;
    }
    if (invitations.events.some(function (event) {
      return event.musicUrl && !safeMediaUrl(event.musicUrl);
    })) {
      setStatus('Use a valid HTTPS direct audio link for the background music.');
      return;
    }
    if (invitations.events.some(function (event) {
      return (event.backgroundMode && ['card', 'full'].indexOf(event.backgroundMode) === -1) ||
        (event.backgroundMode && !event.backgroundImage && !pendingImages[event.id]) ||
        (event.backgroundImage && !safeMediaUrl(event.backgroundImage));
    })) {
      setStatus('Choose a valid image placement and upload an image before publishing.');
      return;
    }
    if (!invitations.events.some(function (event) { return event.id === invitations.featured; })) {
      setStatus('Choose a main invitation before publishing.');
      return;
    }
    if (!savedToken) {
      editingToken = true;
      renderTokenControls();
      $('githubToken').focus();
      setStatus('Save your GitHub token once, then publish.');
      return;
    }
    var button = $('publishButton');
    button.disabled = true;
    setStatus('Publishing…');
    var headers = {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + savedToken,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    try {
      var fileResponse = await fetch(CONTENTS_URL, { headers: headers });
      var file = await responseJson(fileResponse);
      if (!fileResponse.ok) {
        throw new Error(fileResponse.status === 401 || fileResponse.status === 403
          ? 'GitHub rejected the token. Check its repository and Contents permissions.'
          : (file.message || 'Could not load the invitation file from GitHub.'));
      }

      var remoteData = normalizeInvitations(JSON.parse(decodeBase64(file.content)));
      if (JSON.stringify(remoteData) !== JSON.stringify(originalData)) {
        throw new Error('The invitation changed on GitHub since you opened this page. Reload before publishing.');
      }

      for (var imageIndex = 0; imageIndex < invitations.events.length; imageIndex++) {
        if (invitations.events[imageIndex].backgroundMode) {
          await uploadPendingImage(invitations.events[imageIndex], headers);
        }
      }
      var content = JSON.stringify(normalizeInvitations(invitations), null, 2) + '\n';
      var saveResponse = await fetch(CONTENTS_URL, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        body: JSON.stringify({
          message: 'Update invitation from visual editor',
          content: encodeBase64(content),
          sha: file.sha,
          branch: 'main'
        })
      });
      var result = await responseJson(saveResponse);
      if (!saveResponse.ok) {
        throw new Error(result.message || 'GitHub could not publish the invitation.');
      }
      originalData = JSON.parse(JSON.stringify(invitations));
      invitations.events.forEach(function (event) {
        discardPendingImage(event.id);
      });
      changed = false;
      render();
      setStatus('Published. The public page updates after GitHub Pages deploys.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      headers.Authorization = '';
      button.disabled = false;
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
      if (!Array.isArray(data.events) || !data.events.length) throw new Error('At least one invitation is required.');
      invitations = normalizeInvitations(data);
      originalData = JSON.parse(JSON.stringify(invitations));
      selectedId = invitations.events.some(function (event) { return event.id === invitations.featured; })
        ? invitations.featured
        : invitations.events[0].id;
      render();
      readSavedToken();
    })
    .catch(function (error) {
      setStatus(error.message);
      $('eventForm').hidden = true;
    });
})();
