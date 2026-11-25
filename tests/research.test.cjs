const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../research-core.js');
const root = path.join(__dirname, '..');
function memory() {
  let data = {};
  return {
    get: async keys => {
      if (!keys) return structuredClone(data);
      return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(data[key])]));
    },
    set: async patch => { Object.assign(data, structuredClone(patch)); },
    remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; },
    clear: async () => { data = {}; }
  };
}
function fixture() {
  const storage = memory();
  let next = 0;
  return { storage, store: core.createStore(storage, () => `id-${++next}`, () => 100000) };
}
function worker() {
  const local = memory(), session = memory();
  const events = {}, calls = { windows: [], tabs: [], groups: [], rules: [], updates: [] };
  const event = name => ({ addListener: listener => { (events[name] ||= []).push(listener); } });
  let nextTab = 10, nextGroup = 100;
  const chrome = {
    storage: { local, session, sync: memory(), onChanged: event('storage') },
    runtime: { onStartup: event('startup'), onInstalled: event('installed'), onMessage: event('message'), getURL: file => `chrome-extension://test/${file}` },
    contextMenus: { onClicked: event('contextMenu') },
    tabs: {
      onCreated: event('created'), onRemoved: event('removed'), onUpdated: event('updated'), onActivated: event('activated'),
      query: async () => calls.tabs,
      create: async args => { const tab = { ...args, id: ++nextTab }; calls.tabs.push(tab); return tab; },
      remove: async id => { calls.removed = id; },
      group: async args => { calls.groups.push(args); return ++nextGroup; }
    },
    tabGroups: { update: async (id, args) => calls.updates.push({ id, ...args }), get: async id => ({ title: 'Papers', color: 'blue', collapsed: true }) },
    alarms: { onAlarm: event('alarm'), create: async () => {}, clear: async () => {} },
    notifications: { onClicked: event('notification'), create: async () => {} },
    action: { onClicked: event('action'), setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    commands: { onCommand: event('command') }, idle: { onStateChanged: event('idle') }, windows: {
      onFocusChanged: event('window'),
      create: async args => { calls.windows.push(args); return { id: 2, tabs: [{ id: 9 }] }; }
    },
    declarativeNetRequest: {
      updateEnabledRulesets: async () => {}, getDynamicRules: async () => calls.rules,
      updateDynamicRules: async args => { calls.rules = args.addRules || []; }
    }
  };
  let time = 100000;
  class TestDate extends Date { static now() { return time; } }
  const context = vm.createContext({ chrome, Date: TestDate, URL, Set, Map, crypto: require('node:crypto').webcrypto, structuredClone, console: { log() {}, error() {} } });
  context.importScripts = (...files) => files.forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context));
  vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), context);
  function send(message, sender = { url: 'chrome-extension://test/popup.html' }) {
    return new Promise(resolve => events.message[0](message, sender, resolve));
  }
  return { chrome, local, session, events, calls, send, tick: ms => { time += ms; } };
}

test('classification and safe protocols', () => {
  assert.equal(core.classify('https://arxiv.org/abs/1234'), 'Paper');
  assert.equal(core.classify('https://github.com/org/repo'), 'Repository');
  assert.equal(core.classify('https://docs.ros.org/en/'), 'Documentation');
  assert.equal(core.safeUrl('javascript:alert(1)'), null);
  assert.equal(core.safeUrl('file:///secret'), null);
  assert.equal(core.safeUrl('https://user:password@example.com'), null);
});

test('workspace mutations serialize concurrent writes and survive a new store', async () => {
  const { store, storage } = fixture();
  await Promise.all([store.create('Robotics'), store.create('Literature')]);
  const saved = await core.createStore(storage).read();
  assert.equal(saved.workspaces.length, 2);
  assert.equal(saved.activeId, saved.workspaces[1].id);
});

