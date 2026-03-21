// Smart Tab Manager - Complete Popup JavaScript with Chrome API Integration
document.addEventListener('DOMContentLoaded', async function() {
  initializeNavigation();
  initializeDashboard();
  
  // Initialize focus mode and store instance for message listener
  const focusModeInstance = initializeFocusMode();
  
  initializeActions();
  initializeAI();
  
  // Initialize settings first, then load saved values
  initializeSettings();
  
  // Load user settings after a short delay to ensure DOM is ready
  await new Promise(resolve => setTimeout(resolve, 100));
  await loadUserSettings();

  //new auto group features
  initializeAutoPinning();
  initializeAutoGrouping();
  trackTabUsage();
  updateSettingsForNewFeatures();

  // Listen for focus mode state changes from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'focusModeStateChanged') {
      // Reload focus mode state when background notifies of change
      if (focusModeInstance && typeof focusModeInstance.loadState === 'function') {
        focusModeInstance.loadState();
      }
    }
  });
});

// Storage helper functions
const storage = {
  get: (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve)),
  set: (items) => new Promise(resolve => chrome.storage.local.set(items, resolve)),
  remove: (keys) => new Promise(resolve => chrome.storage.local.remove(keys, resolve))
};

// Navigation functionality
function initializeNavigation() {
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  navTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      // Don't handle settings tab here - it's now a sidebar
      if (targetTab === 'settings') return;
      
      navTabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      this.classList.add('active');
      const targetPane = document.getElementById(targetTab);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });

  // Initialize sidebar toggle
  initializeSidebar();
}

// Sidebar functionality
function initializeSidebar() {
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsClose = document.getElementById('settingsClose');
  const settingsSidebar = document.getElementById('settingsSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function openSidebar() {
    settingsSidebar.classList.add('active');
    sidebarOverlay.classList.add('active');
    document.body.classList.add('sidebar-open');
    // Save sidebar state
    storage.set({ sidebarOpen: true });
  }

  function closeSidebar() {
    settingsSidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
    // Save sidebar state
    storage.set({ sidebarOpen: false });
  }

  if (settingsToggle) {
    settingsToggle.addEventListener('click', openSidebar);
  }

  if (settingsClose) {
    settingsClose.addEventListener('click', closeSidebar);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }

  // Load sidebar state
  storage.get(['sidebarOpen']).then(data => {
    if (data.sidebarOpen) {
      openSidebar();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsSidebar.classList.contains('active')) {
      closeSidebar();
    }
  });
}

// Dashboard functionality with real Chrome API integration
function initializeDashboard() {
  updateDashboardStats();
  loadRecentActivity();
  updateStatusIndicator();
}

async function updateDashboardStats() {
  try {
    // Get all tabs in current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Calculate real stats
    const stats = {
      totalTabs: tabs.length,
      pinnedTabs: tabs.filter(tab => tab.pinned).length,
      groupedTabs: tabs.filter(tab => tab.groupId !== -1).length
    };

    // Update UI with real data
    document.getElementById('totalTabs').textContent = stats.totalTabs;
    document.getElementById('pinnedTabs').textContent = stats.pinnedTabs;
    document.getElementById('groupedTabs').textContent = stats.groupedTabs;

    // Get browsing history for most visited sites
    try {
      const visits = await chrome.history.search({ text: '', maxResults: 100 });
      const domainCounts = {};
      
      visits.forEach(visit => {
        try {
          const domain = new URL(visit.url).hostname;
          domainCounts[domain] = (domainCounts[domain] || 0) + visit.visitCount;
        } catch (e) {
          // Skip invalid URLs
        }
      });

      const sortedDomains = Object.entries(domainCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 1);

      if (sortedDomains.length > 0) {
        const [domain, count] = sortedDomains[0];
        const mostVisited = document.getElementById('mostVisitedItem');
        mostVisited.querySelector('.visited-title').textContent = domain;
        mostVisited.querySelector('.visited-domain').textContent = domain;
        mostVisited.querySelector('.visited-count').textContent = count;
      }
    } catch (error) {
      console.log('History permission not granted');
    }
  } catch (error) {
    console.error('Failed to update dashboard:', error);
  }
}

