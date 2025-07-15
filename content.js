// Smart Tab Manager - Content Script
// This script runs on every web page and handles page-level interactions

// Global variables
let focusModeActive = false;
let focusOverlay = null;
let focusWarningShown = false;
let pageAnalytics = {
  timeSpent: 0,
  scrollDepth: 0,
  interactions: 0,
  startTime: Date.now()
};

// Initialize content script
(function() {
  'use strict';
  
  console.log('Smart Tab Manager content script loaded on:', window.location.hostname);
  
  // Initialize features
  initializeContentScript();
  
  // Setup page monitoring
  setupPageMonitoring();
  
  // Setup focus mode detection
  setupFocusModeDetection();
  
  // Setup keyboard shortcuts
  setupKeyboardShortcuts();
  
  // Setup scroll tracking
  setupScrollTracking();
  
  // Setup interaction tracking
  setupInteractionTracking();
})();

// Initialize content script
async function initializeContentScript() {
  try {
    // Check if focus mode is active
    const response = await chrome.runtime.sendMessage({ action: 'getFocusStatus' });
    if (response && response.active) {
      focusModeActive = true;
      await checkFocusMode();
    }
    
    // Add page load time tracking
    if (document.readyState === 'complete') {
      trackPageLoad();
    } else {
      window.addEventListener('load', trackPageLoad);
    }
    
    // Setup message listener
    chrome.runtime.onMessage.addListener(handleMessage);
    
  } catch (error) {
    console.error('Failed to initialize content script:', error);
  }
}

// Handle messages from background script
function handleMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'focusModeStarted':
      handleFocusModeStarted();
      break;
    case 'focusModeEnded':
      handleFocusModeEnded();
      break;
    case 'checkFocusMode':
      checkFocusMode();
      break;
    case 'analyzeCurrentPage':
      sendResponse(analyzeCurrentPage());
      break;
    case 'getPageAnalytics':
      sendResponse(getPageAnalytics());
      break;
    case 'highlightTabElements':
      highlightTabElements();
      break;
    case 'showFocusReminder':
      showFocusReminder();
      break;
  }
}

// Handle focus mode started
function handleFocusModeStarted() {
  focusModeActive = true;
  checkFocusMode();
}

// Handle focus mode ended
function handleFocusModeEnded() {
  focusModeActive = false;
  removeFocusOverlay();
  focusWarningShown = false;
}

// Check if current site should be blocked in focus mode
async function checkFocusMode() {
  if (!focusModeActive) return;
  
  try {
    const currentDomain = window.location.hostname;
    
    // Get blocked sites from storage
    const result = await chrome.storage.local.get(['blockedSites']);
    const blockedSites = result.blockedSites || [];
    
    // Check if current domain is blocked
    const isBlocked = blockedSites.some(site => 
      currentDomain.includes(site) || site.includes(currentDomain)
    );
    
    if (isBlocked) {
      showFocusBlockedOverlay();
    } else {
      // Show focus reminder for non-blocked sites
      showFocusReminder();
    }
    
  } catch (error) {
    console.error('Failed to check focus mode:', error);
  }
}

// Show focus mode blocked overlay
function showFocusBlockedOverlay() {
  if (focusOverlay) return; // Already showing
  
  focusOverlay = document.createElement('div');
  focusOverlay.id = 'smartTabFocusOverlay';
  focusOverlay.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      z-index: 999999;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
      text-align: center;
    ">
      <div style="
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        margin: 20px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      ">
        <div style="font-size: 4rem; margin-bottom: 20px;">🧘‍♀️</div>
        <h1 style="font-size: 2.5rem; margin-bottom: 20px; font-weight: 300;">Focus Mode Active</h1>
        <p style="font-size: 1.2rem; line-height: 1.6; margin-bottom: 30px; opacity: 0.9;">
          This site is blocked during focus mode. Take a deep breath and get back to work!
        </p>
        <div style="margin-bottom: 20px;">
          <button id="focusEndButton" style="
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 12px 24px;
            border-radius: 10px;
            font-size: 1rem;
            cursor: pointer;
            margin-right: 10px;
            transition: all 0.3s ease;
          ">End Focus Mode</button>
          <button id="focusGoBackButton" style="
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 12px 24px;
            border-radius: 10px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
          ">Go Back</button>
        </div>
        <div style="font-size: 0.9rem; opacity: 0.7;">
          Domain: ${window.location.hostname}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(focusOverlay);
  
  // Add event listeners
  document.getElementById('focusEndButton').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'endFocusMode' });
    removeFocusOverlay();
  });
  
  document.getElementById('focusGoBackButton').addEventListener('click', () => {
    window.history.back();
  });
  
  // Add hover effects
  const buttons = focusOverlay.querySelectorAll('button');
  buttons.forEach(button => {
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(255, 255, 255, 0.3)';
      button.style.transform = 'translateY(-2px)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = button.id === 'focusEndButton' ? 'rgba(255, 255, 255, 0.2)' : 'transparent';
      button.style.transform = 'translateY(0)';
    });
  });
}