test('saving tabs deduplicates URLs, excludes private/internal pages, and retains source notes on replacement', async () => {
  const { store } = fixture();
  const created = await store.create('VLA');
  const id = created.activeId;
  const tab = { url: 'https://arxiv.org/abs/1234', title: 'Paper', groupId: 2, pinned: false };
  let saved = await store.saveTabs(id, [tab, tab, { url: 'chrome://settings' }, { url: 'https://private.test', incognito: true }], { 2: { title: 'Papers', color: 'blue', collapsed: true } });
  assert.equal(saved.workspaces[0].resources.length, 1);
  const resourceId = saved.workspaces[0].resources[0].id;
  await store.updateResource(id, resourceId, { notes: 'Compare training data', type: 'Other' });
  saved = await store.saveTabs(id, [{ ...tab, title: 'Updated title' }], {}, true);
  assert.equal(saved.workspaces[0].resources[0].notes, 'Compare training data');
  assert.equal(saved.workspaces[0].resources[0].type, 'Other');
  assert.equal(saved.workspaces[0].resources[0].title, 'Updated title');
});

test('invalid mutation does not poison subsequent saves; deletion preserves historical sessions', async () => {
  const { store } = fixture();
  await assert.rejects(store.create('  '), /name/);
  let data = await store.create('Research');
  const id = data.activeId;
  await store.recordSession({ id: 'focus1', projectId: id });
  await store.recordSession({ id: 'focus1', projectId: id });
  data = await store.delete(id);
  assert.equal(data.activeId, null);
  assert.equal(data.sessions.length, 1);
  await assert.rejects(store.update(id, { notes: 'lost' }), /no longer exists/);
});

test('Markdown export contains project and source notes and escapes source titles', async () => {
  const { store } = fixture();
  let data = await store.create('Research');
  await store.update(data.activeId, { notes: 'Next: compare results' });
  data = await store.saveTabs(data.activeId, [{ url: 'https://example.com/paper.pdf', title: '[Paper](bad)' }], {});
  const output = core.markdown(data.workspaces[0]);
  assert.match(output, /Next: compare results/);
  assert.match(output, /https:\/\/example.com\/paper.pdf/);
  assert.ok(output.includes('\\[Paper\\]'));
});

test('tab listeners register when worker starts, and content scripts cannot access research data', async () => {
  const w = worker();
  assert.equal(w.events.created.length, 1);
  assert.equal(w.events.updated.length, 1);
  const denied = await w.send({ action: 'research:get' }, { url: 'https://example.com', tab: { id: 1 } });
  assert.equal(denied.success, false);
  const allowed = await w.send({ action: 'research:create', name: 'Research' });
  assert.equal(allowed.success, true);
});

test('restore creates a new window with pinned tabs and original group metadata', async () => {
  const w = worker();
  const data = (await w.send({ action: 'research:create', name: 'Robotics' })).data;
  w.calls.tabs.push(
    { id: 1, url: 'https://github.com/org/repo', title: 'Repo', pinned: true, groupId: -1 },
    { id: 2, url: 'https://arxiv.org/abs/1', title: 'Paper', pinned: false, groupId: 3 }
  );
  await w.send({ action: 'research:saveTabs', id: data.activeId, windowId: 1, tabIds: [1, 2] });
  const response = await w.send({ action: 'research:restore', id: data.activeId });
  assert.equal(response.restored, 2);
  assert.equal(w.calls.windows.length, 1);
  assert.equal(w.calls.tabs[2].pinned, true);
  assert.equal(w.calls.updates[0].title, 'Papers');
  assert.equal(w.calls.updates[0].collapsed, true);
  assert.equal(w.calls.removed, 9);
  assert.ok((await w.session.get('researchRestoreWindows')).researchRestoreWindows.includes(2));
});