async function loadRecentActivity() {
  try {
    const activities = await storage.get(['recentActivities']);
    const recentActivities = activities.recentActivities || [];
    
    const activityList = document.getElementById('recentActivityList');
    if (activityList && recentActivities.length > 0) {
      activityList.innerHTML = '';
      recentActivities.slice(0, 5).forEach(activity => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
          <div class="activity-icon">${activity.icon}</div>
          <div class="activity-text">${activity.text}</div>
          <div class="activity-time">${activity.time}</div>
        `;
        activityList.appendChild(item);
      });
    }
  } catch (error) {
    console.error('Failed to load recent activity:', error);
  }
}

async function addActivity(icon, text) {
  try {
    const activities = await storage.get(['recentActivities']);
    const recentActivities = activities.recentActivities || [];
    
    const newActivity = {
      icon,
      text,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now()
    };
    
    recentActivities.unshift(newActivity);
    
    // Keep only last 20 activities
    if (recentActivities.length > 20) {
      recentActivities.splice(20);
    }
    
    await storage.set({ recentActivities });
    loadRecentActivity();
  } catch (error) {
    console.error('Failed to add activity:', error);
  }
}



// Focus Mode functionality with site blocking
// Focus Mode functionality with site blocking - FIXED VERSION
function initializeFocusMode() {
  const focusBtn = document.getElementById('focusBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const focusTimeSlider = document.getElementById('focusTime');
  const focusTimeValue = document.getElementById('focusTimeValue');
  const timerDisplay = document.getElementById('timerDisplay');
  const blockedSitesList = document.getElementById('blockedSitesList');
  const addSiteBtn = document.getElementById('addSiteBtn');
  const newSiteInput = document.getElementById('newSiteInput');

  let focusTimer = null;
  let timeLeft = 25 * 60; // 25 minutes in seconds
  let isPaused = false;
  let originalTime = 25 * 60;
  let isActive = false;

  // Load blocked sites on initialization
  loadBlockedSites();

  // Initialize timer display
  updateTimerDisplay();

  // Load focus mode state from storage on initialization
  loadFocusModeState();

  // Update slider value display
  if (focusTimeSlider) {
    focusTimeSlider.addEventListener('input', function() {
      const minutes = parseInt(this.value);
      focusTimeValue.textContent = minutes;
      timeLeft = minutes * 60;
      originalTime = minutes * 60;
      updateTimerDisplay();
    });
  }

  // Start focus session - FIXED
  if (focusBtn) {
    focusBtn.addEventListener('click', async function() {
      if (!isActive) {
        await startFocusSession();
      }
    });
  }

  // Pause/Resume focus session - FIXED
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function() {
      if (isActive) {
        if (isPaused) {
          resumeFocusSession();
        } else {
          pauseFocusSession();
        }
      }
    });
  }

  // Stop focus session - FIXED
  if (stopBtn) {
    stopBtn.addEventListener('click', function() {
      if (isActive) {
        endFocusSession(false);
      }
    });
  }

  // Add blocked site
  if (addSiteBtn && newSiteInput) {
    addSiteBtn.addEventListener('click', function() {
      const site = newSiteInput.value.trim();
      if (site) {
        addBlockedSite(site);
        newSiteInput.value = '';
      }
    });

    // Enter key for adding sites
    newSiteInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        addSiteBtn.click();
      }
    });
  }

  async function startFocusSession() {
    try {
      console.log('Starting focus session...');

      // Update UI state
      isActive = true;
      isPaused = false;
      focusBtn.textContent = 'Focus Active';
      focusBtn.disabled = true;
      pauseBtn.style.display = 'inline-block';
      stopBtn.style.display = 'inline-block';
      pauseBtn.innerHTML = '<span class="pause-icon">⏸️</span> Pause';

      // Get current time from slider
      const minutes = parseInt(focusTimeSlider?.value || 25);
      timeLeft = minutes * 60;
      originalTime = minutes * 60;

      // Delegate ALL focus logic to background (site blocking + alarms + state)
      try {
        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'startFocusMode',
            duration: originalTime
          }, (response) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(response);
          });
        });
      } catch (error) {
        console.log('Background script communication failed:', error);
      }

      // Start local UI timer (display only - background owns the real timer)
      startTimer();

      await addActivity('🎯', 'Focus session started');
      console.log('Focus session started successfully');
    } catch (error) {
      console.error('Failed to start focus session:', error);
      resetFocusUI();
    }
  }

  function startTimer() {
    if (focusTimer) {
      clearInterval(focusTimer);
    }
    
    focusTimer = setInterval(async () => {
      if (!isPaused) {
        // Sync with background state every 5 seconds
        if (Math.floor(timeLeft) % 5 === 0) {
          try {
            const response = await new Promise((resolve, reject) => {
              chrome.runtime.sendMessage({ action: 'getFocusModeState' }, (response) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve(response);
                }
              });
            });
            
            if (response && response.active && !response.paused) {
              // Calculate remaining time from background state
              const currentTime = Date.now();
              const elapsed = currentTime - response.startTime - response.totalPausedTime;
              const remaining = Math.max(0, Math.floor((response.duration - elapsed) / 1000));
              timeLeft = remaining;
            }
          } catch (error) {
            // If sync fails, just decrement local timer
            timeLeft--;
          }
        } else {
          timeLeft--;
        }
        
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
          endFocusSession(true);
        }
      }
    }, 1000);
  }

  function pauseFocusSession() {
    console.log('Pausing focus session...');
    isPaused = true;
    pauseBtn.innerHTML = '<span class="pause-icon">▶️</span> Resume';
    
    try {
      chrome.runtime.sendMessage({
        action: 'pauseFocusMode'
      });
    } catch (error) {
      console.log('Background script communication failed:', error);
    }
  }

  function resumeFocusSession() {
    console.log('Resuming focus session...');
    isPaused = false;
    pauseBtn.innerHTML = '<span class="pause-icon">⏸️</span> Pause';
    
    try {
      chrome.runtime.sendMessage({
        action: 'resumeFocusMode'
      });
    } catch (error) {
      console.log('Background script communication failed:', error);
    }
  }

  async function endFocusSession(completed = false) {
    try {
      console.log('Ending focus session...');

      // Clear local UI timer
      if (focusTimer) {
        clearInterval(focusTimer);
        focusTimer = null;
      }

      // Reset UI
      resetFocusUI();

      // Delegate end to background (handles site unblocking + alarm cleanup + stats)
      try {
        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'endFocusMode' }, (response) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(response);
          });
        });
      } catch (error) {
        console.log('Background script communication failed:', error);
      }

      if (completed) {
        showCelebrationEffect();
        playRewardSound();
        await addActivity('🎉', 'Focus session completed successfully!');
      } else {
        await addActivity('⏹️', 'Focus session stopped');
      }
    } catch (error) {
      console.error('Failed to end focus session:', error);
    }
  }

  function resetFocusUI() {
    isActive = false;
    isPaused = false;
    focusBtn.textContent = 'Start Focus Session';
    focusBtn.disabled = false;
    pauseBtn.style.display = 'none';
    stopBtn.style.display = 'none';
    timeLeft = originalTime;
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    if (timerDisplay) {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  // Load focus mode state from storage and sync with background
  async function loadFocusModeState() {
    try {
      // First, try to get state from background script
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getFocusModeState' }, (response) => {
          if (chrome.runtime.lastError) {
            // If background script is not ready, try storage
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });

      if (response && response.active) {
        // Focus mode is active in background
        const state = response;
        isActive = true;
        isPaused = state.paused || false;
        
        // Calculate remaining time using the updated state
        const currentTime = Date.now();
        let elapsed;
        
        if (state.paused) {
          // When paused, elapsed time is frozen at pausedAt
          elapsed = state.pausedAt - state.startTime - state.totalPausedTime;
        } else {
          // When running, calculate current elapsed time
          elapsed = currentTime - state.startTime - state.totalPausedTime;
        }
        
        timeLeft = Math.max(0, Math.floor((state.duration - elapsed) / 1000));
        originalTime = Math.floor(state.duration / 1000);
        
        // Update UI to reflect active state
        focusBtn.textContent = 'Focus Active';
        focusBtn.disabled = true;
        pauseBtn.style.display = 'inline-block';
        stopBtn.style.display = 'inline-block';
        
        if (isPaused) {
          pauseBtn.innerHTML = '<span class="pause-icon">▶️</span> Resume';
        } else {
          pauseBtn.innerHTML = '<span class="pause-icon">⏸️</span> Pause';
          // Start the timer if not paused
          startTimer();
        }
        
        updateTimerDisplay();
        console.log('Focus mode state loaded from background:', { isActive, isPaused, timeLeft, originalTime });
      } else {
        // No active focus mode - reset UI
        resetFocusUI();
      }
    } catch (error) {
      console.error('Failed to load focus mode state:', error);
      // On error, reset UI to be safe
      resetFocusUI();
    }
  }

  async function loadBlockedSites() {
    try {
      const data = await storage.get(['blockedSites']);
      const blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
      
      displayBlockedSites(blockedSites);
    } catch (error) {
      console.error('Failed to load blocked sites:', error);
    }
  }

  function displayBlockedSites(sites) {
    if (!blockedSitesList) return;
    
    blockedSitesList.innerHTML = '';
    sites.forEach(site => {
      const siteItem = document.createElement('div');
      siteItem.className = 'blocked-site-item';
      siteItem.innerHTML = `
        <span class="site-name">${site}</span>
        <button class="remove-site-btn" data-site="${site}">✕</button>
      `;
      blockedSitesList.appendChild(siteItem);
    });

    // Add remove listeners
    document.querySelectorAll('.remove-site-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const site = this.getAttribute('data-site');
        removeBlockedSite(site);
      });
    });
  }

  async function addBlockedSite(site) {
    try {
      // Clean up the site input
      site = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      
      const data = await storage.get(['blockedSites']);
      const blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
      
      if (!blockedSites.includes(site)) {
        blockedSites.push(site);
        await storage.set({ blockedSites });
        displayBlockedSites(blockedSites);
      }
    } catch (error) {
      console.error('Failed to add blocked site:', error);
    }
  }

  async function removeBlockedSite(site) {
    try {
      const data = await storage.get(['blockedSites']);
      const blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
      
      const index = blockedSites.indexOf(site);
      if (index > -1) {
        blockedSites.splice(index, 1);
        await storage.set({ blockedSites });
        displayBlockedSites(blockedSites);
      }
    } catch (error) {
      console.error('Failed to remove blocked site:', error);
    }
  }

  // Site blocking is now fully handled by the background service worker.
  // No duplicate logic here - popup only sends messages to background.

  function showCelebrationEffect() {
    // Create party popper effect
    const celebrationDiv = document.createElement('div');
    celebrationDiv.id = 'celebration';
    celebrationDiv.innerHTML = `
      <div class="confetti-container">
        ${Array.from({ length: 50 }, (_, i) => 
          `<div class="confetti" style="
            left: ${Math.random() * 100}%; 
            animation-delay: ${Math.random() * 3}s;
            background-color: ${['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7'][Math.floor(Math.random() * 7)]};
          "></div>`
        ).join('')}
      </div>
      <div class="celebration-message">
        <h2>🎉 Congratulations! 🎉</h2>
        <p>You've successfully completed your focus session!</p>
        <p>Great job staying focused and productive!</p>
      </div>
    `;
    
    document.body.appendChild(celebrationDiv);
    
    // Remove celebration after 5 seconds
    setTimeout(() => {
      if (document.getElementById('celebration')) {
        celebrationDiv.remove();
      }
    }, 5000);
  }

  function playRewardSound() {
    try {
      // Create audio context for reward sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create a simple celebratory sound
      const duration = 0.5;
      const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.1);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + index * 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.1 + duration);
        
        oscillator.start(audioContext.currentTime + index * 0.1);
        oscillator.stop(audioContext.currentTime + index * 0.1 + duration);
      });
    } catch (error) {
      console.error('Failed to play reward sound:', error);
    }
  }

  // Expose functions for external use
  return {
    startFocusSession,
    endFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    loadState: loadFocusModeState,
    isActive: () => isActive,
    isPaused: () => isPaused,
    timeLeft: () => timeLeft
  };
}

// Enhanced blocked sites list with more entertainment apps
const DEFAULT_BLOCKED_SITES = [
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'reddit.com',
  'netflix.com',
  'tiktok.com',
  'twitch.tv',
  'discord.com',
  'whatsapp.com',
  'telegram.org',
  'snapchat.com',
  'pinterest.com',
  'linkedin.com',
  'spotify.com',
  'music.apple.com',
  'soundcloud.com',
  'hulu.com',
  'amazon.com/prime',
  'disneyplus.com',
  'hbo.com',
  'crunchyroll.com',
  'funimation.com',
  'gaming.youtube.com',
  'twitch.tv',
  'steam.com',
  'epicgames.com',
  'roblox.com',
  'minecraft.net',
  'fortnite.com',
  '9gag.com',
  'buzzfeed.com',
  'vice.com',
  'mashable.com',
  'theverge.com',
  'techcrunch.com',
  'engadget.com',
  'gizmodo.com',
  'kotaku.com',
  'polygon.com',
  'gamespot.com',
  'ign.com',
  'pcgamer.com',
  'rockpapershotgun.com'
];

// You'll also need to create a blocked.html file for the redirect
const blockedPageHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Site Blocked - Focus Mode</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: white;
        }
        .container {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            margin: 20px;
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        h1 {
            margin-bottom: 20px;
            font-size: 2rem;
        }
        p {
            margin-bottom: 15px;
            font-size: 1.1rem;
            opacity: 0.9;
        }
        .motivational {
            font-style: italic;
            color: #FFD700;
            font-weight: bold;
        }
        .back-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 20px;
        }
        .back-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🎯</div>
        <h1>Focus Mode Active</h1>
        <p>This site is blocked during your focus session.</p>
        <p class="motivational">Stay focused! You've got this! 💪</p>
        <p>Your productivity session is in progress.</p>
        <button class="back-btn" onclick="history.back()">← Go Back</button>
    </div>
</body>
</html>
`;

// Function to create the blocked page if it doesn't exist
function createBlockedPage() {
    // This would need to be handled in your manifest and file structure
    console.log('Blocked page HTML ready for blocked.html file');
}

// Actions functionality with real Chrome API integration
function initializeActions() {
  const actionButtons = {
    summarizeBtn: summarizeCurrentTab,
    groupTabsBtn: groupSimilarTabs,
    cleanupBtn: cleanupInactiveTabs,
    duplicateBtn: findDuplicateTabs,
    bookmarkBtn: bookmarkAllTabs,
    exportBtn: exportTabList,
    pinMostUsedBtn: pinMostUsedTabs,
    autoGroupBtn: performAutoGrouping
  };

  // Add click listeners to action buttons
  Object.keys(actionButtons).forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.addEventListener('click', actionButtons[buttonId]);
    }
  });

  // Bulk actions
  const executeBulkAction = document.getElementById('executeBulkAction');
  const bulkActionSelect = document.getElementById('bulkActionSelect');

  if (executeBulkAction && bulkActionSelect) {
    executeBulkAction.addEventListener('click', async function() {
      const action = bulkActionSelect.value;
      await executeBulkTabAction(action);
    });
  }
}

async function summarizeCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Get tab info
    const summary = {
      title: tab.title,
      url: tab.url,
      status: tab.status,
      pinned: tab.pinned,
      muted: tab.mutedInfo.muted
    };

    const summaryText = `Current tab: "${summary.title}" (${summary.status})${summary.pinned ? ' - Pinned' : ''}${summary.muted ? ' - Muted' : ''}`;
    
    showActionResult('📄', summaryText);
    await addActivity('📄', 'Summarized current tab');
  } catch (error) {
    console.error('Failed to summarize tab:', error);
    showActionResult('❌', 'Failed to summarize tab');
  }
}

