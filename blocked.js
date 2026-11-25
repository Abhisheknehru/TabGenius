
        const motivationalQuotes = [
            "The successful warrior is the average person with laser-like focus. - Bruce Lee",
            "Concentration is the secret of strength. - Ralph Waldo Emerson",
            "Focus on being productive instead of busy. - Tim Ferriss",
            "Where focus goes, energy flows. - Tony Robbins",
            "The art of being wise is knowing what to overlook. - William James",
            "It is during our darkest moments that we must focus to see the light. - Aristotle",
            "Your focus determines your reality. - George Lucas"
        ];
        
        function updateMotivation() {
            const motivationEl = document.getElementById('motivationText');
            const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
            motivationEl.textContent = randomQuote;
        }
        
        function updateFocusInfo() {
            // Try to get focus mode info from storage
            chrome.storage.local.get(['focusModeActive'], (result) => {
                if (result.focusModeActive) {
                    // Get focus mode details from background script
                    chrome.runtime.sendMessage({action: 'getFocusStatus'}, (response) => {
                        if (response && response.active) {
                            const timeRemaining = document.getElementById('timeRemaining');
                            const progressFill = document.getElementById('progressFill');
                            
                            const elapsed = (response.paused ? response.pausedAt : Date.now()) - response.startTime - response.totalPausedTime;
                            const remaining = Math.max(0, response.duration - elapsed);
                            const progress = Math.min(100, (elapsed / response.duration) * 100);
                            
                            const minutes = Math.floor(remaining / 60000);
                            const seconds = Math.floor((remaining % 60000) / 1000);
                            
                            timeRemaining.textContent = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
                            progressFill.style.width = `${progress}%`;
                            
                            if (response.paused) {
                                timeRemaining.textContent += ' (Paused)';
                            }
                        }
                    });
                } else {
                    document.getElementById('timeRemaining').textContent = 'Focus mode not active';
                }
            });
        }
        
        function goBack() {
            // The declarativeNetRequest redirect replaces history,
            // so history.back() would just redirect to the blocked site again.
            // Instead, navigate to a safe page or close the tab.

            // Try to find the previous non-blocked page via the referrer
            if (document.referrer) {
                // Check if referrer is also a blocked site
                const blockedDomains = [
                    'youtube.com', 'facebook.com', 'twitter.com', 'x.com',
                    'instagram.com', 'reddit.com', 'netflix.com', 'tiktok.com',
                    'twitch.tv', 'discord.com', 'whatsapp.com'
                ];
                try {
                    const referrerHost = new URL(document.referrer).hostname;
                    const isBlocked = blockedDomains.some(d => referrerHost.includes(d));
                    if (!isBlocked) {
                        window.location.href = document.referrer;
                        return;
                    }
                } catch (e) { /* ignore */ }
            }

            // Navigate to new tab page
            // chrome.tabs API is not available in web_accessible_resources pages,
            // so we use direct navigation instead.
            window.location.href = 'about:newtab';
        }
        
        function openFocusPanel() {
            chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
        }
        
        // Initialize page
        updateMotivation();
        updateFocusInfo();
        
        // Update info every second
        setInterval(updateFocusInfo, 1000);
        
        // Change motivation every 30 seconds
        setInterval(updateMotivation, 30000);
        
        // Add some interactive elements
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                goBack();
            }
        });
        
        // Add click effect to container
        const container = document.querySelector('.container');
        container.addEventListener('click', (e) => {
            if (e.target === container) {
                container.style.transform = 'scale(1.02)';
                setTimeout(() => {
                    container.style.transform = 'scale(1)';
                }, 150);
            }
        });

document.getElementById('backButton').addEventListener('click', goBack);
document.getElementById('focusButton').addEventListener('click', openFocusPanel);
