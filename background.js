// Smart Tab Manager - Background Script (Service Worker)
// This handles all background processes, Chrome API events, and persistent functionality

// Storage helper functions
const storage = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
  remove: (keys) => chrome.storage.local.remove(keys)
};
let focusModeInterval = null;

// Global state
let focusMode = {
  active: false,
  startTime: null,
  duration: 0,
  paused: false,
  pausedAt: null,
  totalPausedTime: 0,
  remainingTime: 0,
  elapsedTime: 0
};

function updateFocusModeState() {
  if (!focusMode.active) return;
  
  const currentTime = Date.now();
  
  if (focusMode.paused) {
    // When paused, elapsed time stays the same
    focusMode.elapsedTime = focusMode.pausedAt - focusMode.startTime - focusMode.totalPausedTime;
  } else {
    // When running, calculate elapsed time
    focusMode.elapsedTime = currentTime - focusMode.startTime - focusMode.totalPausedTime;
  }
  
  // Calculate remaining time
  focusMode.remainingTime = Math.max(0, focusMode.duration - focusMode.elapsedTime);
  
  // Check if time is up
  if (focusMode.remainingTime <= 0 && focusMode.active) {
    handleEndFocusMode();
  }
}

let userSettings = {
  enableNotifications: true,
  autoGroupTabs: true,
  focusModeEnabled: false,
  autoCleanup: false,
  cleanupTime: 2,
  theme: 'light'
};

// Default blocked sites for focus mode
const DEFAULT_BLOCKED_SITES = [
  'youtube.com',
  'facebook.com',
  'twitter.com',
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
  'linkedin.com'
];

// Initialize extension on startup
chrome.runtime.onStartup.addListener(async () => {
  await initializeExtension();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await handleFirstInstall();
  } else if (details.reason === 'update') {
    await handleUpdate(details.previousVersion);
  }
  await initializeExtension();
});

// Initialize extension
async function initializeExtension() {
  try {
    // Load user settings
    const settings = await storage.get(['userSettings']);
    if (settings.userSettings) {
      userSettings = { ...userSettings, ...settings.userSettings };
    }

    // Initialize blocked sites if not exists
    const blockedSites = await storage.get(['blockedSites']);
    if (!blockedSites.blockedSites) {
      await storage.set({ blockedSites: DEFAULT_BLOCKED_SITES });
    }
    // Initialize Focus state if not exists
    await restoreFocusModeState();
    // Setup context menus
    await setupContextMenus();

    // Setup alarms for auto-cleanup
    if (userSettings.autoCleanup) {
      await setupAutoCleanup();
    }

    // Setup tab monitoring
    setupTabMonitoring();

    console.log('Smart Tab Manager initialized successfully');
  } catch (error) {
    console.error('Failed to initialize extension:', error);
  }
}

// Add this function to restore focus mode state on startup
async function restoreFocusModeState() {
  try {
    const data = await storage.get(['focusModeState']);
    if (data.focusModeState && data.focusModeState.active) {
      focusMode = data.focusModeState;
      
      // Restart the interval timer
      focusModeInterval = setInterval(() => {
        updateFocusModeState();
        storage.set({ focusModeState: focusMode });
      }, 1000);
      
      // Update badge
      if (focusMode.paused) {
        chrome.action.setBadgeText({ text: 'PAUSE' });
        chrome.action.setBadgeBackgroundColor({ color: '#ffaa00' });
      } else {
        chrome.action.setBadgeText({ text: 'FOCUS' });
        chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
      }
      
      console.log('Focus mode state restored:', focusMode);
    }
  } catch (error) {
    console.error('Failed to restore focus mode state:', error);
  }
}

// Handle first install
async function handleFirstInstall() {
  try {
    // Set default settings
    await storage.set({ 
      userSettings,
      blockedSites: DEFAULT_BLOCKED_SITES,
      recentActivities: [],
      performanceStats: {
        tabsOpened: 0,
        tabsClosed: 0,
        focusSessionsCompleted: 0,
        totalFocusTime: 0
      }
    });

    // Show welcome notification
    if (userSettings.enableNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-48.png',
        title: 'Smart Tab Manager',
        message: 'Welcome! Extension installed successfully. Click the icon to get started.'
      });
    }

    // Open welcome page
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  } catch (error) {
    console.error('Failed to handle first install:', error);
  }
}