// Domain-to-category mapping for color-coded grouping
const DOMAIN_CATEGORIES = {
  'Social Media': {
    color: 'red',
    domains: ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com',
              'snapchat.com', 'pinterest.com', 'threads.net', 'mastodon.social']
  },
  'Development': {
    color: 'blue',
    domains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'codepen.io',
              'developer.mozilla.org', 'npmjs.com', 'pypi.org', 'bitbucket.org',
              'vercel.com', 'netlify.com', 'heroku.com', 'replit.com']
  },
  'Entertainment': {
    color: 'purple',
    domains: ['youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com', 'hulu.com',
              'disneyplus.com', 'hbo.com', 'crunchyroll.com', 'soundcloud.com',
              'music.apple.com', 'primevideo.com', 'vimeo.com']
  },
  'News': {
    color: 'cyan',
    domains: ['news.google.com', 'cnn.com', 'bbc.com', 'reuters.com', 'nytimes.com',
              'theguardian.com', 'washingtonpost.com', 'apnews.com', 'aljazeera.com']
  },
  'Productivity': {
    color: 'green',
    domains: ['gmail.com', 'mail.google.com', 'docs.google.com', 'drive.google.com',
              'sheets.google.com', 'slides.google.com', 'trello.com', 'notion.so',
              'asana.com', 'slack.com', 'zoom.us', 'teams.microsoft.com',
              'calendar.google.com', 'outlook.com', 'figma.com', 'miro.com']
  },
  'Shopping': {
    color: 'orange',
    domains: ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'flipkart.com',
              'aliexpress.com', 'target.com', 'bestbuy.com']
  },
  'Gaming': {
    color: 'pink',
    domains: ['steam.com', 'steampowered.com', 'epicgames.com', 'roblox.com',
              'minecraft.net', 'ign.com', 'gamespot.com', 'twitch.tv',
              'xbox.com', 'playstation.com', 'pcgamer.com']
  },
  'Education': {
    color: 'yellow',
    domains: ['wikipedia.org', 'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org',
              'medium.com', 'dev.to', 'hashnode.com', 'freecodecamp.org',
              'w3schools.com', 'geeksforgeeks.org', 'leetcode.com']
  }
};

function getCategoryForDomain(hostname) {
  for (const [category, info] of Object.entries(DOMAIN_CATEGORIES)) {
    if (info.domains.some(d => hostname.includes(d) || hostname.endsWith(d))) {
      return { category, color: info.color };
    }
  }
  return { category: null, color: 'grey' };
}

async function groupSimilarTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const groups = {};

    tabs.forEach(tab => {
      try {
        const domain = new URL(tab.url).hostname;
        if (!groups[domain]) {
          groups[domain] = [];
        }
        groups[domain].push(tab);
      } catch (e) {
        // Skip invalid URLs
      }
    });

    let groupedCount = 0;
    for (const [domain, domainTabs] of Object.entries(groups)) {
      if (domainTabs.length > 1) {
        const tabIds = domainTabs.map(tab => tab.id);
        const group = await chrome.tabs.group({ tabIds });

        const { category, color } = getCategoryForDomain(domain);
        const title = category || domain.replace('www.', '');

        await chrome.tabGroups.update(group, { title, color });
        groupedCount += domainTabs.length;
      }
    }

    showActionResult('📁', `Grouped ${groupedCount} tabs by category`);
    await addActivity('📁', `Grouped ${groupedCount} tabs by category`);
  } catch (error) {
    console.error('Failed to group tabs:', error);
    showActionResult('❌', 'Failed to group tabs');
  }
}

async function cleanupInactiveTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const currentTime = Date.now();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    let closedCount = 0;
    
    for (const tab of tabs) {
      if (!tab.active && !tab.pinned && tab.lastAccessed && 
          (currentTime - tab.lastAccessed) > inactiveThreshold) {
        await chrome.tabs.remove(tab.id);
        closedCount++;
      }
    }

    showActionResult('🧹', `Closed ${closedCount} inactive tabs`);
    await addActivity('🧹', `Cleaned up ${closedCount} inactive tabs`);
  } catch (error) {
    console.error('Failed to cleanup tabs:', error);
    showActionResult('❌', 'Failed to cleanup tabs');
  }
}

async function findDuplicateTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const urlMap = {};
    const duplicates = [];

    tabs.forEach(tab => {
      if (urlMap[tab.url]) {
        duplicates.push(tab);
      } else {
        urlMap[tab.url] = tab;
      }
    });

    if (duplicates.length > 0) {
      // Close duplicate tabs (keep the first one)
      for (const duplicate of duplicates) {
        await chrome.tabs.remove(duplicate.id);
      }
      showActionResult('📋', `Removed ${duplicates.length} duplicate tabs`);
      await addActivity('📋', `Removed ${duplicates.length} duplicate tabs`);
    } else {
      showActionResult('📋', 'No duplicate tabs found');
    }
  } catch (error) {
    console.error('Failed to find duplicates:', error);
    showActionResult('❌', 'Failed to find duplicate tabs');
  }
}

async function bookmarkAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const folderName = `Tab Session ${new Date().toLocaleString()}`;
    
    // Create bookmark folder
    const folder = await chrome.bookmarks.create({
      title: folderName,
      parentId: '1' // Bookmarks bar
    });

    // Add bookmarks for all tabs
    for (const tab of tabs) {
      await chrome.bookmarks.create({
        title: tab.title,
        url: tab.url,
        parentId: folder.id
      });
    }

    showActionResult('🔖', `Bookmarked ${tabs.length} tabs to "${folderName}"`);
    await addActivity('🔖', `Bookmarked ${tabs.length} tabs`);
  } catch (error) {
    console.error('Failed to bookmark tabs:', error);
    showActionResult('❌', 'Failed to bookmark tabs');
  }
}