test('stopping a paused project focus session excludes pause time and records task history', async () => {
  const w = worker();
  const data = (await w.send({ action: 'research:create', name: 'Research' })).data;
  assert.equal((await w.send({ action: 'startFocusMode', duration: 300, projectId: data.activeId, task: 'Compare papers' })).success, true);
  w.tick(60000);
  await w.send({ action: 'pauseFocusMode' });
  w.tick(600000);
  await w.send({ action: 'endFocusMode' });
  const session = (await w.send({ action: 'research:get' })).data.sessions[0];
  assert.equal(session.elapsedMs, 60000);
  assert.equal(session.completed, false);
  assert.equal(session.task, 'Compare papers');
  assert.equal(session.projectId, data.activeId);
});

test('completed focus records bounded actual work once', async () => {
  const w = worker();
  await w.send({ action: 'startFocusMode', duration: 60 });
  w.tick(120000);
  await w.send({ action: 'getFocusModeState' });
  await w.send({ action: 'endFocusMode' });
  const data = (await w.send({ action: 'research:get' })).data;
  assert.equal(data.sessions.length, 1);
  assert.equal(data.sessions[0].elapsedMs, 60000);
  assert.equal(data.sessions[0].completed, true);
});

test('invalid focus duration and nonexistent project return actionable failures', async () => {
  const w = worker();
  assert.equal((await w.send({ action: 'startFocusMode', duration: -1 })).success, false);
  assert.equal((await w.send({ action: 'startFocusMode', duration: 60, projectId: 'missing' })).success, false);
});

test('concurrent end requests do not duplicate sessions or completion counters', async () => {
  const w = worker();
  await w.send({ action: 'startFocusMode', duration: 60 });
  w.tick(60000);
  await Promise.all([w.send({ action: 'endFocusMode' }), w.send({ action: 'endFocusMode' })]);
  const saved = await w.local.get(['researchWorkspaceData', 'performanceStats']);
  assert.equal(saved.researchWorkspaceData.sessions.length, 1);
  assert.equal(saved.performanceStats.focusSessionsCompleted, 1);
});

test('partial restore reports progress and leaves the saved collection intact', async () => {
  const w = worker();
  const data = (await w.send({ action: 'research:create', name: 'Research' })).data;
  w.calls.tabs.push({ id: 1, url: 'https://example.com', pinned: false, groupId: -1 });
  await w.send({ action: 'research:saveTabs', id: data.activeId, windowId: 1, tabIds: [1] });
  w.chrome.tabs.create = async () => { throw new Error('Window was closed'); };
  const result = await w.send({ action: 'research:restore', id: data.activeId });
  assert.equal(result.success, false);
  assert.match(result.error, /Restored 0 of 1 tabs/);
  assert.equal((await w.send({ action: 'research:get' })).data.workspaces[0].resources.length, 1);
});

test('focus unblocks and clears state even if history storage is full', async () => {
  const w = worker();
  await w.send({ action: 'startFocusMode', duration: 60 });
  const set = w.local.set;
  w.local.set = async patch => {
    if (patch.researchWorkspaceData) throw new Error('Storage quota exceeded');
    return set(patch);
  };
  const result = await w.send({ action: 'endFocusMode' });
  assert.equal(result.success, false);
  const state = await w.local.get(['focusModeState', 'focusModeActive']);
  assert.equal(state.focusModeState, undefined);
  assert.equal(state.focusModeActive, false);
});

test('a second popup does not claim background research requests with an empty Promise response', async () => {
  const source = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');
  const start = source.indexOf('// Context menu integration');
  const end = source.indexOf('async function analyzeCurrentTab()', start);
  let listener;
  let grouped = false;
  vm.runInNewContext(source.slice(start, end), {
    chrome: { runtime: { onMessage: { addListener: fn => { listener = fn; } } } },
    groupSimilarTabs: async () => { grouped = true; },
    console
  });
  assert.equal(listener({ action: 'research:get' }, {}, () => {}), undefined);
  assert.equal(listener({ action: 'research:create', name: 'Research' }, {}, () => {}), undefined);
  assert.equal(listener({ action: 'contextMenuAction', menuItemId: 'groupSimilarTabs' }, {}, () => {}), undefined);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(grouped, true);
});