// Handle extension update
async function handleUpdate(previousVersion) {
  try {
    // Migration logic for different versions
    console.log(`Updated from version ${previousVersion}`);
    
    // Show update notification
    if (userSettings.enableNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-48.png',
        title: 'Smart Tab Manager Updated',
        message: 'New features and improvements are now available!'
      });
    }
  } catch (error) {
    console.error('Failed to handle update:', error);
  }
}

// Setup context menus
async function setupContextMenus() {
  try {
    // Remove existing context menus
    await chrome.contextMenus.removeAll();

    // Add to focus mode blacklist
    chrome.contextMenus.create({
      id: 'addToFocusBlacklist',
      title: 'Block this site during focus mode',
      contexts: ['page']
    });

    // Group similar tabs
    chrome.contextMenus.create({
      id: 'groupSimilarTabs',
      title: 'Group similar tabs',
      contexts: ['page']
    });

    // Analyze current tab
    chrome.contextMenus.create({
      id: 'analyzeTab',
      title: 'Analyze this tab',
      contexts: ['page']
    });

    // Separator
    chrome.contextMenus.create({
      id: 'separator1',
      type: 'separator',
      contexts: ['page']
    });

    // Quick actions submenu
    chrome.contextMenus.create({
      id: 'quickActions',
      title: 'Quick Actions',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'closeDuplicates',
      parentId: 'quickActions',
      title: 'Close duplicate tabs',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'muteAllTabs',
      parentId: 'quickActions',
      title: 'Mute all tabs',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'bookmarkSession',
      parentId: 'quickActions',
      title: 'Bookmark current session',
      contexts: ['page']
    });
  } catch (error) {
    console.error('Failed to setup context menus:', error);
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    switch (info.menuItemId) {
      case 'addToFocusBlacklist':
        await addToFocusBlacklist(info.pageUrl);
        break;
      case 'groupSimilarTabs':
        await groupSimilarTabs();
        break;
      case 'analyzeTab':
        await analyzeTab(tab);
        break;
      case 'closeDuplicates':
        await closeDuplicateTabs();
        break;
      case 'muteAllTabs':
        await muteAllTabs();
        break;
      case 'bookmarkSession':
        await bookmarkCurrentSession();
        break;
    }
  } catch (error) {
    console.error('Context menu action failed:', error);
  }
});

// Group similar tabs
async function groupSimilarTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const groups = {};

    // Group tabs by domain
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
    // Create tab groups for domains with multiple tabs
    for (const [domain, domainTabs] of Object.entries(groups)) {
      if (domainTabs.length > 1) {
        const tabIds = domainTabs.map(tab => tab.id);
        const group = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(group, { title: domain });
        groupedCount += domainTabs.length;
      }
    }

    if (userSettings.enableNotifications && groupedCount > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-48.png',
        title: 'Tabs Grouped',
        message: `Grouped ${groupedCount} tabs by domain.`
      });
    }
  } catch (error) {
    console.error('Failed to group tabs:', error);
  }
}

// Analyze tab
async function analyzeTab(tab) {
  try {
    const analysis = {
      title: tab.title,
      url: tab.url,
      status: tab.status,
      pinned: tab.pinned,
      muted: tab.mutedInfo.muted,
      domain: new URL(tab.url).hostname
    };

    // Store analysis for popup to retrieve
    await storage.set({ lastTabAnalysis: analysis });

    if (userSettings.enableNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-48.png',
        title: 'Tab Analysis',
        message: `${analysis.domain} - ${analysis.status}`
      });
    }
  } catch (error) {
    console.error('Failed to analyze tab:', error);
  }
}

// Close duplicate tabs
async function closeDuplicateTabs() {
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
      for (const duplicate of duplicates) {
        await chrome.tabs.remove(duplicate.id);
      }

      if (userSettings.enableNotifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon-48.png',
          title: 'Duplicates Closed',
          message: `Closed ${duplicates.length} duplicate tabs.`
        });
      }
    }
  } catch (error) {
    console.error('Failed to close duplicates:', error);
  }
}