// Remove focus overlay
function removeFocusOverlay() {
  if (focusOverlay) {
    focusOverlay.remove();
    focusOverlay = null;
  }
}

// Show focus reminder for non-blocked sites
function showFocusReminder() {
  if (focusWarningShown) return;
  
  const reminder = document.createElement('div');
  reminder.id = 'smartTabFocusReminder';
  reminder.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
      color: #2d3436;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 300px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      animation: slideIn 0.3s ease-out;
    ">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 18px; margin-right: 8px;">⏰</span>
        <strong>Focus Mode Active</strong>
      </div>
      <div style="font-size: 12px; opacity: 0.8;">
        Stay focused on your goals!
      </div>
      <button id="focusReminderClose" style="
        position: absolute;
        top: 5px;
        right: 8px;
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: #636e72;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">×</button>
    </div>
    <style>
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    </style>
  `;
  
  document.body.appendChild(reminder);
  focusWarningShown = true;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (document.getElementById('smartTabFocusReminder')) {
      document.getElementById('smartTabFocusReminder').remove();
    }
  }, 5000);
  
  // Close button
  document.getElementById('focusReminderClose').addEventListener('click', () => {
    reminder.remove();
  });
}

// Setup page monitoring
function setupPageMonitoring() {
  // Track page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pageAnalytics.timeSpent += Date.now() - pageAnalytics.startTime;
    } else {
      pageAnalytics.startTime = Date.now();
    }
  });
  
  // Track when user leaves page
  window.addEventListener('beforeunload', () => {
    pageAnalytics.timeSpent += Date.now() - pageAnalytics.startTime;
    
    // Send analytics to background script
    chrome.runtime.sendMessage({
      action: 'updatePageAnalytics',
      data: {
        url: window.location.href,
        domain: window.location.hostname,
        timeSpent: pageAnalytics.timeSpent,
        scrollDepth: pageAnalytics.scrollDepth,
        interactions: pageAnalytics.interactions
      }
    });
  });
}

// Setup focus mode detection
function setupFocusModeDetection() {
  // Listen for focus mode changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.focusModeActive) {
      if (changes.focusModeActive.newValue) {
        handleFocusModeStarted();
      } else {
        handleFocusModeEnded();
      }
    }
  });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    // Alt + F - Toggle focus mode
    if (event.altKey && event.key === 'f') {
      event.preventDefault();
      chrome.runtime.sendMessage({ action: 'toggleFocusMode' });
    }
    
    // Alt + G - Group similar tabs
    if (event.altKey && event.key === 'g') {
      event.preventDefault();
      chrome.runtime.sendMessage({ action: 'groupSimilarTabs' });
    }
    
    // Alt + D - Close duplicates
    if (event.altKey && event.key === 'd') {
      event.preventDefault();
      chrome.runtime.sendMessage({ action: 'closeDuplicates' });
    }
    
    // Track keyboard interactions
    pageAnalytics.interactions++;
  });
}

// Setup scroll tracking
function setupScrollTracking() {
  let maxScroll = 0;
  
  window.addEventListener('scroll', () => {
    const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
    maxScroll = Math.max(maxScroll, scrollPercent);
    pageAnalytics.scrollDepth = maxScroll;
  });
}

// Setup interaction tracking
function setupInteractionTracking() {
  ['click', 'touchstart', 'keypress'].forEach(eventType => {
    document.addEventListener(eventType, () => {
      pageAnalytics.interactions++;
    });
  });
}

// Track page load
function trackPageLoad() {
  const loadTime = performance.now();
  chrome.runtime.sendMessage({
    action: 'trackPageLoad',
    data: {
      url: window.location.href,
      domain: window.location.hostname,
      loadTime: loadTime,
      timestamp: Date.now()
    }
  });
}

// Analyze current page
function analyzeCurrentPage() {
  const analysis = {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    description: getMetaDescription(),
    keywords: getMetaKeywords(),
    headings: getHeadings(),
    links: document.links.length,
    images: document.images.length,
    scripts: document.scripts.length,
    loadTime: performance.now(),
    wordCount: getWordCount(),
    language: document.documentElement.lang || 'unknown',
    hasVideo: document.querySelectorAll('video').length > 0,
    hasAudio: document.querySelectorAll('audio').length > 0,
    isSecure: window.location.protocol === 'https:',
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };
  
  return analysis;
}

// Get meta description
function getMetaDescription() {
  const meta = document.querySelector('meta[name="description"]');
  return meta ? meta.getAttribute('content') : '';
}

// Get meta keywords
function getMetaKeywords() {
  const meta = document.querySelector('meta[name="keywords"]');
  return meta ? meta.getAttribute('content') : '';
}

// Get headings
function getHeadings() {
  const headings = {};
  for (let i = 1; i <= 6; i++) {
    const elements = document.querySelectorAll(`h${i}`);
    headings[`h${i}`] = elements.length;
  }
  return headings;
}

// Get word count
function getWordCount() {
  const text = document.body.innerText || document.body.textContent || '';
  return text.trim().split(/\s+/).length;
}

// Get page analytics
function getPageAnalytics() {
  return {
    ...pageAnalytics,
    currentTime: Date.now(),
    sessionTime: Date.now() - pageAnalytics.startTime
  };
}

// Highlight tab-related elements
function highlightTabElements() {
  const elements = document.querySelectorAll('a[href], button[onclick], [role="button"]');
  
  elements.forEach(element => {
    const href = element.getAttribute('href');
    if (href && (href.startsWith('http') || href.startsWith('//'))) {
      element.style.outline = '2px solid #4CAF50';
      element.style.outlineOffset = '2px';
      element.title = 'Smart Tab Manager: External link detected';
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        element.style.outline = '';
        element.style.outlineOffset = '';
        if (element.title === 'Smart Tab Manager: External link detected') {
          element.removeAttribute('title');
        }
      }, 3000);
    }
  });
}

// Inject focus mode styles
function injectFocusModeStyles() {
  const style = document.createElement('style');
  style.id = 'smartTabFocusStyles';
  style.textContent = `
    .smart-tab-focus-dimmed {
      filter: blur(2px) brightness(0.7);
      pointer-events: none;
      transition: all 0.3s ease;
    }
    
    .smart-tab-focus-highlight {
      position: relative;
      z-index: 1000;
      filter: none !important;
      pointer-events: auto !important;
    }
    
    .smart-tab-focus-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 999999;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  `;
  
  document.head.appendChild(style);
}

// Remove focus mode styles
function removeFocusModeStyles() {
  const style = document.getElementById('smartTabFocusStyles');
  if (style) {
    style.remove();
  }
}

// Monitor for new tabs being opened
function monitorNewTabs() {
  // Override window.open
  const originalOpen = window.open;
  window.open = function(...args) {
    chrome.runtime.sendMessage({
      action: 'newTabOpened',
      data: {
        url: args[0],
        target: args[1],
        features: args[2],
        source: window.location.href
      }
    });
    return originalOpen.apply(this, args);
  };
  
  // Monitor clicks on links
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link && link.href) {
      const isExternal = link.hostname !== window.location.hostname;
      const opensNewTab = link.target === '_blank' || event.ctrlKey || event.metaKey;
      
      if (isExternal || opensNewTab) {
        chrome.runtime.sendMessage({
          action: 'linkClicked',
          data: {
            url: link.href,
            text: link.textContent.trim(),
            isExternal: isExternal,
            opensNewTab: opensNewTab,
            source: window.location.href
          }
        });
      }
    }
  });
}

// Add performance monitoring
function addPerformanceMonitoring() {
  // Monitor long tasks
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) { // Tasks longer than 50ms
          chrome.runtime.sendMessage({
            action: 'longTaskDetected',
            data: {
              duration: entry.duration,
              startTime: entry.startTime,
              url: window.location.href
            }
          });
        }
      }
    });
    
    observer.observe({ entryTypes: ['longtask'] });
  }
  
  // Monitor memory usage
  if (performance.memory) {
    setInterval(() => {
      chrome.runtime.sendMessage({
        action: 'memoryUsage',
        data: {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          url: window.location.href
        }
      });
    }, 60000); // Every minute
  }
}

// Initialize additional features
document.addEventListener('DOMContentLoaded', () => {
  injectFocusModeStyles();
  monitorNewTabs();
  addPerformanceMonitoring();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  removeFocusModeStyles();
  removeFocusOverlay();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    analyzeCurrentPage,
    getPageAnalytics,
    checkFocusMode,
    showFocusReminder,
    highlightTabElements
  };
}

console.log('Smart Tab Manager content script initialized successfully');