async function exportTabList() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const tabList = tabs.map(tab => ({
      title: tab.title,
      url: tab.url,
      pinned: tab.pinned,
      muted: tab.mutedInfo.muted
    }));

    const dataStr = JSON.stringify(tabList, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tab-list-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showActionResult('📤', `Exported ${tabs.length} tabs to JSON file`);
    await addActivity('📤', `Exported ${tabs.length} tabs`);
  } catch (error) {
    console.error('Failed to export tabs:', error);
    showActionResult('❌', 'Failed to export tabs');
  }
}

async function executeBulkTabAction(action) {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const selectedTabs = tabs.filter(tab => !tab.active && !tab.pinned); // Simple selection logic
    
    switch (action) {
      case 'close':
        for (const tab of selectedTabs) {
          await chrome.tabs.remove(tab.id);
        }
        showActionResult('⚡', `Closed ${selectedTabs.length} tabs`);
        break;
      case 'mute':
        for (const tab of selectedTabs) {
          await chrome.tabs.update(tab.id, { muted: true });
        }
        showActionResult('⚡', `Muted ${selectedTabs.length} tabs`);
        break;
      case 'bookmark':
        await bookmarkAllTabs();
        return;
      case 'group':
        await groupSimilarTabs();
        return;
    }
    
    await addActivity('⚡', `Executed bulk action: ${action}`);
  } catch (error) {
    console.error('Failed to execute bulk action:', error);
    showActionResult('❌', 'Failed to execute bulk action');
  }
}

// AI functionality with enhanced tab analysis
function initializeAI() {
  const aiBtn = document.getElementById('aiBtn');
  const aiInput = document.getElementById('aiInput');
  const aiResponse = document.getElementById('aiResponse');
  const presetButtons = document.querySelectorAll('.preset-btn');

  // Generate dynamic suggestions on load
  generateSmartSuggestions();

  // AI query handling
  aiBtn.addEventListener('click', function() {
    const query = aiInput.value.trim();
    if (query) {
      processAIQuery(query);
    }
  });

  // Enter key support
  aiInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      aiBtn.click();
    }
  });

  // Preset buttons
  presetButtons.forEach(button => {
    button.addEventListener('click', function() {
      const prompt = this.getAttribute('data-prompt');
      aiInput.value = prompt;
      processAIQuery(prompt);
    });
  });

  async function processAIQuery(query) {
    aiResponse.style.display = 'block';
    const responseText = aiResponse.querySelector('.ai-response-text');
    responseText.textContent = 'Analyzing your tabs...';

    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const analysis = await analyzeTabsWithAI(tabs, query);
      
      setTimeout(() => {
        responseText.textContent = analysis;
      }, 1000);
      
      await addActivity('🤖', 'AI analysis completed');
    } catch (error) {
      console.error('AI query failed:', error);
      responseText.textContent = 'Failed to analyze tabs. Please try again.';
    }
  }

  async function analyzeTabsWithAI(tabs, query) {
    const tabData = tabs.map(tab => ({
      title: tab.title,
      url: tab.url,
      pinned: tab.pinned,
      muted: tab.mutedInfo.muted,
      status: tab.status
    }));

    // Simple AI-like analysis based on query
    if (query.includes('summarize') || query.includes('summary')) {
      const domains = {};
      tabData.forEach(tab => {
        try {
          const domain = new URL(tab.url).hostname;
          domains[domain] = (domains[domain] || 0) + 1;
        } catch (e) {
          // Skip invalid URLs
        }
      });

      const domainList = Object.entries(domains)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([domain, count]) => `${domain} (${count} tabs)`)
        .join(', ');

      return `You have ${tabs.length} tabs open. Top domains: ${domainList}. ${tabs.filter(t => t.pinned).length} pinned, ${tabs.filter(t => t.muted).length} muted.`;
    }

    if (query.includes('duplicate')) {
      const urls = tabData.map(tab => tab.url);
      const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);
      
      if (duplicates.length > 0) {
        return `Found ${duplicates.length} duplicate tabs. Consider closing duplicates to improve performance.`;
      } else {
        return 'No duplicate tabs found. Your tab management is efficient!';
      }
    }

    if (query.includes('analyze') || query.includes('pattern')) {
      const domains = {};
      tabData.forEach(tab => {
        try {
          const domain = new URL(tab.url).hostname;
          domains[domain] = (domains[domain] || 0) + 1;
        } catch (e) {
          // Skip invalid URLs
        }
      });

      const totalTabs = tabs.length;
      const topDomains = Object.entries(domains)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const categories = categorizeTabsByDomain(domains);
      
      return `Browsing analysis: ${totalTabs} total tabs. Categories: ${categories}. Top domains: ${topDomains.map(([domain, count]) => `${domain} (${Math.round(count/totalTabs*100)}%)`).join(', ')}.`;
    }

    // Default response
    return `I analyzed your ${tabs.length} tabs. ${tabs.filter(t => t.pinned).length} are pinned, ${tabs.filter(t => t.muted).length} are muted. Consider grouping similar tabs or closing unused ones for better productivity.`;
  }

  function categorizeTabsByDomain(domains) {
    const categories = {
      'Social Media': ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com'],
      'Development': ['github.com', 'stackoverflow.com', 'codepen.io', 'developer.mozilla.org'],
      'Entertainment': ['youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com'],
      'News': ['news.google.com', 'cnn.com', 'bbc.com', 'reuters.com'],
      'Productivity': ['gmail.com', 'docs.google.com', 'trello.com', 'notion.so']
    };

    const categoryCount = {};
    
    Object.entries(domains).forEach(([domain, count]) => {
      let categorized = false;
      Object.entries(categories).forEach(([category, domainList]) => {
        if (domainList.some(catDomain => domain.includes(catDomain))) {
          categoryCount[category] = (categoryCount[category] || 0) + count;
          categorized = true;
        }
      });
      if (!categorized) {
        categoryCount['Other'] = (categoryCount['Other'] || 0) + count;
      }
    });

    return Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => `${category} (${count})`)
      .join(', ');
  }
}