// Mute all tabs
async function muteAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    let mutedCount = 0;

    for (const tab of tabs) {
      if (!tab.mutedInfo.muted) {
        await chrome.tabs.update(tab.id, { muted: true });
        mutedCount++;
      }
    }

    if (userSettings.enableNotifications && mutedCount > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-48.png',
        title: 'Tabs Muted',
        message: `Muted ${mutedCount} tabs.`
      });
    }
  } catch (error) {
    console.error('Failed to mute tabs:', error);
  }
}

// Bookmark current session
async function bookmarkCurrentSession() {
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

    if (userSettings.enableNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-48.png',
        title: 'Session Bookmarked',
        message: `Bookmarked ${tabs.length} tabs to "${folderName}".`
      });
    }
  } catch (error) {
    console.error('Failed to bookmark session:', error);
  }
}

// Setup tab monitoring
function setupTabMonitoring() {
  // Monitor tab creation
  chrome.tabs.onCreated.addListener(async (tab) => {
    await updatePerformanceStats('tabsOpened');
    
    // Auto-group if enabled
    if (userSettings.autoGroupTabs) {
      setTimeout(async () => {
        await autoGroupNewTab(tab);
      }, 1000); // Delay to allow tab to fully load
    }
  });

  // Monitor tab removal
  chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    await updatePerformanceStats('tabsClosed');
  });

  // Monitor tab updates
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && userSettings.autoGroupTabs) {
      await autoGroupNewTab(tab);
    }
  });
}

// Auto-group new tab
async function autoGroupNewTab(tab) {
  try {
    if (!tab.url || tab.url.startsWith('chrome://')) return;

    const domain = new URL(tab.url).hostname;
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Find existing tabs with same domain
    const sameDomainTabs = tabs.filter(t => {
      try {
        return t.id !== tab.id && new URL(t.url).hostname === domain;
      } catch (e) {
        return false;
      }
    });

    if (sameDomainTabs.length > 0) {
      // Check if there's already a group for this domain
      const existingGroup = sameDomainTabs.find(t => t.groupId !== -1);
      
      if (existingGroup) {
        // Add to existing group
        await chrome.tabs.group({ tabIds: [tab.id], groupId: existingGroup.groupId });
      } else {
        // Create new group
        const allDomainTabs = [...sameDomainTabs, tab];
        const tabIds = allDomainTabs.map(t => t.id);
        const group = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(group, { title: domain });
      }
    }
  } catch (error) {
    console.error('Failed to auto-group tab:', error);
  }
}

// Update performance stats
async function updatePerformanceStats(stat, value = 1) {
  try {
    const data = await storage.get(['performanceStats']);
    const stats = data.performanceStats || {};
    stats[stat] = (stats[stat] || 0) + value;
    await storage.set({ performanceStats: stats });
  } catch (error) {
    console.error('Failed to update performance stats:', error);
  }
}

// Setup auto-cleanup
async function setupAutoCleanup() {
  try {
    const alarmName = 'autoCleanup';
    
    // Clear existing alarm
    chrome.alarms.clear(alarmName);
    
    // Create new alarm
    const intervalMinutes = userSettings.cleanupTime * 60; // Convert hours to minutes
    chrome.alarms.create(alarmName, { periodInMinutes: intervalMinutes });
    
    console.log(`Auto-cleanup scheduled every ${userSettings.cleanupTime} hours`);
  } catch (error) {
    console.error('Failed to setup auto-cleanup:', error);
  }
}

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autoCleanup') {
    await performAutoCleanup();
  } else if (alarm.name === 'focusMode') {
    await endFocusMode();
  }
});

