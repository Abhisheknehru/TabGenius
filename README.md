![Header](https://capsule-render.vercel.app/api?type=waving&color=0:6C63FF,100:00F7FF&height=180&section=header&text=TabGenius&fontSize=50&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Smart%20Tab%20Manager%20for%20Chrome&descAlignY=55)

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=18&pause=1000&color=6C63FF&width=500&lines=Organize+your+tabs+intelligently;Focus+Mode+with+countdown+timer;Auto-group+and+pin+frequent+tabs;Built+with+Chrome+Manifest+V3" alt="Typing SVG" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" />
  <img src="https://img.shields.io/badge/Manifest-V3-FF6B6B?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge" />
</p>

---

## 📌 What is TabGenius?

TabGenius is a lightweight Chrome extension that helps you manage browser tabs and stay focused. It automatically pins frequently used tabs, groups tabs intelligently, and provides a distraction-free Focus Mode with a countdown timer.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗂️ Organize View | View, close, or navigate to any open tab |
| ⏱️ Focus Mode | Set a countdown timer to stay on task |
| 📌 Auto-Pin | Automatically pins frequently used tabs |
| 🧹 Auto-Clear | Clears unused tabs automatically |
| 🗃️ Auto-Group | Groups tabs by domain |
| 💾 Persistent Sessions | Focus sessions saved across popup reloads |
| 🔔 Notifications | Feedback for focus start/end actions |

---

## 🚀 Installation

### Prerequisites
- Google Chrome browser

### Steps

**1. Clone the repository**
```bashtabgenius/
├── manifest.json      # Extension metadata & permissions
├── popup.html         # Popup UI (Organize + Focus views)
├── popup.js           # View switching, timer, tab logic
├── popup.css          # Styles (400px width, compact UI)
├── background.js      # Tab queries & notifications
└── icons/             # Extension icons (16, 32, 48, 128px)'''

---


---
## 🐛 Debugging

### View Switching
Open popup → right-click → **Inspect** → Console. Look for:
Nav button clicked: [organize|focus]
switchView called with: [organize|focus]

### Timer Not Starting
Check Console for:
Start button clicked, startFocus called, updateTimer called

### Tabs Not Loading
Go to `chrome://extensions/` → **Inspect views: service worker**. Look for:
Background received message: { action: 'getTabs' }
Sending tabs: ...


### Clear Storage
Run in Console:
```javascript
chrome.storage.local.clear(() => console.log('Storage cleared'));
```

---

## 🤝 Contributing
```bash
# Fork the repo, then:
git checkout -b feature-name
git commit -m "Add feature"
git push origin feature-name
# Open a Pull Request
```

---

## ⚠️ Known Issues

- **View Switching** — If buttons don't respond, check Console for `View or button not found`
- **Timer** — If `#focus-timer` stays empty, verify `startFocus called` in Console
- **Tabs** — If list shows "Loading tabs...", check background Console for `Error querying tabs`

---

## 👤 Author

**Abhishek Nehru**

[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Abhisheknehru)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/abhisheknehru)

---

![Footer](https://capsule-render.vercel.app/api?type=waving&color=0:00F7FF,100:6C63FF&height=100&section=footer)