// Generate dynamic smart suggestions based on actual tab state
async function generateSmartSuggestions() {
  const suggestionList = document.getElementById('suggestionList');
  if (!suggestionList) return;

  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const suggestions = [];

    // 1. Check for duplicate tabs
    const urlMap = {};
    const duplicates = [];
    tabs.forEach(tab => {
      if (urlMap[tab.url]) {
        duplicates.push(tab);
      } else {
        urlMap[tab.url] = tab;
      }
    });
    if (duplicates.length > 0) {
      suggestions.push({
        icon: '📋',
        text: `You have ${duplicates.length} duplicate tab${duplicates.length > 1 ? 's' : ''} — close them to declutter`,
        action: 'closeDuplicates',
        btnText: 'Close'
      });
    }

    // 2. Check for groupable domains (2+ tabs from same domain, not already grouped)
    const domainTabs = {};
    tabs.forEach(tab => {
      try {
        const domain = new URL(tab.url).hostname;
        if (!domain || tab.url.startsWith('chrome://')) return;
        if (!domainTabs[domain]) domainTabs[domain] = [];
        domainTabs[domain].push(tab);
      } catch (e) { /* skip */ }
    });

    const ungroupedDomains = Object.entries(domainTabs)
      .filter(([, tabs]) => tabs.length >= 2 && tabs.some(t => t.groupId === -1));

    if (ungroupedDomains.length > 0) {
      const topDomain = ungroupedDomains.sort((a, b) => b[1].length - a[1].length)[0];
      const domainName = topDomain[0].replace('www.', '');
      suggestions.push({
        icon: '📁',
        text: `${topDomain[1].length} tabs from "${domainName}" — group them together`,
        action: 'groupSimilar',
        btnText: 'Group'
      });

      if (ungroupedDomains.length > 1) {
        const totalGroupable = ungroupedDomains.reduce((sum, [, t]) => sum + t.length, 0);
        suggestions.push({
          icon: '📂',
          text: `${totalGroupable} tabs across ${ungroupedDomains.length} domains can be grouped`,
          action: 'groupAll',
          btnText: 'Group All'
        });
      }
    }

    // 3. Check for idle tabs (not accessed in 30+ minutes)
    const now = Date.now();
    const idleThreshold = 30 * 60 * 1000;
    const idleTabs = tabs.filter(t =>
      !t.active && !t.pinned && t.lastAccessed && (now - t.lastAccessed) > idleThreshold
    );
    if (idleTabs.length > 0) {
      const hours = Math.round((now - Math.min(...idleTabs.map(t => t.lastAccessed))) / (60 * 60 * 1000));
      suggestions.push({
        icon: '⏰',
        text: `${idleTabs.length} tab${idleTabs.length > 1 ? 's' : ''} idle for ${hours > 0 ? hours + 'h+' : '30m+'} — close to save memory`,
        action: 'cleanupIdle',
        btnText: 'Clean'
      });
    }

    // 4. Tab overload warning
    if (tabs.length > 20) {
      suggestions.push({
        icon: '⚠️',
        text: `You have ${tabs.length} tabs open — consider closing some for better performance`,
        action: 'none',
        btnText: null
      });
    }

    // 5. Check for muted audio tabs
    const audibleTabs = tabs.filter(t => t.audible && !t.mutedInfo.muted);
    if (audibleTabs.length > 1) {
      suggestions.push({
        icon: '🔇',
        text: `${audibleTabs.length} tabs are playing audio — mute the ones you don't need`,
        action: 'muteAll',
        btnText: 'Mute All'
      });
    }

    // 6. Unpinned frequently used tabs
    const frequentDomains = Object.entries(domainTabs)
      .filter(([, t]) => t.length >= 3 && t.every(tab => !tab.pinned))
      .map(([domain]) => domain.replace('www.', ''));
    if (frequentDomains.length > 0) {
      suggestions.push({
        icon: '📌',
        text: `Consider pinning "${frequentDomains[0]}" — you have ${domainTabs[Object.keys(domainTabs).find(d => d.includes(frequentDomains[0]))]?.length || 3}+ tabs from it`,
        action: 'none',
        btnText: null
      });
    }

    // 7. If nothing noteworthy
    if (suggestions.length === 0) {
      suggestions.push({
        icon: '✅',
        text: 'Your tabs look well-organized! No suggestions right now.',
        action: 'none',
        btnText: null
      });
    }

    // Render suggestions
    suggestionList.innerHTML = '';
    suggestions.slice(0, 5).forEach(suggestion => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `
        <span class="suggestion-icon">${suggestion.icon}</span>
        <span class="suggestion-text">${suggestion.text}</span>
        ${suggestion.btnText ? `<button class="suggestion-btn" data-action="${suggestion.action}">${suggestion.btnText}</button>` : ''}
      `;
      suggestionList.appendChild(item);
    });

    // Wire up suggestion action buttons
    suggestionList.querySelectorAll('.suggestion-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const action = this.getAttribute('data-action');
        await executeSuggestionAction(action);
        // Refresh suggestions after action
        setTimeout(() => generateSmartSuggestions(), 500);
      });
    });

  } catch (error) {
    console.error('Failed to generate suggestions:', error);
    suggestionList.innerHTML = `
      <div class="suggestion-item">
        <span class="suggestion-icon">❌</span>
        <span class="suggestion-text">Could not analyze tabs</span>
      </div>
    `;
  }
}

// Execute a suggestion action
async function executeSuggestionAction(action) {
  try {
    switch (action) {
      case 'closeDuplicates':
        await findDuplicateTabs();
        break;
      case 'groupSimilar':
      case 'groupAll':
        await groupSimilarTabs();
        break;
      case 'cleanupIdle':
        await cleanupInactiveTabs();
        break;
      case 'muteAll': {
        const tabs = await chrome.tabs.query({ currentWindow: true, audible: true });
        for (const tab of tabs) {
          if (!tab.mutedInfo.muted) {
            await chrome.tabs.update(tab.id, { muted: true });
          }
        }
        showActionResult('🔇', `Muted ${tabs.length} tabs`);
        await addActivity('🔇', `Muted ${tabs.length} audible tabs`);
        break;
      }
    }
  } catch (error) {
    console.error('Failed to execute suggestion action:', error);
    showActionResult('❌', 'Action failed');
  }
}