// Perform auto-cleanup
async function performAutoCleanup() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const currentTime = Date.now();
    const inactiveThreshold = userSettings.cleanupTime * 60 * 60 * 1000; // Convert hours to milliseconds
    
    let closedCount = 0;
    
    for (const tab of tabs) {
      if (!tab.active && !tab.pinned && tab.lastAccessed && 
          (currentTime - tab.lastAccessed) > inactiveThreshold) {
        await chrome.tabs.remove(tab.id);
        closedCount++;
      }
    }
    
    if (closedCount > 0) {
      await addActivity('🧹', `Auto-cleanup: closed ${closedCount} tabs`);
      
      if (userSettings.enableNotifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon-48.png',
          title: 'Auto-cleanup Complete',
          message: `Closed ${closedCount} inactive tabs.`
        });
      }
    }
  } catch (error) {
    console.error('Auto-cleanup failed:', error);
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startFocusMode':
      handleStartFocusMode(request.duration);
      break;
    case 'pauseFocusMode':
      handlePauseFocusMode();
      break;
    case 'resumeFocusMode':
      handleResumeFocusMode();
      break;
    case 'endFocusMode':
      handleEndFocusMode();
      break;
    case 'updateSettings':
      handleUpdateSettings(request.settings);
      break;
    case 'getFocusStatus':
      sendResponse(focusMode);
      break;
    case 'contextMenuAction':
      handleContextMenuAction(request);
      break;
  }
});

// Handle start focus mode
async function handleStartFocusMode(duration) {
  try {
    focusMode = {
      active: true,
      startTime: Date.now(),
      duration: duration * 1000, // Convert to milliseconds
      paused: false,
      pausedAt: null,
      totalPausedTime: 0
    };
    // Save focus mode state to storage for persistence
    await storage.set({ focusModeState: focusMode });

    // Start the interval timer to update state every second
    focusModeInterval = setInterval(() => {
      updateFocusModeState();
      // Also save updated state to storage
      storage.set({ focusModeState: focusMode });
    }, 1000);

    // Enable site blocking
    await enableSiteBlocking();

    // Set alarm for focus mode end
    chrome.alarms.create('focusMode', { delayInMinutes: duration / 60 });

    // Update badge
    chrome.action.setBadgeText({ text: 'FOCUS' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });

    if (userSettings.enableNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-48.png',
        title: 'Focus Mode Started',
        message: `Focus session started for ${Math.round(duration / 60)} minutes.`
      });
    }

    console.log('Focus mode started:', focusMode);
  } catch (error) {
    console.error('Failed to start focus mode:', error);
  }
}

// Handle pause focus mode
async function handlePauseFocusMode() {
  if (focusMode.active && !focusMode.paused) {
    focusMode.paused = true;
    focusMode.pausedAt = Date.now();

    // Save state to storage
    await storage.set({ focusModeState: focusMode });
    
    // Clear the alarm
    chrome.alarms.clear('focusMode');
    
    // Update badge
    chrome.action.setBadgeText({ text: 'PAUSE' });
    chrome.action.setBadgeBackgroundColor({ color: '#ffaa00' });
    
    console.log('Focus mode paused');
  }
}

// Handle resume focus mode
async function handleResumeFocusMode() {
  if (focusMode.active && focusMode.paused) {
    const pausedDuration = Date.now() - focusMode.pausedAt;
    focusMode.totalPausedTime += pausedDuration;
    focusMode.paused = false;
    focusMode.pausedAt = null;
    
    // Save state to storage
    await storage.set({ focusModeState: focusMode });
    
    // Update remaining time
    updateFocusModeState();
    // Calculate remaining time
    const elapsed = Date.now() - focusMode.startTime - focusMode.totalPausedTime;
    const remaining = Math.max(0, focusMode.duration - elapsed);
    
    if (remaining > 0) {
      // Set new alarm for remaining time
      chrome.alarms.create('focusMode', { delayInMinutes: remaining / (60 * 1000) });
      
      // Update badge
      chrome.action.setBadgeText({ text: 'FOCUS' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
    } else {
      // Time's up
      handleEndFocusMode();
    }
    
    console.log('Focus mode resumed');
  }
}

// Handle end focus mode
async function handleEndFocusMode() {
  if (focusMode.active) {
    const sessionDuration = Date.now() - focusMode.startTime - focusMode.totalPausedTime;
    const completed = sessionDuration >= focusMode.duration;
    
    focusMode.active = false;
    
    // Clear interval timer
    if(focusModeInterval) {
      clearInterval(focusModeInterval);
      focusModeInterval = null;
    }
    // Clear from storage
    await storage.remove(['focusModeState']);
        
    // Disable site blocking
    await disableSiteBlocking();
    
    // Clear alarm
    chrome.alarms.clear('focusMode');
    
    // Update badge
    chrome.action.setBadgeText({ text: '' });
    
    // Update stats
    if (completed) {
      await updatePerformanceStats('focusSessionsCompleted');
      await updatePerformanceStats('totalFocusTime', Math.round(sessionDuration / 1000));
    }
    
    if (userSettings.enableNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-48.png',
        title: completed ? 'Focus Session Completed!' : 'Focus Session Ended',
        message: completed ? 'Congratulations! You completed your focus session.' : 'Focus session was ended early.'
      });
    }
    
    console.log('Focus mode ended:', { completed, duration: sessionDuration });
  }
}

