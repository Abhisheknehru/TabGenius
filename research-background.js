/* Runs inside the extension service worker. All writes share one queue. */
const researchStore = ResearchWorkspace.createStore(chrome.storage.local);
let researchRestoreQueue = Promise.resolve();

async function handleResearchRequest(request, sender) {
  // Page content scripts cannot read or edit the user's research library.
  const extensionRoot = chrome.runtime.getURL('');
  if (!sender.url?.startsWith(extensionRoot)) throw new Error('Open TabGenius to manage projects.');
  switch (request.action) {
    case 'research:get': return { data: await researchStore.read() };
    case 'research:create': return { data: await researchStore.create(request.name) };
    case 'research:select': return { data: await researchStore.select(request.id) };
    case 'research:update': return { data: await researchStore.update(request.id, request.patch || {}) };
    case 'research:delete': return { data: await researchStore.delete(request.id) };
    case 'research:updateResource': return { data: await researchStore.updateResource(request.id, request.resourceId, request.patch || {}) };
    case 'research:removeResource': return { data: await researchStore.removeResource(request.id, request.resourceId) };
    case 'research:saveTabs': {
      if (!Number.isInteger(request.windowId) || !Array.isArray(request.tabIds) || !request.tabIds.length) throw new Error('Select at least one tab.');
      const selected = new Set(request.tabIds);
      const tabs = (await chrome.tabs.query({ windowId: request.windowId })).filter(t => selected.has(t.id) && !t.incognito && ResearchWorkspace.safeUrl(t.url));
      if (!tabs.length) throw new Error('Those tabs are no longer available. Refresh the tab list.');
      const groups = {};
      for (const groupId of new Set(tabs.map(t => t.groupId).filter(id => id >= 0))) {
        try { groups[groupId] = await chrome.tabGroups.get(groupId); } catch { /* Group was removed. */ }
      }
      return { data: await researchStore.saveTabs(request.id, tabs, groups, request.replace === true), count: tabs.length };
    }
    case 'research:restore': {
      const result = researchRestoreQueue.then(() => restoreResearchWorkspace(request.id));
      researchRestoreQueue = result.catch(() => {});
      return result;
    }
    default: throw new Error('Unknown project action.');
  }
}

async function restoreResearchWorkspace(id) {
  const data = await researchStore.read();
  const workspace = data.workspaces.find(w => w.id === id);
  if (!workspace) throw new Error('Project no longer exists.');
  const resources = workspace.resources.filter(r => ResearchWorkspace.safeUrl(r.url));
  if (!resources.length) throw new Error('Save some tabs before restoring this project.');
  // A new window leaves the current research session untouched.
  const window = await chrome.windows.create({ url: 'about:blank', focused: true });
  const existing = await chrome.storage.session.get('researchRestoreWindows');
  await chrome.storage.session.set({ researchRestoreWindows: [...(existing.researchRestoreWindows || []), window.id] });
  const groups = new Map();
  let restored = 0;
  try {
    for (const resource of resources) {
      const tab = await chrome.tabs.create({ windowId: window.id, url: resource.url, active: false, pinned: resource.pinned });
      restored++;
      if (resource.group && !resource.pinned) {
        const group = groups.get(resource.group.key) || { ...resource.group, ids: [] };
        group.ids.push(tab.id);
        groups.set(resource.group.key, group);
      }
    }
    for (const group of groups.values()) {
      const groupId = await chrome.tabs.group({ tabIds: group.ids });
      await chrome.tabGroups.update(groupId, { title: group.title, color: group.color, collapsed: group.collapsed });
    }
    if (window.tabs?.[0]) await chrome.tabs.remove(window.tabs[0].id);
    await researchStore.select(id);
    return { restored };
  } catch (error) {
    // Preserve any tabs already restored; the saved workspace remains unchanged.
    throw new Error(`Restored ${restored} of ${resources.length} tabs. ${error.message}`);
  }
}
