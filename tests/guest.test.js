const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const guestSource = fs.readFileSync(path.join(__dirname, '..', 'guest.js'), 'utf8');

function runGuest({ search = '', hash = '', event = null, settings = { featured_event_id: 'wedding' } }) {
  const elements = new Map();
  const queries = [];
  const channels = [];
  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        hidden: false,
        textContent: id === 'preview-data' ? '{"id":"preview","names":"Preview"}' : '',
        innerHTML: '',
        href: '',
        className: '',
        style: { setProperty() {} },
        replaceChildren() {}
      });
    }
    return elements.get(id);
  }
  const client = {
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      return {
        select() { return this; },
        eq(column, value) { query.filters.push([column, value]); return this; },
        async maybeSingle() { return { data: event, error: null }; },
        async single() { return { data: settings, error: null }; }
      };
    },
    channel(name) {
      const channel = {
        name,
        on() { return this; },
        subscribe() { channels.push(name); return this; }
      };
      return channel;
    },
    removeChannel() {}
  };
  const window = {
    invitationData: {
      isConfigured: () => true,
      getClient: () => client
    },
    location: { search, hash },
    setInterval() {},
    addEventListener() {}
  };
  vm.runInNewContext(guestSource, {
    window,
    location: window.location,
    document: {
      getElementById: element
    },
    URLSearchParams,
    Date,
    Math,
    encodeURIComponent
  });
  return new Promise((resolve) => setImmediate(() => resolve({ elements, queries, channels })));
}

test('loads only the requested published event', async () => {
  const event = {
    id: 'wedding',
    names: 'Sara & Ahmed',
    date: '2027-06-12',
    time: '16:00',
    env: 'garden',
    is_public: true
  };
  const result = await runGuest({ search: '?event=wedding', event });

  assert.equal(result.elements.get('names').textContent, 'Sara & Ahmed');
  assert.deepEqual(result.queries[0].filters, [['id', 'wedding'], ['is_public', true]]);
  assert.deepEqual(result.channels, ['public-invitation-event-wedding']);
});

test('uses the featured event for the root link and watches featured changes', async () => {
  const event = { id: 'wedding', names: 'Sara & Ahmed', env: 'classic', is_public: true };
  const result = await runGuest({ event });

  assert.equal(result.queries[0].table, 'invitation_settings');
  assert.equal(result.queries[1].filters[0][1], 'wedding');
  assert.deepEqual(result.channels, [
    'public-invitation-settings',
    'public-invitation-event-wedding'
  ]);
});

test('does not render an unpublished event', async () => {
  const result = await runGuest({ search: '?event=private-event', event: null });

  assert.equal(result.elements.get('names').textContent, 'Invitation unavailable');
  assert.match(result.elements.get('msg').textContent, /not available to the public/);
});