// Settings functionality with persistent storage
function initializeSettings() {
  const settings = {
    enableNotifications: document.getElementById('enableNotifications'),
    enableSoundNotifications: document.getElementById('enableSoundNotifications'),
    showTabCount: document.getElementById('showTabCount'),
    tabLimitWarning: document.getElementById('tabLimitWarning'),
    autoGroupTabs: document.getElementById('autoGroupTabs'),
    autoGroupEnabled: document.getElementById('autoGroupEnabled'),
    autoPinEnabled: document.getElementById('autoPinEnabled'),
    autoCleanup: document.getElementById('autoCleanup'),
    autoSuspendTabs: document.getElementById('autoSuspendTabs'),
    focusModeEnabled: document.getElementById('focusModeEnabled'),
    autoBlockDistractions: document.getElementById('autoBlockDistractions'),
    cleanupDuplicates: document.getElementById('cleanupDuplicates'),
    cleanupEmptyGroups: document.getElementById('cleanupEmptyGroups'),
    groupByDomain: document.getElementById('groupByDomain'),
    groupByTitle: document.getElementById('groupByTitle'),
    compactMode: document.getElementById('compactMode'),
    showAnimations: document.getElementById('showAnimations'),
    trackBrowsingHistory: document.getElementById('trackBrowsingHistory'),
    enableAnalytics: document.getElementById('enableAnalytics'),
    memoryOptimization: document.getElementById('memoryOptimization')
  };

  const cleanupTimeSlider = document.getElementById('cleanupTime');
  const cleanupTimeValue = document.getElementById('cleanupTimeValue');
  const defaultFocusDurationSlider = document.getElementById('defaultFocusDuration');
  const defaultFocusDurationValue = document.getElementById('defaultFocusDurationValue');
  const maxTabsLimitInput = document.getElementById('maxTabsLimit');
  const maxTabsPerGroupInput = document.getElementById('maxTabsPerGroup');
  const themeRadios = document.querySelectorAll('input[name="theme"]');

  // Settings change handlers
  Object.keys(settings).forEach(settingId => {
    const setting = settings[settingId];
    if (setting) {
      setting.addEventListener('change', function() {
        saveSettings();
        const settingName = settingId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        showActionResult('⚙️', `${settingName} ${this.checked ? 'enabled' : 'disabled'}`);
      });
    }
  });

  // Cleanup time slider
  if (cleanupTimeSlider && cleanupTimeValue) {
    cleanupTimeSlider.addEventListener('input', function() {
      cleanupTimeValue.textContent = this.value;
      saveSettings();
    });
  }

  // Default focus duration slider
  if (defaultFocusDurationSlider && defaultFocusDurationValue) {
    defaultFocusDurationSlider.addEventListener('input', function() {
      defaultFocusDurationValue.textContent = this.value;
      saveSettings();
    });
  }

  // Max tabs limit input
  if (maxTabsLimitInput) {
    maxTabsLimitInput.addEventListener('change', function() {
      saveSettings();
    });
  }

  // Max tabs per group input
  if (maxTabsPerGroupInput) {
    maxTabsPerGroupInput.addEventListener('change', function() {
      saveSettings();
    });
  }

  // Theme selection
  themeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      applyTheme(this.value);
      saveSettings();
    });
  });

  // Data management buttons
  const exportBtn = document.getElementById('exportSettings');
  const importBtn = document.getElementById('importSettings');
  const exportDataBtn = document.getElementById('exportData');
  const resetBtn = document.getElementById('resetSettings');
  const clearDataBtn = document.getElementById('clearData');

  if (exportBtn) {
    exportBtn.addEventListener('click', async function() {
      try {
        const settingsData = await getCurrentSettings();
        const blob = new Blob([JSON.stringify(settingsData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tabgenius-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showActionResult('📤', 'Settings exported successfully');
      } catch (error) {
        console.error('Failed to export settings:', error);
        showActionResult('❌', 'Failed to export settings');
      }
    });
  }

  if (importBtn) {
    importBtn.addEventListener('click', function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            try {
              const importedSettings = JSON.parse(e.target.result);
              applyImportedSettings(importedSettings);
              showActionResult('📥', 'Settings imported successfully');
            } catch (error) {
              console.error('Failed to import settings:', error);
              showActionResult('❌', 'Invalid settings file');
            }
          };
          reader.readAsText(file);
        }
      });
      input.click();
    });
  }

  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', async function() {
      try {
        const allData = await storage.get(null);
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tabgenius-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showActionResult('💾', 'All data exported successfully');
      } catch (error) {
        console.error('Failed to export data:', error);
        showActionResult('❌', 'Failed to export data');
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to reset all settings to default?')) {
        resetToDefaults();
        showActionResult('🔄', 'Settings reset to default');
      }
    });
  }

  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', function() {
      if (confirm('⚠️ WARNING: This will delete ALL your data including settings, history, and statistics. This action cannot be undone!\n\nAre you absolutely sure?')) {
        storage.clear().then(() => {
          resetToDefaults();
          showActionResult('🗑️', 'All data cleared');
          // Reload the page to reflect changes
          setTimeout(() => location.reload(), 1000);
        }).catch(error => {
          console.error('Failed to clear data:', error);
          showActionResult('❌', 'Failed to clear data');
        });
      }
    });
  }

  async function saveSettings() {
    try {
      const currentSettings = await getCurrentSettings();
      // Save to both local storage and sync storage for persistence
      await storage.set({ userSettings: currentSettings });
      await new Promise(resolve => {
        chrome.storage.sync.set({ userSettings: currentSettings }, resolve);
      });
      
      // Send settings to background script
      try {
        chrome.runtime.sendMessage({
          action: 'updateSettings',
          settings: currentSettings
        });
      } catch (e) {
        // Background script might not be ready, that's okay
        console.log('Background script not ready:', e);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  async function getCurrentSettings() {
    return {
      enableNotifications: settings.enableNotifications?.checked || false,
      enableSoundNotifications: settings.enableSoundNotifications?.checked || false,
      showTabCount: settings.showTabCount?.checked || true,
      tabLimitWarning: settings.tabLimitWarning?.checked || true,
      maxTabsLimit: parseInt(maxTabsLimitInput?.value || '50'),
      autoGroupTabs: settings.autoGroupTabs?.checked || false,
      autoGroupEnabled: settings.autoGroupEnabled?.checked || true,
      autoPinEnabled: settings.autoPinEnabled?.checked || true,
      autoCleanup: settings.autoCleanup?.checked || false,
      autoSuspendTabs: settings.autoSuspendTabs?.checked || false,
      cleanupTime: parseInt(cleanupTimeSlider?.value || '2'),
      cleanupDuplicates: settings.cleanupDuplicates?.checked || true,
      cleanupEmptyGroups: settings.cleanupEmptyGroups?.checked || true,
      focusModeEnabled: settings.focusModeEnabled?.checked || false,
      defaultFocusDuration: parseInt(defaultFocusDurationSlider?.value || '25'),
      autoBlockDistractions: settings.autoBlockDistractions?.checked || false,
      maxTabsPerGroup: parseInt(maxTabsPerGroupInput?.value || '10'),
      groupByDomain: settings.groupByDomain?.checked || true,
      groupByTitle: settings.groupByTitle?.checked || true,
      theme: document.querySelector('input[name="theme"]:checked')?.value || 'light',
      compactMode: settings.compactMode?.checked || false,
      showAnimations: settings.showAnimations?.checked || true,
      trackBrowsingHistory: settings.trackBrowsingHistory?.checked || true,
      enableAnalytics: settings.enableAnalytics?.checked || false,
      memoryOptimization: settings.memoryOptimization?.checked || true
    };
  }

  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    
    // Apply theme-specific styles
    const root = document.documentElement;
    if (theme === 'dark') {
      root.style.setProperty('--bg-color', '#1a1a1a');
      root.style.setProperty('--text-color', '#ffffff');
      root.style.setProperty('--card-bg', '#2d2d2d');
      root.style.setProperty('--border-color', '#404040');
    } else if (theme === 'auto') {
      // Auto theme - use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.style.setProperty('--bg-color', '#1a1a1a');
        root.style.setProperty('--text-color', '#ffffff');
        root.style.setProperty('--card-bg', '#2d2d2d');
        root.style.setProperty('--border-color', '#404040');
      } else {
        root.style.setProperty('--bg-color', '#ffffff');
        root.style.setProperty('--text-color', '#333333');
        root.style.setProperty('--card-bg', '#f8f9fa');
        root.style.setProperty('--border-color', '#e0e0e0');
      }
    } else {
      root.style.setProperty('--bg-color', '#ffffff');
      root.style.setProperty('--text-color', '#333333');
      root.style.setProperty('--card-bg', '#f8f9fa');
      root.style.setProperty('--border-color', '#e0e0e0');
    }
  }

  // Make applyTheme globally accessible
  window.applyTheme = applyTheme;

  async function applyImportedSettings(importedSettings) {
    try {
      // Apply all checkbox settings
      Object.keys(settings).forEach(settingId => {
        if (importedSettings[settingId] !== undefined && settings[settingId]) {
          settings[settingId].checked = importedSettings[settingId];
        }
      });

      // Apply slider settings
      if (importedSettings.cleanupTime !== undefined && cleanupTimeSlider && cleanupTimeValue) {
        cleanupTimeSlider.value = importedSettings.cleanupTime;
        cleanupTimeValue.textContent = importedSettings.cleanupTime;
      }
      if (importedSettings.defaultFocusDuration !== undefined && defaultFocusDurationSlider && defaultFocusDurationValue) {
        defaultFocusDurationSlider.value = importedSettings.defaultFocusDuration;
        defaultFocusDurationValue.textContent = importedSettings.defaultFocusDuration;
      }

      // Apply number inputs
      if (importedSettings.maxTabsLimit !== undefined && maxTabsLimitInput) {
        maxTabsLimitInput.value = importedSettings.maxTabsLimit;
      }
      if (importedSettings.maxTabsPerGroup !== undefined && maxTabsPerGroupInput) {
        maxTabsPerGroupInput.value = importedSettings.maxTabsPerGroup;
      }

      // Apply theme
      if (importedSettings.theme !== undefined) {
        const themeRadio = document.querySelector(`input[name="theme"][value="${importedSettings.theme}"]`);
        if (themeRadio) {
          themeRadio.checked = true;
          applyTheme(importedSettings.theme);
        }
      }

      await saveSettings();
    } catch (error) {
      console.error('Failed to apply imported settings:', error);
    }
  }

  function resetToDefaults() {
    // Reset all checkboxes
    if (settings.enableNotifications) settings.enableNotifications.checked = true;
    if (settings.enableSoundNotifications) settings.enableSoundNotifications.checked = false;
    if (settings.showTabCount) settings.showTabCount.checked = true;
    if (settings.tabLimitWarning) settings.tabLimitWarning.checked = true;
    if (settings.autoGroupTabs) settings.autoGroupTabs.checked = true;
    if (settings.autoGroupEnabled) settings.autoGroupEnabled.checked = true;
    if (settings.autoPinEnabled) settings.autoPinEnabled.checked = true;
    if (settings.autoCleanup) settings.autoCleanup.checked = false;
    if (settings.autoSuspendTabs) settings.autoSuspendTabs.checked = false;
    if (settings.focusModeEnabled) settings.focusModeEnabled.checked = false;
    if (settings.autoBlockDistractions) settings.autoBlockDistractions.checked = false;
    if (settings.cleanupDuplicates) settings.cleanupDuplicates.checked = true;
    if (settings.cleanupEmptyGroups) settings.cleanupEmptyGroups.checked = true;
    if (settings.groupByDomain) settings.groupByDomain.checked = true;
    if (settings.groupByTitle) settings.groupByTitle.checked = true;
    if (settings.compactMode) settings.compactMode.checked = false;
    if (settings.showAnimations) settings.showAnimations.checked = true;
    if (settings.trackBrowsingHistory) settings.trackBrowsingHistory.checked = true;
    if (settings.enableAnalytics) settings.enableAnalytics.checked = false;
    if (settings.memoryOptimization) settings.memoryOptimization.checked = true;

    // Reset sliders
    if (cleanupTimeSlider && cleanupTimeValue) {
      cleanupTimeSlider.value = 2;
      cleanupTimeValue.textContent = '2';
    }
    if (defaultFocusDurationSlider && defaultFocusDurationValue) {
      defaultFocusDurationSlider.value = 25;
      defaultFocusDurationValue.textContent = '25';
    }

    // Reset number inputs
    if (maxTabsLimitInput) maxTabsLimitInput.value = 50;
    if (maxTabsPerGroupInput) maxTabsPerGroupInput.value = 10;

    // Reset theme
    const lightTheme = document.querySelector('input[name="theme"][value="light"]');
    if (lightTheme) {
      lightTheme.checked = true;
      applyTheme('light');
    }

    saveSettings();
  }
}

