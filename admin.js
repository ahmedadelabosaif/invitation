(function () {
  var EVENT_TYPES = {
    wedding: { label: 'Wedding', emoji: '💍', names: 'New wedding invitation', kicker: 'You’re invited to the wedding of', title: 'Wedding' },
    engagement: { label: 'Engagement', emoji: '💍', names: 'New engagement invitation', kicker: 'You’re invited to celebrate', title: 'Engagement' },
    birthday: { label: 'Birthday', emoji: '🎂', names: 'New birthday invitation', kicker: 'You’re invited to celebrate', title: 'Birthday celebration' },
    gathering: { label: 'Gathering', emoji: '✨', names: 'New gathering invitation', kicker: 'You’re invited to', title: 'Gathering' }
  };
  var BACKGROUNDS = {
    roseGarden: './backgrounds/rose-garden.svg',
    goldenArch: './backgrounds/golden-arch.svg',
    moonlitSky: './backgrounds/moonlit-sky.svg',
    blushOrnament: './backgrounds/blush-ornament.svg'
  };
  var MUSIC_TRACKS = {
    beethovenAdagio: {
      title: 'Beethoven · Adagio cantabile',
      url: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Beethoven%2C_Sonata_No._8_in_C_Minor_Pathetique%2C_Op._13_-_II._Adagio_cantabile.ogg'
    },
    beethovenVariations: {
      title: 'Beethoven · 32 Variations',
      url: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Beethoven_-_32_Variations_in_C_Minor%2C_WoO_80.ogg'
    },
    chopinRomance: {
      title: 'Chopin · Romance (Larghetto)',
      url: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Chopin_-_Piano_Concerto_no._1%2C_Op._11_%28string_quartet%29-2.ogg'
    },
    beethovenHammerklavier: {
      title: 'Beethoven · Adagio sostenuto',
      url: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Beethoven%2C_Piano_Sonata_No._29_in_B-flat_Major%2C_Op._106_Hammerklavier_-_III._Adagio_sostenuto.ogg'
    }
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
  var savedToken = '';
  var editingToken = false;
  var pendingImages = {};
  var pendingAudio = {};

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

  function normalizeInvitations(data) {
    data.events.forEach(function (event) {
      if (!Object.prototype.hasOwnProperty.call(EVENT_TYPES, event.eventType)) {
        event.eventType = 'wedding';
      }
      event.etiquette = Array.isArray(event.etiquette)
        ? event.etiquette.filter(function (item) { return Object.prototype.hasOwnProperty.call(ETIQUETTE, item); })
        : [];
    });
    return data;
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
      meta.textContent = (event.id === invitations.featured ? 'Main invitation' : 'Guest link available') +
        ' · ' + EVENT_TYPES[event.eventType].label;
      button.appendChild(meta);
      button.addEventListener('click', function () {
        selectedId = event.id;
        render();
      });
      list.appendChild(button);
    });
  }

  function updateEventMetadata(event) {
    $('formTitle').textContent = event.names || 'Invitation details';
    $('setFeatured').textContent = event.id === invitations.featured
      ? 'Main invitation'
      : 'Set as main invitation';
    $('setFeatured').disabled = event.id === invitations.featured;
    $('viewEventLink').href = linkFor(event);
  }

  function render() {
    renderEvents();
    var event = selectedEvent();
    $('eventForm').hidden = !event;
    if (!event) return;
    updateEventMetadata(event);
    $('weddingFields').hidden = event.eventType !== 'wedding';
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
      : (event.backgroundImage || event.backgroundPreset
        ? 'A background is selected for this invitation.'
        : 'Choose a preset or upload a JPG, PNG, or WebP.');
    $('removeImage').disabled = !pendingImage && !event.backgroundImage && !event.backgroundPreset;
    var pendingSong = pendingAudio[event.id];
    var linkedMusicUrl = safeMediaUrl(event.musicUrl);
    $('musicStatus').textContent = pendingSong
      ? (pendingSong.uploadedPath ? 'Song uploaded; publish to apply it.' : 'Song ready. It will upload when you publish.')
      : (MUSIC_TRACKS[event.musicTrack] ? 'Selected: ' + MUSIC_TRACKS[event.musicTrack].title
        : (event.musicTrack === 'none' ? 'No music selected.'
          : (isVideoPageUrl(linkedMusicUrl)
            ? 'Video-page links (such as YouTube) cannot be played as audio only. Choose a preset, direct audio link, or upload an audio file.'
            : (event.musicUrl ? 'A custom music link is saved.' : 'Choose a preset track, paste a link, or upload an MP3/OGG/WAV/M4A up to 8 MB.'))));
  }

  function discardPendingImage(eventId) {
    delete pendingImages[eventId];
  }

  function discardPendingAudio(eventId) {
    delete pendingAudio[eventId];
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
        blob: blob
      };
      invitation.backgroundPreset = '';
      invitation.backgroundImage = '';
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

  $('musicUpload').addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    var invitation = selectedEvent();
    if (!file || !invitation) return;
    var extensions = {
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a'
    };
    var extension = extensions[file.type];
    if (!extension) {
      $('musicStatus').textContent = 'Choose an MP3, OGG, WAV, or M4A audio file.';
      event.target.value = '';
      return;
    }
    if (file.size > 8000000) {
      $('musicStatus').textContent = 'Choose an audio file smaller than 8 MB.';
      event.target.value = '';
      return;
    }
    discardPendingAudio(invitation.id);
    pendingAudio[invitation.id] = { file: file, extension: extension };
    invitation.musicTrack = '';
    invitation.musicUrl = '';
    setFormValue('musicTrack', '');
    setFormValue('musicUrl', '');
    markChanged();
    render();
    setStatus('Song ready. Publish to add it to the invitation.');
    event.target.value = '';
  });

  $('removeImage').addEventListener('click', function () {
    var invitation = selectedEvent();
    if (!invitation) return;
    discardPendingImage(invitation.id);
    invitation.backgroundImage = '';
    invitation.backgroundPreset = '';
    invitation.backgroundMode = '';
    $('backgroundUpload').value = '';
    markChanged();
    render();
  });

  function markChanged() {
    changed = true;
    setStatus('Unpublished changes.');
  }

  function setFormValue(name, value) {
    Array.prototype.forEach.call($('eventForm').elements, function (control) {
      if (control.name === name) control.value = value;
    });
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
    } else if (control.name === 'backgroundPreset') {
      invitation.backgroundPreset = control.value;
      if (control.value) {
        discardPendingImage(invitation.id);
        invitation.backgroundImage = '';
        if (!invitation.backgroundMode) {
          invitation.backgroundMode = 'full';
          setFormValue('backgroundMode', 'full');
        }
      } else if (!invitation.backgroundImage && !pendingImages[invitation.id]) {
        invitation.backgroundMode = '';
        setFormValue('backgroundMode', '');
      }
    } else if (control.name === 'musicTrack') {
      discardPendingAudio(invitation.id);
      invitation.musicTrack = control.value;
      invitation.musicUrl = '';
      setFormValue('musicUrl', '');
      if (control.value === 'none') {
        setFormValue('musicUpload', '');
      }
    } else if (control.name === 'musicUrl') {
      if (control.value) discardPendingAudio(invitation.id);
      invitation.musicUrl = control.value;
      invitation.musicTrack = '';
      setFormValue('musicTrack', '');
    } else {
      invitation[control.name] = control.value;
    }
    markChanged();
    renderEvents();
    updateEventMetadata(invitation);
  }

  $('eventForm').addEventListener('input', function (event) {
    if (event.target.name !== 'etiquette') updateField(event);
  });
  $('eventForm').addEventListener('change', function (event) {
    if (event.target.name === 'etiquette' || event.target.tagName === 'SELECT') updateField(event);
  });

  $('addEvent').addEventListener('click', function () {
    $('newEventPanel').hidden = false;
    $('newEventType').focus();
  });

  $('cancelNewEvent').addEventListener('click', function () {
    $('newEventPanel').hidden = true;
  });

  $('createEvent').addEventListener('click', function () {
    var type = $('newEventType').value;
    if (!Object.prototype.hasOwnProperty.call(EVENT_TYPES, type)) {
      setStatus('Choose an invitation type before creating the event.');
      return;
    }
    var template = EVENT_TYPES[type];
    var id = 'event-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    invitations.events.push({
      id: id,
      eventType: type,
      emoji: template.emoji,
      kicker: template.kicker,
      names: template.names,
      event: template.title,
      date: '',
      time: '',
      venue: '',
      message: '',
      info: '',
      etiquette: [],
      backgroundPreset: '',
      musicTrack: '',
      env: 'classic'
    });
    selectedId = id;
    $('newEventPanel').hidden = true;
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
    }
  }

  async function uploadPendingAudio(event, headers) {
    var pendingSong = pendingAudio[event.id];
    if (!pendingSong) return;
    if (pendingSong.uploadedPath) {
      event.musicUrl = pendingSong.uploadedPath;
      return;
    }
    var safeId = event.id.replace(/[^a-z0-9-]/gi, '-').slice(0, 40) || 'event';
    var fileName = safeId + '-' + Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6) + '.' + pendingSong.extension;
    var path = 'music/' + fileName;
    var response = await fetch(REPO_CONTENTS_URL + path, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify({
        message: 'Upload invitation music',
        content: encodeBytesBase64(new Uint8Array(await pendingSong.file.arrayBuffer())),
        branch: 'main'
      })
    });
    var result = await responseJson(response);
    if (!response.ok) {
      throw new Error(result.message || 'GitHub could not upload the music file.');
    }
    event.musicUrl = path;
    pendingSong.uploadedPath = path;
    if (event.id === selectedId) {
      $('musicStatus').textContent = 'Song uploaded; publish to apply it.';
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
      return (event.preEventLocationUrl && !safeLocationUrl(event.preEventLocationUrl)) ||
        (event.contractImageUrl && !safeMediaUrl(event.contractImageUrl));
    })) {
      setStatus('Use valid HTTPS links for the related gathering map and marriage-contract image.');
      return;
    }
    if (invitations.events.some(function (event) {
      var url = safeMediaUrl(event.musicUrl);
      return event.musicUrl && (!url || isVideoPageUrl(url));
    })) {
      setStatus('Video-page links cannot be used for audio-only playback. Choose a preset, direct HTTPS audio link, or upload an audio file.');
      return;
    }
    if (invitations.events.some(function (event) {
      return (event.musicTrack && event.musicTrack !== 'none' && !MUSIC_TRACKS[event.musicTrack]) ||
        (event.musicTrack && event.musicUrl);
    })) {
      setStatus('Choose one preset music track or use your own music link, not both.');
      return;
    }
    if (invitations.events.some(function (event) {
      return (event.backgroundMode && ['card', 'full'].indexOf(event.backgroundMode) === -1) ||
        (event.backgroundMode && !event.backgroundImage && !event.backgroundPreset && !pendingImages[event.id]) ||
        (event.backgroundImage && !safeMediaUrl(event.backgroundImage)) ||
        (event.backgroundPreset && !BACKGROUNDS[event.backgroundPreset]);
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
        await uploadPendingImage(invitations.events[imageIndex], headers);
        await uploadPendingAudio(invitations.events[imageIndex], headers);
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
        discardPendingAudio(event.id);
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
