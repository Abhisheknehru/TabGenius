# TabGenius — Research Workspaces

A Chrome Manifest V3 extension for keeping research papers, repositories, documentation, and notes together. Save a project's tabs, resume its sources in a new window, and track focused work against a specific task.

## Install and run on Ubuntu

You need **Google Chrome** and **Git** installed on Ubuntu. There is no build step or API key, and you do not need Node.js to use the extension.

### 1. Get the repository

Open the Ubuntu terminal with **Ctrl + Alt + T**. For a first-time setup, clone the repository into your home directory:

```bash
cd ~
git clone https://github.com/Abhisheknehru/TabGenius.git
cd TabGenius
```

If you already cloned the repository, update your existing copy instead:

```bash
cd ~/TabGenius
git pull --ff-only origin main
```

These commands assume the repository is in `~/TabGenius`. If you cloned it elsewhere, use that directory instead. If Git reports local changes or diverging branches, resolve them before updating; do not force an update over your work.

### 2. Load the extension in Chrome

1. Open **Google Chrome** on Ubuntu.
2. Click the **Extensions** puzzle-piece icon near the address bar, then **Manage extensions**. Alternatively, enter `chrome://extensions` in the address bar.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. In the folder picker, select the cloned **TabGenius** directory. For the commands above, this is **Home → TabGenius** (`/home/<your-ubuntu-username>/TabGenius`). Select the directory containing `manifest.json`, rather than an individual file or a subfolder such as `assets`.
6. Click **Select Folder** (or **Open**, depending on the folder picker). The **TabGenius — Research Workspaces** card should appear on the extensions page.
7. Click Chrome's **Extensions** icon again and pin **TabGenius — Research Workspaces** to the toolbar.
8. Click the TabGenius toolbar icon. In **Research**, create a project, select some open web tabs, and click **Add selected tabs** to check that it works.

Keep the cloned directory in place: Chrome loads the unpacked extension from that location.

### 3. Apply future updates

Pull the latest changes in the terminal:

```bash
cd ~/TabGenius
git pull --ff-only origin main
```

Then open **Extensions → Manage extensions** (`chrome://extensions`) and click the **Reload** circular-arrow button on the TabGenius card. Close any open TabGenius pages and reopen the toolbar popup so they use the updated files. You only need **Load unpacked** for the initial installation.

## Research workflow

1. In **Research**, create a project such as “VLA literature review.”
2. Choose tabs from the current window and click **Add selected tabs**. Duplicate URLs are merged; notes for existing sources are retained.
3. Write research questions and next steps, then click **Save notes**. Each source also has its own notes and editable source type under **Notes & actions**. Click **Save source notes** to persist those edits.
4. Search saved sources by title, URL, or notes, or filter by Paper, Repository, Documentation, or Other. Source types are inferred from URLs and can be corrected manually.
5. In **Focus**, choose the project, enter a task, and start the timer. Project and task stay attached to the running session. Completed and interrupted sessions appear in project history; today's totals use this device's local date.
6. Click **Restore in new window** to reopen saved URLs, pins, and groups without closing your current window. Restored windows are excluded from automatic grouping for the current browser session so their saved groups are preserved.
7. Use **Export Markdown** to download the saved project notes and source links. Save pending project and source edits before exporting.

**Replace saved tabs** replaces the collection with the selected current tabs after confirmation. Notes for retained URLs survive. Removing a source or deleting a project leaves open browser tabs untouched. Deleting a project retains its historical focus records in local storage.

## Screenshots

<p align="center">
  <img src="assets/tabgenius2.png" width="45%" alt="Dashboard View" />
  &nbsp;&nbsp;
  <img src="assets/tabgenius1.png" width="45%" alt="Focus Mode" />
</p>
<p align="center">
  <em>Dashboard View &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Focus Mode</em>
</p>

## What is saved

Projects store titles, HTTP/HTTPS URLs, notes, pins, and tab-group metadata in `chrome.storage.local`. Private tabs, browser-internal pages, and URLs containing embedded credentials are excluded. This feature does not upload project data or fetch page content.

Restoration opens saved URLs; it does not capture scroll positions, login state, unsaved forms, or page contents. Repeated restores create additional windows. If restoration is interrupted, already-opened tabs stay open and the saved project remains available.

There are limits of 100 projects, 500 sources per project, 10,000 characters per project note, 4,000 characters per source note, and the most recent 1,000 focus sessions. Chrome's extension storage quota also applies; failed writes surface an error rather than silently discarding the previous collection. Export valuable notes regularly: local extension storage is removed when the extension is uninstalled.

Existing grouping, pinning, cleanup, bookmarks, and focus blocking remain available under **Overview**, **Actions**, and **Focus**. **Insights** provides local statistics and rule-based suggestions; it does not use an AI model.

## Development and checks

No dependencies are required. Run the workspace and background integration checks with Node.js 20 or later:

```bash
node tests/research.test.cjs
```

The checks cover persistence and concurrent saves, source-note retention, filtering of unsupported/private URLs, Markdown export, content-script access restrictions, window/group restoration, and project focus accounting. They use mocked Chrome APIs. A live extension check is still useful after loading the unpacked extension.

Main files:

| File | Purpose |
|---|---|
| `research-core.js` | Workspace storage, serialized writes, classification, Markdown export |
| `research-background.js` | Validated project requests and tab restoration |
| `research.js`, `research.css` | Research and project-focus UI |
| `popup.html`, `popup.js`, `popup.css` | Shared popup, existing actions, focus controls |
| `background.js` | Chrome events, alarms, focus state and session history |
| `blocked.html`, `blocked.js` | Focus blocking page with packaged scripts |
| `manifest.json` | Extension metadata, permissions and entry points |

Inspect the popup using its context menu, or inspect the service worker from `chrome://extensions`, to troubleshoot errors.
