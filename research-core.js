/* Shared workspace model. No page content is uploaded or fetched. */
(function (root) {
  'use strict';
  const KEY = 'researchWorkspaceData';
  const TYPES = ['Paper', 'Repository', 'Documentation', 'Other'];
  function text(value, max = 10000) { return String(value ?? '').trim().slice(0, max); }
  function safeUrl(value) {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  }
  function classify(value) {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    if (['github.com', 'gitlab.com', 'bitbucket.org'].includes(host)) return 'Repository';
    if (/\.pdf$/i.test(url.pathname) || ['arxiv.org', 'openreview.net', 'doi.org', 'ieeexplore.ieee.org'].includes(host)) return 'Paper';
    if (host.startsWith('docs.') || host.startsWith('developer.') || /\/(docs?|documentation)(\/|$)/i.test(url.pathname)) return 'Documentation';
    return 'Other';
  }
  function empty() { return { version: 1, activeId: null, workspaces: [], sessions: [] }; }
  function createStore(storage, id = () => crypto.randomUUID(), now = () => Date.now()) {
    let queue = Promise.resolve();
    async function read() {
      const saved = (await storage.get(KEY))[KEY];
      if (!saved) return empty();
      if (saved.version !== 1 || !Array.isArray(saved.workspaces) || !Array.isArray(saved.sessions)) throw new Error('Workspace data is unreadable. Export your data before resetting it.');
      return structuredClone(saved);
    }
    function mutate(fn) {
      const result = queue.then(async () => {
        const data = await read();
        await fn(data);
        await storage.set({ [KEY]: data });
        return data;
      });
      queue = result.catch(() => {});
      return result;
    }
    function find(data, workspaceId) {
      const item = data.workspaces.find(w => w.id === workspaceId);
      if (!item) throw new Error('Project no longer exists.');
      return item;
    }
    return {
      read: () => queue.then(read),
      create: name => mutate(data => {
        const title = text(name, 100);
        if (!title) throw new Error('Enter a project name.');
        if (data.workspaces.length >= 100) throw new Error('You can save up to 100 projects.');
        const workspace = { id: id(), name: title, notes: '', resources: [], createdAt: now(), updatedAt: now() };
        data.workspaces.push(workspace);
        data.activeId = workspace.id;
      }),
      select: workspaceId => mutate(data => { find(data, workspaceId); data.activeId = workspaceId; }),
      update: (workspaceId, patch) => mutate(data => {
        const workspace = find(data, workspaceId);
        if ('name' in patch) {
          const name = text(patch.name, 100);
          if (!name) throw new Error('Project name cannot be empty.');
          workspace.name = name;
        }
        if ('notes' in patch) workspace.notes = text(patch.notes);
        workspace.updatedAt = now();
      }),
      delete: workspaceId => mutate(data => {
        find(data, workspaceId);
        data.workspaces = data.workspaces.filter(w => w.id !== workspaceId);
        if (data.activeId === workspaceId) data.activeId = data.workspaces[0]?.id || null;
      }),
      saveTabs: (workspaceId, tabs, groups, replace = false) => mutate(data => {
        const workspace = find(data, workspaceId);
        const previous = new Map(workspace.resources.map(r => [r.url, r]));
        const resources = replace ? [] : [...workspace.resources];
        for (const tab of tabs) {
          const url = safeUrl(tab.url);
          if (!url || tab.incognito) continue;
          const old = previous.get(url);
          const group = groups[tab.groupId];
          const resource = {
            id: old?.id || id(), url, title: text(tab.title || url, 500),
            type: old?.type || classify(url), notes: old?.notes || '', pinned: Boolean(tab.pinned),
            group: group ? { key: String(tab.groupId), title: text(group.title, 100), color: group.color, collapsed: Boolean(group.collapsed) } : null
          };
          const index = resources.findIndex(r => r.url === url);
          if (index < 0) resources.push(resource); else resources[index] = resource;
        }
        if (resources.length > 500) throw new Error('A project can contain up to 500 sources.');
        workspace.resources = resources;
        workspace.updatedAt = now();
      }),
      updateResource: (workspaceId, resourceId, patch) => mutate(data => {
        const workspace = find(data, workspaceId);
        const resource = workspace.resources.find(r => r.id === resourceId);
        if (!resource) throw new Error('Source no longer exists.');
        if ('notes' in patch) resource.notes = text(patch.notes, 4000);
        if (TYPES.includes(patch.type)) resource.type = patch.type;
        workspace.updatedAt = now();
      }),
      removeResource: (workspaceId, resourceId) => mutate(data => {
        const workspace = find(data, workspaceId);
        workspace.resources = workspace.resources.filter(r => r.id !== resourceId);
        workspace.updatedAt = now();
      }),
      recordSession: session => mutate(data => {
        if (data.sessions.some(s => s.id === session.id)) return;
        data.sessions.push(session);
        data.sessions = data.sessions.slice(-1000);
      })
    };
  }
  function markdown(workspace) {
    const escape = value => String(value).replace(/[\\`*_{}\[\]<>#|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
    const lines = [`# ${escape(workspace.name)}`, '', workspace.notes, '', '## Sources', ''];
    for (const r of workspace.resources) {
      const url = safeUrl(r.url);
      if (!url) continue;
      lines.push(`- [${escape(r.title)}](<${url.replace(/>/g, '%3E')}>) — ${r.type}`);
      if (r.notes) lines.push(...r.notes.split('\n').map(line => `  > ${line}`));
      lines.push('');
    }
    return lines.join('\n');
  }
  root.ResearchWorkspace = { KEY, TYPES, safeUrl, classify, createStore, markdown };
  if (typeof module !== 'undefined') module.exports = root.ResearchWorkspace;
})(globalThis);
