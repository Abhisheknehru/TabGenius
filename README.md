**TabGenius Chrome Extension**

TabGenius is a lightweight Chrome extension designed to enhance productivity by helping users manage browser tabs and focus on tasks. It features an Organize View to view and manage open tabs and a Focus Mode with a countdown timer to maintain concentration. The extension is built with HTML, CSS, and JavaScript, using Chrome APIs for tab and storage management.
Features

**This automatically pins frequently used tabs ,clears tabs and group automatically.**

Organize View: Displays a list of open browser tabs with options to close or navigate to them.
Focus Mode: Allows users to set a focus duration (in minutes) and start a countdown timer to stay on task.
Compact UI: Designed for a 400px-wide popup with minimal scrolling, optimized for Chrome's extension popup.
Notifications: Provides feedback for actions like starting or ending focus sessions.
Persistent Focus Sessions: Uses chrome.storage.local to save focus session data across popup reloads.

**Installation
Prerequisites**

Google Chrome browser
Basic understanding of Chrome extensions (for development or debugging)

Setup Instructions

Clone the Repository:
git clone https://github.com/Abhisheknehru/tabgenius.git
cd tabgenius

**Load the Extension:**

Open Chrome and navigate to chrome://extensions/.
Enable Developer mode (toggle in the top-right corner).
Click Load unpacked and select the tabgenius directory.
Verify no load errors appear in the Extensions page.


Create Icons (if missing):

The icons/ folder must contain icon16.png, icon32.png, icon48.png, and icon128.png.
Use placeholder images (e.g., solid color PNGs of 16x16, 32x32, 48x48, 128x128 pixels) if needed.



Usage

Open the Popup:

Click the TabGenius extension icon in Chrome’s toolbar to open the popup.


Navigate Views:

Use the navigation buttons (Organize and Focus) at the top to switch views.
Organize View: Displays open tabs with checkboxes, “Close,” and “Go” buttons.
Focus Mode: Allows setting a focus duration and starting a countdown timer.


**Focus Mode:**

Enter a duration (1–480 minutes) in the input field.
Click Start to begin the countdown timer (e.g., “25m 00s”).
Use +5 min to extend or End to stop the session.
Timer persists across popup reloads using chrome.storage.local.


**Organize View:**

Lists all open tabs with titles and hostnames (e.g., “Example (example.com)”).
Click Close to close a tab or Go to navigate to it.
Auto-Group button (placeholder for future tab grouping functionality).



Debugging
If you encounter issues (e.g., views not switching, timer not starting, tabs not displaying), follow these steps:

Check Popup Console:

Open the popup, right-click, select Inspect, and go to the Console tab.
Look for logs:
Popup DOM loaded
Nav button clicked: [organize|focus]
switchView called with: [organize|focus]
Start button clicked, startFocus called, updateTimer called
loadTabs called, getTabs response


Note errors like View or button not found or Runtime error in sendMessage.


**Check Background Console:**

Go to chrome://extensions/, click Inspect views: service worker under TabGenius.
Look for:
Background received message: { action: 'getTabs' }
Fetching tabs...
Sending tabs: ...


Check for Error querying tabs.


**Test View Switching:**

Click “Organize” and “Focus” buttons.
Verify the correct view appears (#organize-view or #focus-view shows).
Check Console for Nav button clicked, switchView called.


Test Timer:

In Focus Mode, set duration to 1 minute, click Start.
Verify #focus-timer shows “1m 00s” counting down.
Check #focus-status for “Focus mode active” or errors.
Test Extend and End buttons.


Test Tabs:

Open tabs (e.g., http://example.com).
In Organize View, check #tab-list for tabs, “No tabs found,” or “Loading tabs...”.
Test Close and Go buttons.


Clear Storage:

Run in Console (popup or background):chrome.storage.local.clear(() => console.log('Storage cleared'));


Reload the extension.


Verify URLs:

Use http:// or https:// URLs, as chrome:// or file:// may be restricted.



Development
**Technologies**

HTML/CSS/JavaScript: Core extension structure and logic.
Chrome APIs: chrome.tabs, chrome.storage.local, chrome.notifications.
Manifest V3: Modern Chrome extension framework.

**File Overview**

popup.html: Defines the popup UI with Organize and Focus views.
popup.js: Handles view switching, timer logic, and tab management.
background.js: Manages tab queries and notifications.
popup.css: Styles the popup (400px width, minimal scrolling).
manifest.json: Declares permissions and extension metadata.

**Contributing**

Fork the repository.
Create a feature branch (git checkout -b feature-name).
Make changes and test locally.
Commit changes (git commit -m "Add feature").
Push to your fork (git push origin feature-name).
Open a pull request.

Known Issues

View Switching: If buttons don’t respond, check Console for View or button not found.
Timer: If #focus-timer stays empty, verify startFocus called in Console.
Tabs: If #tab-list shows “Loading tabs...” or nothing, check background Console for Error querying tabs.
