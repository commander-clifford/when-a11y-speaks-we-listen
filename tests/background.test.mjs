import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8');
const extensionOrigin = 'chrome-extension://fixture';
const token = '00000000-0000-4000-8000-000000000001';
const reportKey = 'report:' + token;

function snapshot(overrides = {}) {
  return {
    schemaVersion: 1, createdAt: '2026-09-08T00:00:00.000Z',
    meta: { title: 'Fixture', sourceUrl: 'https://fixture.invalid/', url: 'https://fixture.invalid/' },
    images: [{ id: 0, src: 'https://fixture.invalid/photo.png', alt: '', altState: 'empty', lazySource: 'lazy.png', srcset: 'photo.png 1x', ariaLabelledby: 'caption', role: 'presentation', ariaHidden: 'true', hiddenAttribute: true }],
    scan: { reason: 'complete', partial: false, scope: 'dom-and-scrollable-components', containersVisited: 2 },
    ...overrides,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function harness(options = {}) {
  const state = options.state || {
    storage: {},
    tabs: new Map([[1, { id: 1, url: 'https://fixture.invalid/' }], [2, { id: 2, url: 'https://second.invalid/' }]]),
    nextTabId: 100, nextToken: 1,
  };
  const events = {};
  const calls = { execute: [], create: [], update: [], badges: [], titles: [], removedKeys: [] };
  const event = name => ({ addListener(fn) { events[name] = fn; } });
  const clone = value => structuredClone(value);
  const chrome = {
    runtime: { getURL: name => extensionOrigin + '/' + name, onMessage: event('message') },
    action: {
      onClicked: event('action'),
      async setBadgeText(value) { calls.badges.push(value); },
      async setTitle(value) { calls.titles.push(value); },
    },
    commands: { onCommand: event('command') },
    scripting: {
      async executeScript(value) {
        calls.execute.push(value);
        if (options.execute) return options.execute(value);
        return [{ frameId: 0, result: snapshot() }];
      },
    },
    storage: {
      session: {
        async get(key) {
          if (key === null) return clone(state.storage);
          return Object.hasOwn(state.storage, key) ? { [key]: clone(state.storage[key]) } : {};
        },
        async set(values) {
          if (options.storageFailure) throw new Error(options.storageFailure);
          Object.assign(state.storage, clone(values));
        },
        async remove(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            calls.removedKeys.push(key);
            delete state.storage[key];
          }
        },
      },
    },
    tabs: {
      onRemoved: event('removed'),
      async create(value) {
        calls.create.push(value);
        if (options.createFailure) throw new Error(options.createFailure);
        const tab = { id: state.nextTabId++, url: value.url };
        state.tabs.set(tab.id, tab);
        return tab;
      },
      async get(id) {
        if (!state.tabs.has(id)) throw new Error('No tab with id');
        return clone(state.tabs.get(id));
      },
      async update(id, value) {
        calls.update.push({ id, ...value });
        if (!state.tabs.has(id)) throw new Error('No tab with id');
        const tab = { ...state.tabs.get(id), ...value };
        state.tabs.set(id, tab);
        return clone(tab);
      },
    },
  };
  const context = vm.createContext({
    chrome, URL, TextEncoder, crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(state.nextToken++).padStart(12, '0')}` },
  });
  vm.runInContext(source, context, { filename: 'extension/background.js' });
  const message = (value, sender) => new Promise(resolve => {
    const retained = events.message(value, sender, response => resolve(clone(response)));
    if (retained === false) resolve(undefined);
  });
  return { state, calls, events, context, message };
}

test('top-level events create a packaged session report and preserve extra collector fields', async () => {
  const run = harness();
  assert.deepEqual(Object.keys(run.events).sort(), ['action', 'command', 'message', 'removed']);
  await run.events.action(run.state.tabs.get(1));
  assert.equal(run.calls.execute.length, 1);
  assert.equal(run.calls.execute[0].target.tabId, 1);
  assert.equal(run.calls.create[0].url, extensionOrigin + '/report.html?id=' + token);
  assert.equal(run.state.storage[reportKey].reportTabId, 100);
  assert.equal(run.state.storage[reportKey].sourceTabId, 1);
  assert.equal(run.state.storage[reportKey].data.images[0].lazySource, 'lazy.png');
  assert.equal(run.state.storage[reportKey].data.images[0].ariaLabelledby, 'caption');
  assert.equal(run.state.storage[reportKey].data.images[0].role, 'presentation');
  assert.equal(run.state.storage[reportKey].data.images[0].ariaHidden, 'true');
  assert.equal(run.state.storage[reportKey].data.images[0].hiddenAttribute, true);
  assert.equal(run.state.storage[reportKey].data.scan.containersVisited, 2);
  assert.equal(run.calls.badges.at(-1).text, '');
});

test('duplicate activation during one scan injects and creates a report only once', async () => {
  const pending = deferred();
  const run = harness({ execute: () => pending.promise });
  const first = run.events.action(run.state.tabs.get(1));
  const second = run.events.command('activate_extension', run.state.tabs.get(1));
  await second;
  pending.resolve([{ frameId: 0, result: snapshot() }]);
  await first;
  assert.equal(run.calls.execute.length, 1);
  assert.equal(run.calls.create.length, 1);
});

test('unsupported target and injection denial produce actionable error views without rejection', async () => {
  const invalid = harness();
  await invalid.events.action({ id: 1, url: 'chrome://settings' });
  assert.equal(invalid.calls.execute.length, 0);
  assert.match(invalid.state.storage[reportKey].error, /HTTP and HTTPS/);
  assert.equal(invalid.state.storage[reportKey].data, null);
  const absent = harness();
  await absent.events.action(undefined);
  assert.equal(absent.calls.execute.length, 0);
  assert.match(absent.state.storage[reportKey].error, /normal website tab/);
  const denied = harness({ execute: async () => { throw new Error('Cannot access contents'); } });
  await denied.events.action(denied.state.tabs.get(1));
  assert.match(denied.state.storage[reportKey].error, /protected.*navigated.*extension access/);
});

test('invalid reports and oversized metadata produce actionable errors', async () => {
  const invalid = harness({ execute: async () => [{ frameId: 0, result: { unsafe: true } }] });
  await invalid.events.action(invalid.state.tabs.get(1));
  assert.match(invalid.state.storage[reportKey].error, /valid image report/);
  const oversized = harness({ execute: async () => [{ frameId: 0, result: snapshot({ extra: 'x'.repeat(2 * 1024 * 1024) }) }] });
  await oversized.events.action(oversized.state.tabs.get(1));
  assert.equal(oversized.state.storage[reportKey].data, null);
  assert.match(oversized.state.storage[reportKey].error, /metadata alone.*2 MB/);
});

test('large image snapshots retain useful partial results below the byte budget', async () => {
  const original = snapshot({ images: Array.from({ length: 4 }, (_, id) => ({
    ...snapshot().images[0], id, alt: 'a'.repeat(800_000), altState: 'present',
  })) });
  const run = harness({ execute: async () => [{ frameId: 0, result: original }] });
  await run.events.action(run.state.tabs.get(1));
  const result = run.state.storage[reportKey].data;
  assert.equal(run.state.storage[reportKey].error, null);
  assert.equal(result.images.length, 2);
  assert.equal(result.scan.partial, true);
  assert.equal(result.scan.reason, 'payload-limit');
  assert.match(result.scan.warnings.at(-1), /retained 2 of 4 images; 2 were omitted/);
  assert.ok(new TextEncoder().encode(JSON.stringify(result)).byteLength < 2 * 1024 * 1024);
  assert.equal(original.images.length, 4);
  assert.equal(original.scan.partial, false);
  assert.equal(result.images[0].ariaLabelledby, 'caption');
});

test('over-cap image counts become explicitly partial instead of failing', async () => {
  const original = snapshot({ images: Array.from({ length: 503 }, (_, id) => ({ ...snapshot().images[0], id })) });
  const run = harness({ execute: async () => [{ frameId: 0, result: original }] });
  await run.events.action(run.state.tabs.get(1));
  const result = run.state.storage[reportKey].data;
  assert.equal(result.images.length, 500);
  assert.equal(result.scan.reason, 'image-limit');
  assert.equal(result.scan.partial, true);
  assert.match(result.scan.warnings.at(-1), /500 of 503 images; 3 were omitted/);
});

test('simultaneous scans cannot overfill the ten-report cap or evict existing reports', async () => {
  const run = harness();
  for (let i = 0; i < 9; i += 1) run.state.storage['report:existing-' + i] = { reportTabId: 200 + i };
  await Promise.all([run.events.action(run.state.tabs.get(1)), run.events.action(run.state.tabs.get(2))]);
  assert.equal(Object.keys(run.state.storage).length, 10);
  assert.equal(run.calls.create.length, 1);
  assert.equal(run.calls.removedKeys.length, 0);
  assert.ok(run.calls.titles.some(value => /Ten A11y Chats reports/.test(value.title)));
});

test('storage and tab-opening failures clean reservations and produce a badge/title fallback', async () => {
  const full = harness({ storageFailure: 'QUOTA_BYTES exceeded' });
  await full.events.action(full.state.tabs.get(1));
  assert.deepEqual(full.state.storage, {});
  assert.match(full.calls.titles.at(-1).title, /Session storage is full.*Close/);
  assert.equal(full.calls.badges.at(-1).text, '!');
  const failedTab = harness({ createFailure: 'Report window unavailable' });
  await failedTab.events.action(failedTab.state.tabs.get(1));
  assert.deepEqual(failedTab.state.storage, {});
  assert.equal(failedTab.calls.badges.at(-1).text, '!');
});

test('rescan requires the exact packaged report path, token, and stored requesting tab', async () => {
  const run = harness();
  await run.events.action(run.state.tabs.get(1));
  const validSender = { url: extensionOrigin + '/report.html?id=' + token, tab: { id: 100 } };
  for (const sender of [
    { ...validSender, url: 'https://fixture.invalid/report.html?id=' + token },
    { ...validSender, url: extensionOrigin + '/report.html.evil?id=' + token },
    { ...validSender, tab: { id: 101 } },
    { ...validSender, url: extensionOrigin + '/report.html?id=other' },
  ]) {
    assert.equal((await run.message({ type: 'rescan', id: token }, sender)).ok, false);
  }
  assert.equal(await run.message({ type: 'delete-everything', id: token }, validSender), undefined);
  assert.equal(run.calls.execute.length, 1);
  assert.deepEqual(await run.message({ type: 'rescan', id: token }, validSender), { ok: true });
  assert.equal(run.calls.execute.length, 2);
  assert.equal(run.calls.create.length, 1);
  assert.deepEqual(run.calls.update, [{ id: 1, active: true }]);
});

test('worker restart retains source association and closing a report clears only its session entry', async () => {
  const initial = harness();
  await initial.events.action(initial.state.tabs.get(1));
  const restarted = harness({ state: initial.state });
  const sender = { url: extensionOrigin + '/report.html?id=' + token, tab: { id: 100 } };
  assert.deepEqual(await restarted.message({ type: 'rescan', id: token }, sender), { ok: true });
  await restarted.events.removed(1);
  assert.ok(restarted.state.storage[reportKey]);
  await restarted.events.removed(100);
  assert.equal(restarted.state.storage[reportKey], undefined);
});

test('closing a report during rescan cannot resurrect its stored snapshot', async () => {
  const initial = harness();
  await initial.events.action(initial.state.tabs.get(1));
  const pending = deferred();
  const started = deferred();
  const run = harness({ state: initial.state, execute: () => { started.resolve(); return pending.promise; } });
  const sender = { url: extensionOrigin + '/report.html?id=' + token, tab: { id: 100 } };
  const rescan = run.message({ type: 'rescan', id: token }, sender);
  await started.promise;
  await run.events.removed(100);
  pending.resolve([{ frameId: 0, result: snapshot() }]);
  assert.equal((await rescan).ok, false);
  assert.equal(run.state.storage[reportKey], undefined);
});