// Handle update settings
async function handleUpdateSettings(settings) {
  try {
    userSettings = { ...userSettings, ...settings };
    await storage.set({ userSettings });
    
    // Update auto-cleanup if setting changed
    if (settings.autoCleanup !== undefined) {
      if (settings.autoCleanup) {
        await setupAutoCleanup();
      } else {
        chrome.alarms.clear('autoCleanup');
      }
    }
    
    console.log('Settings updated:', userSettings);
  } catch (error) {
    console.error('Failed to update settings:', error);
  }
}

// Handle context menu action
function handleContextMenuAction(request) {
  // Forward to popup for processing
  chrome.runtime.sendMessage(request);
}

// Enable site blocking for focus mode
// Updated site blocking functions for Manifest V3

// Enable site blocking for focus mode
// Fixed site blocking functions for Manifest V3

// Enable site blocking for focus mode
async function enableSiteBlocking() {
  try {
    // Enable the static ruleset
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: ["focus_mode_rules"]
    });
    
    // Get user-added blocked sites
    const data = await storage.get(['blockedSites']);
    const blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
    
    // Create dynamic rules for user-added sites that aren't in static rules
    const staticSites = [
      'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com', 
      'reddit.com', 'netflix.com', 'tiktok.com', 'twitch.tv', 
      'discord.com', 'whatsapp.com'
    ];
    
    const dynamicRules = [];
    let ruleId = 1000; // Start with high ID to avoid conflicts
    
    for (const site of blockedSites) {
      // Skip sites that are already in static rules
      if (staticSites.includes(site)) continue;
      
      // Create rule for this domain
      dynamicRules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            extensionPath: '/blocked.html'
          }
        },
        condition: {
          urlFilter: `*://*.${site}/*`,
          resourceTypes: ['main_frame']
        }
      });
      
      // Also block without www
      if (!site.startsWith('www.')) {
        dynamicRules.push({
          id: ruleId++,
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              extensionPath: '/blocked.html'
            }
          },
          condition: {
            urlFilter: `*://${site}/*`,
            resourceTypes: ['main_frame']
          }
        });
      }
    }
    
    // Add dynamic rules if any
    if (dynamicRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: dynamicRules
      });
    }

    await storage.set({ focusModeActive: true });
    await addActivity('🚫', 'Site blocking enabled');
    console.log('Site blocking enabled for focus mode');
  } catch (error) {
    console.error('Failed to enable site blocking:', error);
  }
}

// Disable site blocking
async function disableSiteBlocking() {
  try {
    // Disable static ruleset
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: ["focus_mode_rules"]
    });
    
    // Remove all dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map(rule => rule.id);
    
    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
    }

    await storage.set({ focusModeActive: false });
    await addActivity('✅', 'Site blocking disabled');
    console.log('Site blocking disabled');
  } catch (error) {
    console.error('Failed to disable site blocking:', error);
  }
}

// Add site to focus mode blacklist (updated for V3)
async function addToFocusBlacklist(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const data = await storage.get(['blockedSites']);
    const blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
    
    if (!blockedSites.includes(domain)) {
      blockedSites.push(domain);
      await storage.set({ blockedSites });
      
      // If focus mode is active, add dynamic rule immediately
      const focusData = await storage.get(['focusModeActive']);
      if (focusData.focusModeActive) {
        const timestamp = Date.now();
        const rules = [
          {
            id: timestamp,
            priority: 1,
            action: {
              type: 'redirect',
              redirect: {
                extensionPath: '/blocked.html'
              }
            },
            condition: {
              urlFilter: `*://*.${domain}/*`,
              resourceTypes: ['main_frame']
            }
          },
          {
            id: timestamp + 1,
            priority: 1,
            action: {
              type: 'redirect',
              redirect: {
                extensionPath: '/blocked.html'
              }
            },
            condition: {
              urlFilter: `*://${domain}/*`,
              resourceTypes: ['main_frame']
            }
          }
        ];
        
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: rules
        });
      }
      
      await addActivity('🚫', `Added ${domain} to blocked sites`);
      
      if (userSettings.enableNotifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon-48.png',
          title: 'Site Added to Blacklist',
          message: `${domain} will be blocked during focus mode.`
        });
      }
    }
  } catch (error) {
    console.error('Failed to add to blacklist:', error);
  }
}

