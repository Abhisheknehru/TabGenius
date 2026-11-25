/* Research UI uses DOM text nodes for every user-controlled value. */
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  let data = null;
  let windowId = null;
  let dirty = false;
  let busy = false;
  const sourceDrafts = new Map();
  const project = () => data?.workspaces.find(w => w.id === data.activeId);
  const status = (message, error = false) => {
    $('researchStatus').textContent = message;
    $('researchStatus').classList.toggle('error', error);
  };
  async function request(action, args = {}) {
    const response = await chrome.runtime.sendMessage({ action: `research:${action}`, ...args });
    if (!response?.success) throw new Error(response?.error || 'Could not reach TabGenius. Please reopen the popup.');
    return response;
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    $('research').setAttribute('aria-busy', 'true');
    $('research').inert = true;
    try { await action(); } catch (error) { status(error.message, true); }
    finally {
      $('research').inert = false;
      busy = false;
      $('research').removeAttribute('aria-busy');
      $('workspaceActions').hidden = !project();
    }
  }
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function button(label, action) {
    const element = node('button', label);
    element.type = 'button';
    element.addEventListener('click', () => run(action));
    return element;
  }
  function choices(select, selected, includeNone = false) {
    select.replaceChildren();
    if (includeNone) select.append(new Option('No project', ''));
    for (const workspace of data.workspaces) select.append(new Option(workspace.name, workspace.id));
    select.value = selected || '';
  }
  function render() {
    const workspace = project();
    choices($('workspaceSelect'), data.activeId);
    $('workspaceSelect').disabled = !data.workspaces.length;
    $('workspaceActions').hidden = !workspace;
    $('researchEmpty').hidden = Boolean(workspace);
    if (!workspace) return;
    $('workspaceName').value = workspace.name;
    $('workspaceNotes').value = workspace.notes;
    dirty = false;
    $('workspaceMeta').textContent = `${workspace.resources.length} saved sources · Updated ${new Date(workspace.updatedAt).toLocaleDateString()}`;
    renderSources();
  }
  function renderSources() {
    const workspace = project();
    const list = $('researchSources');
    list.replaceChildren();
    if (!workspace) return;
    const query = $('sourceSearch').value.trim().toLowerCase();
    const type = $('sourceType').value;
    const resources = workspace.resources.filter(r => (!type || r.type === type) && `${r.title} ${r.url} ${r.notes}`.toLowerCase().includes(query));
    if (!resources.length) list.append(node('p', workspace.resources.length ? 'No sources match this search.' : 'Save tabs to start collecting sources.', 'research-muted'));
    for (const resource of resources) {
      const card = node('article', undefined, 'research-source');
      const link = node('a', resource.title);
      link.href = ResearchWorkspace.safeUrl(resource.url);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      card.append(link, node('p', new URL(resource.url).hostname, 'research-muted'));
      const details = node('details');
      details.append(node('summary', `${resource.type} · Notes & actions`));
      const selectLabel = node('label', 'Source type');
      const select = node('select');
      for (const type of ResearchWorkspace.TYPES) select.append(new Option(type, type));
      const draft = sourceDrafts.get(resource.id);
      select.value = draft?.type || resource.type;
      selectLabel.append(select);
      const notesLabel = node('label', 'Source notes');
      const notes = node('textarea');
      notes.rows = 3;
      notes.maxLength = 4000;
      notes.value = draft?.notes ?? resource.notes;
      const remember = () => sourceDrafts.set(resource.id, { notes: notes.value, type: select.value });
      notes.addEventListener('input', remember);
      select.addEventListener('change', remember);
      notes.placeholder = 'Key result, useful code, or a question to revisit…';
      notesLabel.append(notes);
      const row = node('div', undefined, 'research-row');
      row.append(button('Save source notes', async () => {
        data = (await request('updateResource', { id: workspace.id, resourceId: resource.id, patch: { notes: notes.value, type: select.value } })).data;
        sourceDrafts.delete(resource.id);
        details.querySelector('summary').textContent = `${select.value} · Notes & actions`;
        status('Source notes saved.');
      }), button('Remove', async () => {
        if (!confirm('Remove this saved source and its notes? Open browser tabs will stay open.')) return;
        data = (await request('removeResource', { id: workspace.id, resourceId: resource.id })).data;
        renderSources();
        $('workspaceMeta').textContent = `${project().resources.length} saved sources`;
        status('Source removed.');
      }));
      details.append(selectLabel, notesLabel, row);
      card.append(details);
      list.append(card);
    }
  }
  async function refreshTabs() {
    const window = await chrome.windows.getCurrent();
    windowId = window.id;
    const tabs = (await chrome.tabs.query({ windowId })).filter(tab => !tab.incognito && ResearchWorkspace.safeUrl(tab.url));
    const list = $('researchOpenTabs');
    list.replaceChildren();
    if (!tabs.length) list.append(node('p', 'No regular web tabs in this window.', 'research-muted'));
    for (const tab of tabs) {
      const label = node('label', undefined, 'research-tab-choice');
      const check = node('input');
      check.type = 'checkbox';
      check.value = String(tab.id);
      check.checked = true;
      label.append(check, node('span', tab.title || tab.url));
      list.append(label);
    }
    $('openTabCount').textContent = `Choose tabs from this window (${tabs.length})`;
  }
  async function syncFocus() {
    if (!data) return;
    const { focusModeState: state } = await chrome.storage.local.get('focusModeState');
    const select = $('focusProject');
    const selected = state?.active ? state.projectId : (select.value || data.activeId);
    choices(select, selected, true);
    if (state?.active && state.projectId && !data.workspaces.some(w => w.id === state.projectId)) {
      select.append(new Option(`${state.projectName} (deleted)`, state.projectId));
      select.value = state.projectId;
    }
    select.disabled = Boolean(state?.active);
    $('focusTask').disabled = Boolean(state?.active);
    if (state?.active) $('focusTask').value = state.task || '';
    const today = new Date().toLocaleDateString();
    const sessions = data.sessions.filter(s => new Date(s.endedAt).toLocaleDateString() === today);
    $('todayFocusSessions').textContent = sessions.filter(s => s.completed).length;
    $('todayFocusMinutes').textContent = Math.floor(sessions.reduce((sum, s) => sum + s.elapsedMs, 0) / 60000);
    $('todayFocusProjects').textContent = new Set(sessions.map(s => s.projectId).filter(Boolean)).size;
    const list = $('researchSessions');
    list.replaceChildren();
    const recent = [...data.sessions].reverse().filter(s => s.projectId === data.activeId).slice(0, 5);
    for (const session of recent) {
      list.append(node('li', `${session.task || 'Research session'} · ${Math.floor(session.elapsedMs / 60000)} min · ${session.completed ? 'Completed' : 'Stopped'} · ${new Date(session.endedAt).toLocaleDateString()}`));
    }
    $('researchSessionEmpty').hidden = recent.length > 0;
  }
  $('createWorkspace').addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      if (dirty && !confirm('Discard unsaved project notes?')) return;
      data = (await request('create', { name: $('newWorkspaceName').value })).data;
      $('newWorkspaceName').value = '';
      render();
      await syncFocus();
      status('Project created. Choose tabs below to save your research.');
    });
  });
  $('workspaceSelect').addEventListener('change', () => run(async () => {
    const id = $('workspaceSelect').value;
    if (dirty && !confirm('Discard unsaved project notes?')) { $('workspaceSelect').value = data.activeId; return; }
    data = (await request('select', { id })).data;
    $('sourceSearch').value = '';
    $('sourceType').value = '';
    render();
    $('focusProject').value = data.activeId;
    await syncFocus();
    status('Project opened.');
  }));
  for (const id of ['workspaceName', 'workspaceNotes']) $(id).addEventListener('input', () => { dirty = true; status('Project has unsaved changes.'); });
  $('workspaceForm').addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      data = (await request('update', { id: data.activeId, patch: { name: $('workspaceName').value, notes: $('workspaceNotes').value } })).data;
      dirty = false;
      choices($('workspaceSelect'), data.activeId);
      await syncFocus();
      status('Project notes saved.');
    });
  });
  $('refreshResearchTabs').addEventListener('click', () => run(refreshTabs));
  $('selectResearchTabs').addEventListener('click', () => {
    const checks = [...$('researchOpenTabs').querySelectorAll('input')];
    const checked = !checks.every(input => input.checked);
    checks.forEach(input => { input.checked = checked; });
  });
  async function saveTabs(replace) {
    const tabIds = [...$('researchOpenTabs').querySelectorAll('input:checked')].map(input => Number(input.value));
    if (!tabIds.length) throw new Error('Select at least one tab.');
    if (replace && !confirm('Replace the saved tab collection with your selection? Notes for retained URLs will be kept.')) return;
    const result = await request('saveTabs', { id: data.activeId, windowId, tabIds, replace });
    data = result.data;
    renderSources();
    $('workspaceMeta').textContent = `${project().resources.length} saved sources`;
    status(`Saved ${result.count} tabs. Existing source notes were kept.`);
  }
  $('saveResearchTabs').addEventListener('click', () => run(() => saveTabs(false)));
  $('replaceResearchTabs').addEventListener('click', () => run(() => saveTabs(true)));
  $('restoreWorkspace').addEventListener('click', () => run(async () => {
    status('Opening your saved sources in a new window…');
    const result = await request('restore', { id: data.activeId });
    status(`Restored ${result.restored} sources in a new window.`);
  }));
  $('deleteWorkspace').addEventListener('click', () => run(async () => {
    if (!confirm(`Delete “${project().name}” and its saved notes? Browser tabs will stay open.`)) return;
    data = (await request('delete', { id: data.activeId })).data;
    render();
    await syncFocus();
    status('Project deleted.');
  }));
  $('exportWorkspace').addEventListener('click', () => run(async () => {
    if (dirty || project().resources.some(r => sourceDrafts.has(r.id))) throw new Error('Save your project and source notes before exporting.');
    const workspace = project();
    const blob = new Blob([ResearchWorkspace.markdown(workspace)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = node('a');
    link.href = url;
    link.download = `${workspace.name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'research'}.md`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Research notes exported as Markdown.');
  }));
  $('sourceSearch').addEventListener('input', renderSources);
  $('sourceType').addEventListener('change', renderSources);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.focusModeState || changes[ResearchWorkspace.KEY])) {
      request('get').then(async result => { data = result.data; await syncFocus(); }).catch(error => status(error.message, true));
    }
  });
  run(async () => { data = (await request('get')).data; render(); await refreshTabs(); await syncFocus(); });
});
