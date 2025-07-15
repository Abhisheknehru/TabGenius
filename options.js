document.addEventListener('DOMContentLoaded', () => {
    // Load saved settings
    chrome.storage.sync.get({
        defaultFocusTime: 25,
        autoCloseTabs: false,
        autoGroupTabs: true,
        maxTabsPerGroup: 10,
        enableAI: true
    }, (items) => {
        document.getElementById('defaultFocusTime').value = items.defaultFocusTime;
        document.getElementById('autoCloseTabs').checked = items.autoCloseTabs;
        document.getElementById('autoGroupTabs').checked = items.autoGroupTabs;
        document.getElementById('maxTabsPerGroup').value = items.maxTabsPerGroup;
        document.getElementById('enableAI').checked = items.enableAI;
    });

    // Save settings
    document.getElementById('save').addEventListener('click', () => {
        chrome.storage.sync.set({
            defaultFocusTime: document.getElementById('defaultFocusTime').value,
            autoCloseTabs: document.getElementById('autoCloseTabs').checked,
            autoGroupTabs: document.getElementById('autoGroupTabs').checked,
            maxTabsPerGroup: document.getElementById('maxTabsPerGroup').value,
            enableAI: document.getElementById('enableAI').checked
        }, () => {
            // Show saved notification
            const status = document.createElement('div');
            status.textContent = 'Settings saved!';
            status.style.color = '#4CAF50';
            document.getElementById('save').parentNode.appendChild(status);
            setTimeout(() => status.remove(), 2000);
        });
    });
});