// Remove site from focus mode blacklist
async function removeFromFocusBlacklist(domain) {
  try {
    const data = await storage.get(['blockedSites']);
    const blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
    
    const index = blockedSites.indexOf(domain);
    if (index > -1) {
      blockedSites.splice(index, 1);
      await storage.set({ blockedSites });
      
      // If focus mode is active, remove dynamic rules for this domain
      const focusData = await storage.get(['focusModeActive']);
      if (focusData.focusModeActive) {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const rulesToRemove = existingRules
          .filter(rule => 
            rule.condition.urlFilter.includes(domain)
          )
          .map(rule => rule.id);
        
        if (rulesToRemove.length > 0) {
          await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: rulesToRemove
          });
        }
      }
      
      await addActivity('✅', `Removed ${domain} from blocked sites`);
      
      if (userSettings.enableNotifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon-48.png',
          title: 'Site Removed from Blacklist',
          message: `${domain} is no longer blocked during focus mode.`
        });
      }
    }
  } catch (error) {
    console.error('Failed to remove from blacklist:', error);
  }
}

// Test site blocking (for debugging)
async function testSiteBlocking() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    console.log('Current dynamic rules:', rules);
    
    const enabledRulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
    console.log('Enabled rulesets:', enabledRulesets);
    
    const data = await storage.get(['blockedSites', 'focusModeActive']);
    console.log('Blocked sites:', data.blockedSites);
    console.log('Focus mode active:', data.focusModeActive);
  } catch (error) {
    console.error('Failed to test site blocking:', error);
  }
}

// Add activity to recent activities
async function addActivity(icon, text) {
  try {
    const data = await storage.get(['recentActivities']);
    const activities = data.recentActivities || [];
    
    const newActivity = {
      icon,
      text,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now()
    };
    
    activities.unshift(newActivity);
    
    // Keep only last 50 activities
    if (activities.length > 50) {
      activities.splice(50);
    }
    
    await storage.set({ recentActivities: activities });
  } catch (error) {
    console.error('Failed to add activity:', error);
  }
}

// Memory cleanup - run periodically
setInterval(async () => {
  try {
    // Clean up old activities
    const data = await storage.get(['recentActivities']);
    const activities = data.recentActivities || [];
    
    if (activities.length > 100) {
      activities.splice(100);
      await storage.set({ recentActivities: activities });
    }
    
    // Clean up old performance stats if needed
    // Could add more cleanup logic here
  } catch (error) {
    console.error('Memory cleanup failed:', error);
  }
}, 300000); // Run every 5 minutes

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open extension popup when notification is clicked
  chrome.action.openPopup();
});

// Handle browser action click
chrome.action.onClicked.addListener((tab) => {
  // This is handled by the popup, but we can add fallback logic here
  console.log('Extension icon clicked');
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'toggle-focus-mode':
      if (focusMode.active) {
        await handleEndFocusMode();
      } else {
        await handleStartFocusMode(25 * 60); // 25 minutes default
      }
      break;
    case 'group-tabs':
      await groupSimilarTabs();
      break;
    case 'close-duplicates':
      await closeDuplicateTabs();
      break;
  }
});

// Monitor system idle state
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle' && focusMode.active) {
    // Optionally pause focus mode when idle
    console.log('System is idle during focus mode');
  }
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // All windows lost focus
    console.log('All windows lost focus');
  } else {
    // A window gained focus
    console.log('Window gained focus:', windowId);
  }
});

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeExtension,
    handleStartFocusMode,
    handleEndFocusMode,
    groupSimilarTabs,
    closeDuplicateTabs,
    addActivity,
    updatePerformanceStats
  };
}

console.log('Smart Tab Manager background script loaded successfully');