// Load user settings on startup
async function loadUserSettings() {
  try {
    // Try to get from sync storage first, then local storage
    let data = await new Promise(resolve => {
      chrome.storage.sync.get(['userSettings'], resolve);
    });
    
    // If no sync data, try local storage
    if (!data.userSettings) {
      data = await storage.get(['userSettings']);
    }
    
    const userSettings = data.userSettings;
    
    if (userSettings) {
      // Apply all checkbox settings
      const checkboxSettings = [
        'enableNotifications', 'enableSoundNotifications', 'showTabCount', 'tabLimitWarning',
        'autoGroupTabs', 'autoGroupEnabled', 'autoPinEnabled', 'autoCleanup', 'autoSuspendTabs',
        'focusModeEnabled', 'autoBlockDistractions', 'cleanupDuplicates', 'cleanupEmptyGroups',
        'groupByDomain', 'groupByTitle', 'compactMode', 'showAnimations',
        'trackBrowsingHistory', 'enableAnalytics', 'memoryOptimization'
      ];

      checkboxSettings.forEach(settingId => {
        const element = document.getElementById(settingId);
        if (element && userSettings[settingId] !== undefined) {
          element.checked = userSettings[settingId];
        }
      });

      // Apply slider settings
      const cleanupTimeSlider = document.getElementById('cleanupTime');
      const cleanupTimeValue = document.getElementById('cleanupTimeValue');
      if (cleanupTimeSlider && userSettings.cleanupTime !== undefined) {
        cleanupTimeSlider.value = userSettings.cleanupTime;
        if (cleanupTimeValue) cleanupTimeValue.textContent = userSettings.cleanupTime;
      }

      const defaultFocusDurationSlider = document.getElementById('defaultFocusDuration');
      const defaultFocusDurationValue = document.getElementById('defaultFocusDurationValue');
      if (defaultFocusDurationSlider && userSettings.defaultFocusDuration !== undefined) {
        defaultFocusDurationSlider.value = userSettings.defaultFocusDuration;
        if (defaultFocusDurationValue) defaultFocusDurationValue.textContent = userSettings.defaultFocusDuration;
      }

      // Apply number inputs
      const maxTabsLimitInput = document.getElementById('maxTabsLimit');
      if (maxTabsLimitInput && userSettings.maxTabsLimit !== undefined) {
        maxTabsLimitInput.value = userSettings.maxTabsLimit;
      }

      const maxTabsPerGroupInput = document.getElementById('maxTabsPerGroup');
      if (maxTabsPerGroupInput && userSettings.maxTabsPerGroup !== undefined) {
        maxTabsPerGroupInput.value = userSettings.maxTabsPerGroup;
      }
      
      // Apply theme
      if (userSettings.theme) {
        const themeRadio = document.querySelector(`input[name="theme"][value="${userSettings.theme}"]`);
        if (themeRadio) {
          themeRadio.checked = true;
          // Apply theme using global function
          if (window.applyTheme) {
            window.applyTheme(userSettings.theme);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to load user settings:', error);
  }
}

// Utility functions
function showActionResult(icon, message) {
  const notification = document.createElement('div');
  notification.className = 'action-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    max-width: 300px;
    word-wrap: break-word;
  `;
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 18px;">${icon}</span>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  // Animate out and remove
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Status indicator functionality
function updateStatusIndicator() {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  
  if (!statusIndicator || !statusText) return;
  
  const statuses = ['Active', 'Monitoring', 'Optimizing', 'Ready'];
  let currentStatus = 0;
  
  // Initial status
  statusText.textContent = statuses[currentStatus];
  
  // Update status every 3 seconds
  setInterval(() => {
    currentStatus = (currentStatus + 1) % statuses.length;
    statusText.textContent = statuses[currentStatus];
    
    // Add visual feedback
    statusIndicator.style.animation = 'none';
    setTimeout(() => {
      statusIndicator.style.animation = 'pulse 2s infinite';
    }, 10);
  }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Ctrl/Cmd + Shift + F for focus mode
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
    e.preventDefault();
    const focusBtn = document.getElementById('focusBtn');
    if (focusBtn && !focusBtn.disabled) {
      focusBtn.click();
    }
  }
  
  // Escape to close any open modals or notifications
  if (e.key === 'Escape') {
    const celebration = document.getElementById('celebration');
    if (celebration) {
      celebration.remove();
    }
  }
});

//Autopinning functionality
// =============================================================================
// AUTO-PINNING AND AUTO-GROUPING FEATURES
// Add these functions to your popup.js file
// =============================================================================

// Auto-pinning functionality
// Note: periodic auto-pinning is handled by background.js via chrome.alarms.
// This only runs a one-time check when the popup opens.
async function initializeAutoPinning() {
  const settings = await storage.get(['userSettings']);
  const userSettings = settings.userSettings;

  if (userSettings?.autoPinEnabled) {
    await checkAndPinMostUsedTabs();
  }
}

async function checkAndPinMostUsedTabs() {
  try {
    console.log('Checking for most used tabs to auto-pin...');
    
    // Get usage statistics
    const usageStats = await getTabUsageStats();
    
    // Get current tabs
    const tabs = await chrome.tabs.query({});
    
    // Find tabs that should be pinned based on usage
    const tabsToPin = [];
    const maxAutoPins = 5; // Maximum number of tabs to auto-pin
    
    // Sort domains by usage frequency
    const sortedDomains = Object.entries(usageStats)
      .sort((a, b) => b[1].totalVisits - a[1].totalVisits)
      .slice(0, maxAutoPins);
    
    // Find tabs matching most used domains
    for (const [domain, stats] of sortedDomains) {
      if (stats.totalVisits >= 10) { // Minimum 10 visits to consider for auto-pinning
        const matchingTab = tabs.find(tab => {
          try {
            const tabDomain = new URL(tab.url).hostname;
            return tabDomain === domain && !tab.pinned;
          } catch (e) {
            return false;
          }
        });
        
        if (matchingTab) {
          tabsToPin.push({ tab: matchingTab, domain, visits: stats.totalVisits });
        }
      }
    }
    
    // Pin the selected tabs
    for (const { tab, domain, visits } of tabsToPin) {
      await chrome.tabs.update(tab.id, { pinned: true });
      await addActivity('📌', `Auto-pinned ${domain} (${visits} visits)`);
    }
    
    if (tabsToPin.length > 0) {
      console.log(`Auto-pinned ${tabsToPin.length} tabs based on usage`);
    }
    
  } catch (error) {
    console.error('Auto-pinning failed:', error);
  }
}

async function getTabUsageStats() {
  try {
    // Get stored usage statistics
    const data = await storage.get(['tabUsageStats']);
    let usageStats = data.tabUsageStats || {};
    
    // Get browsing history to supplement usage data
    try {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const visits = await chrome.history.search({
        text: '',
        startTime: oneWeekAgo,
        maxResults: 1000
      });
      
      // Count visits per domain
      visits.forEach(visit => {
        try {
          const domain = new URL(visit.url).hostname;
          if (!usageStats[domain]) {
            usageStats[domain] = {
              totalVisits: 0,
              lastVisit: 0,
              averageTime: 0
            };
          }
          usageStats[domain].totalVisits += visit.visitCount || 1;
          usageStats[domain].lastVisit = Math.max(usageStats[domain].lastVisit, visit.lastVisitTime || 0);
        } catch (e) {
          // Skip invalid URLs
        }
      });
      
      // Save updated stats
      await storage.set({ tabUsageStats: usageStats });
      
    } catch (error) {
      console.log('History permission not available for auto-pinning');
    }
    
    return usageStats;
    
  } catch (error) {
    console.error('Failed to get usage stats:', error);
    return {};
  }
}

// Track tab usage in real-time
// Note: tab event listeners belong in background.js (popup listeners die on close).
// This function is now a no-op; tracking is done by background.js.
function trackTabUsage() {
  // Handled by background.js setupTabMonitoring()
}

async function updateTabUsageStats(url) {
  try {
    const domain = new URL(url).hostname;
    const data = await storage.get(['tabUsageStats']);
    let usageStats = data.tabUsageStats || {};
    
    if (!usageStats[domain]) {
      usageStats[domain] = {
        totalVisits: 0,
        lastVisit: 0,
        averageTime: 0
      };
    }
    
    usageStats[domain].totalVisits += 1;
    usageStats[domain].lastVisit = Date.now();
    
    await storage.set({ tabUsageStats: usageStats });
    
  } catch (error) {
    console.error('Failed to update tab usage stats:', error);
  }
}

// Auto-grouping functionality
// Note: tab creation listener is in background.js (popup listeners die on close).
// This only runs a one-time grouping when the popup opens.
async function initializeAutoGrouping() {
  const settings = await storage.get(['userSettings']);
  const userSettings = settings.userSettings;

  if (userSettings?.autoGroupTabs) {
    await performAutoGrouping();
  }
}

async function checkAndGroupSimilarTabs(newTab) {
  try {
    if (!newTab.url) return;
    
    const newDomain = new URL(newTab.url).hostname;
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Find tabs with the same domain
    const similarTabs = tabs.filter(tab => {
      try {
        const tabDomain = new URL(tab.url).hostname;
        return tabDomain === newDomain && tab.id !== newTab.id;
      } catch (e) {
        return false;
      }
    });
    
    if (similarTabs.length > 0) {
      // Check if any similar tab is already in a group
      const existingGroup = similarTabs.find(tab => tab.groupId !== -1);
      
      if (existingGroup) {
        // Add new tab to existing group
        await chrome.tabs.group({
          tabIds: [newTab.id],
          groupId: existingGroup.groupId
        });
        await addActivity('📁', `Auto-grouped ${newDomain} tab`);
      } else if (similarTabs.length >= 1) {
        // Create new group with similar tabs
        const tabIds = [...similarTabs.map(tab => tab.id), newTab.id];
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, { 
          title: getDomainDisplayName(newDomain),
          color: getGroupColor(newDomain)
        });
        await addActivity('📁', `Auto-grouped ${similarTabs.length + 1} ${newDomain} tabs`);
      }
    }
    
  } catch (error) {
    console.error('Auto-grouping failed:', error);
  }
}

async function performAutoGrouping() {
  try {
    console.log('Performing auto-grouping...');
    
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const domainGroups = {};
    
    // Group tabs by domain
    tabs.forEach(tab => {
      if (tab.groupId === -1) { // Only ungrouped tabs
        try {
          const domain = new URL(tab.url).hostname;
          if (!domainGroups[domain]) {
            domainGroups[domain] = [];
          }
          domainGroups[domain].push(tab);
        } catch (e) {
          // Skip invalid URLs
        }
      }
    });
    
    // Create groups for domains with multiple tabs
    let groupedCount = 0;
    for (const [domain, domainTabs] of Object.entries(domainGroups)) {
      if (domainTabs.length > 1) {
        const tabIds = domainTabs.map(tab => tab.id);
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, { 
          title: getDomainDisplayName(domain),
          color: getGroupColor(domain)
        });
        groupedCount += domainTabs.length;
      }
    }
    
    if (groupedCount > 0) {
      await addActivity('📁', `Auto-grouped ${groupedCount} tabs`);
      console.log(`Auto-grouped ${groupedCount} tabs`);
    }
    
  } catch (error) {
    console.error('Auto-grouping failed:', error);
  }
}

// Helper functions - use unified DOMAIN_CATEGORIES for consistent colors
function getDomainDisplayName(domain) {
  const { category } = getCategoryForDomain(domain);
  if (category) return category;
  const cleanDomain = domain.replace(/^www\./, '');
  return cleanDomain.length > 15 ? cleanDomain.substring(0, 15) + '...' : cleanDomain;
}

function getGroupColor(domain) {
  return getCategoryForDomain(domain).color;
}

// Manual controls for auto-pinning
async function pinMostUsedTabs() {
  try {
    const usageStats = await getTabUsageStats();
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Get top 3 most used domains
    const topDomains = Object.entries(usageStats)
      .sort((a, b) => b[1].totalVisits - a[1].totalVisits)
      .slice(0, 3);
    
    let pinnedCount = 0;
    
    for (const [domain, stats] of topDomains) {
      const matchingTab = tabs.find(tab => {
        try {
          const tabDomain = new URL(tab.url).hostname;
          return tabDomain === domain && !tab.pinned;
        } catch (e) {
          return false;
        }
      });
      
      if (matchingTab) {
        await chrome.tabs.update(matchingTab.id, { pinned: true });
        pinnedCount++;
      }
    }
    
    showActionResult('📌', `Pinned ${pinnedCount} most used tabs`);
    await addActivity('📌', `Manually pinned ${pinnedCount} most used tabs`);
    
  } catch (error) {
    console.error('Failed to pin most used tabs:', error);
    showActionResult('❌', 'Failed to pin most used tabs');
  }
}

// Settings update for new features
async function updateSettingsForNewFeatures() {
  const settings = await storage.get(['userSettings']);
  const userSettings = settings.userSettings || {};
  
  // Add default values for new features if they don't exist
  if (userSettings.autoPinEnabled === undefined) {
    userSettings.autoPinEnabled = true;
  }
  if (userSettings.autoGroupTabs === undefined) {
    userSettings.autoGroupTabs = true;
  }
  
  await storage.set({ userSettings });
}

// Export functions for use in other parts of the code
window.autoPinning = {
  initializeAutoPinning,
  checkAndPinMostUsedTabs,
  pinMostUsedTabs,
  trackTabUsage
};

window.autoGrouping = {
  initializeAutoGrouping,
  performAutoGrouping,
  checkAndGroupSimilarTabs
};

// Auto-cleanup functionality
async function initializeAutoCleanup() {
  const settings = await storage.get(['userSettings']);
  const userSettings = settings.userSettings;
  
  if (userSettings?.autoCleanup) {
    const cleanupInterval = (userSettings.cleanupTime || 2) * 60 * 60 * 1000; // Convert hours to milliseconds
    
    setInterval(async () => {
      try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const currentTime = Date.now();
        let closedCount = 0;
        
        for (const tab of tabs) {
          if (!tab.active && !tab.pinned && tab.lastAccessed && 
              (currentTime - tab.lastAccessed) > cleanupInterval) {
            await chrome.tabs.remove(tab.id);
            closedCount++;
          }
        }
        
        if (closedCount > 0) {
          await addActivity('🧹', `Auto-cleanup: closed ${closedCount} tabs`);
        }
      } catch (error) {
        console.error('Auto-cleanup failed:', error);
      }
    }, cleanupInterval);
  }
}

// Context menu integration
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'contextMenuAction') {
    switch (request.menuItemId) {
      case 'addToFocusBlacklist':
        if (request.url) {
          try {
            const domain = new URL(request.url).hostname;
            const data = await storage.get(['blockedSites']);
            const blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
            
            if (!blockedSites.includes(domain)) {
              blockedSites.push(domain);
              await storage.set({ blockedSites });
              showActionResult('🚫', `Added ${domain} to blocked sites`);
            }
          } catch (error) {
            console.error('Failed to add to blacklist:', error);
          }
        }
        break;
      case 'groupSimilarTabs':
        await groupSimilarTabs();
        break;
      case 'analyzeTab':
        await analyzeCurrentTab();
        break;
    }
  }
});

async function analyzeCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const analysis = `Tab Analysis: "${tab.title}" - ${tab.status} - ${new URL(tab.url).hostname}`;
    showActionResult('🔍', analysis);
    await addActivity('🔍', 'Analyzed current tab');
  } catch (error) {
    console.error('Failed to analyze tab:', error);
  }
}

// Performance monitoring
let performanceStats = {
  tabsOpened: 0,
  tabsClosed: 0,
  focusSessionsCompleted: 0,
  totalFocusTime: 0
};

async function updatePerformanceStats(stat, value = 1) {
  performanceStats[stat] = (performanceStats[stat] || 0) + value;
  await storage.set({ performanceStats });
}

// Initialize performance monitoring
chrome.tabs.onCreated.addListener(() => {
  updatePerformanceStats('tabsOpened');
});

chrome.tabs.onRemoved.addListener(() => {
  updatePerformanceStats('tabsClosed');
});

// Memory management
setInterval(() => {
  // Clean up old activities (keep only last 50)
  storage.get(['recentActivities']).then(data => {
    const activities = data.recentActivities || [];
    if (activities.length > 50) {
      activities.splice(50);
      storage.set({ recentActivities: activities });
    }
  });
}, 60000); // Run every minute

// Error handling and logging
window.addEventListener('error', function(e) {
  console.error('Extension error:', e.error);
  addActivity('❌', 'Error occurred: ' + e.error.message);
});

// Initialize auto-cleanup when extension loads
initializeAutoCleanup();

// Add CSS for celebration effect
const celebrationCSS = `
  #celebration {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    animation: fadeIn 0.5s ease;
  }
  
  .confetti-container {
    position: absolute;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  .confetti {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    animation: confettiFall 3s linear infinite;
  }
  
  .celebration-message {
    text-align: center;
    color: white;
    z-index: 10001;
    padding: 40px;
    border-radius: 15px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    animation: celebrationBounce 0.6s ease;
  }
  
  .celebration-message h2 {
    font-size: 2.5em;
    margin-bottom: 20px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  
  .celebration-message p {
    font-size: 1.2em;
    margin-bottom: 10px;
    opacity: 0.9;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes confettiFall {
    0% { transform: translateY(-100vh) rotate(0deg); }
    100% { transform: translateY(100vh) rotate(360deg); }
  }
  
  @keyframes celebrationBounce {
    0% { transform: scale(0.3); }
    50% { transform: scale(1.05); }
    70% { transform: scale(0.9); }
    100% { transform: scale(1); }
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
`;

// Inject CSS
const style = document.createElement('style');
style.textContent = celebrationCSS;
document.head.appendChild(style);