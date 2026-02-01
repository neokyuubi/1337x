// ==UserScript==
// @name         1337x Magnet Link Fetcher
// @version      2.2
// @description  Adds checkboxes and magnet link extraction functionality to 1337x.to search results. Handles new site structure.
// @updateURL    https://raw.githubusercontent.com/neokyuubi/1337x/main/index.js
// @downloadURL  https://raw.githubusercontent.com/neokyuubi/1337x/main/index.js
// @author       neokyuubi
// @match        *://1337x.to/*
// @match        *://www.1337x.to/*
// @namespace    https://github.com/neokyuubi/1337x-Magnet-Link-Fetcher
// @icon         https://1337x.to/favicon.ico
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==


(function() {
    'use strict';

    // Only run on search and listing pages
    if (!window.location.href.includes('/search/') && 
        !window.location.href.includes('/category/') && 
        !window.location.href.includes('/category-search/') && 
        !window.location.href.includes('/popular/') && 
        !window.location.href.includes('/top-100') && 
        !window.location.href.includes('/sort-search/') && 
        !window.location.href.includes('/trending') && 
        !window.location.href.includes('/movie-library/') && 
        !window.location.href.includes('/cat/')) {
        return;
    }

    // Variables for shift-click functionality
    let lastChecked = null;
    let shiftPressed = false;

    // Track shift key state
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Shift') {
            shiftPressed = true;
        }
    });

    document.addEventListener('keyup', function(e) {
        if (e.key === 'Shift') {
            shiftPressed = false;
        }
    });

    // Add CSS for new elements
    const style = document.createElement('style');
    style.textContent = `
        .checkbox-column { width: 30px; text-align: center; }
        .magnet-column { width: 100px; text-align: center; }
        .action-buttons {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 9999;
        }
        .action-button {
            padding: 10px 15px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            font-weight: bold;
        }
        .action-button:disabled {
            background: #cccccc;
            cursor: not-allowed;
        }
        .magnet-link {
            cursor: pointer;
            color: #4CAF50;
            font-weight: bold;
        }
        .magnet-link:hover {
            text-decoration: underline;
        }
        .copy-success {
            color: green;
            transition: opacity 1s;
        }
    `;
    document.head.appendChild(style);

    // Find the table containing search results - improved selector
    const table = document.querySelector('table.table-list') || 
                  document.querySelector('.table-list') || 
                  document.querySelector('table.table.table-responsive.table-striped');
    if (!table) return;

    // Add header columns for checkbox and magnet
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return; // Safety check
    
    const checkboxHeader = document.createElement('th');
    checkboxHeader.className = 'checkbox-column';
    checkboxHeader.textContent = '';
    headerRow.insertBefore(checkboxHeader, headerRow.firstChild);

    const magnetHeader = document.createElement('th');
    magnetHeader.className = 'magnet-column';
    magnetHeader.textContent = 'Magnet';
    headerRow.appendChild(magnetHeader);

    // Add checkboxes and magnet cells to each row
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        // Add checkbox column
        const checkboxCell = document.createElement('td');
        checkboxCell.className = 'checkbox-column';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';

        // Implement shift-click functionality
        checkbox.addEventListener('click', function(e) {
            if (shiftPressed && lastChecked && lastChecked !== this) {
                // Get all checkboxes
                const checkboxes = Array.from(document.querySelectorAll('.checkbox-column input[type="checkbox"]'));

                // Find indices of current and last checked boxes
                const startIndex = checkboxes.indexOf(this);
                const endIndex = checkboxes.indexOf(lastChecked);

                // Determine range to check (works in both directions)
                const start = Math.min(startIndex, endIndex);
                const end = Math.max(startIndex, endIndex);

                // Check all checkboxes in the range
                for (let i = start; i <= end; i++) {
                    checkboxes[i].checked = this.checked;
                }
            }

            // Update lastChecked reference
            lastChecked = this;
        });

        checkboxCell.appendChild(checkbox);
        row.insertBefore(checkboxCell, row.firstChild);

        // Add magnet column
        const magnetCell = document.createElement('td');
        magnetCell.className = 'magnet-column';
        const torrentLink = row.querySelector('a[href^="/torrent/"]');
        if (torrentLink) {
            magnetCell.dataset.torrentUrl = torrentLink.href;
        }
        row.appendChild(magnetCell);
    });

    // Create sticky action buttons
    const actionButtons = document.createElement('div');
    actionButtons.className = 'action-buttons';

    const fetchButton = document.createElement('button');
    fetchButton.className = 'action-button';
    fetchButton.textContent = 'Fetch Selected Links';
    fetchButton.onclick = fetchSelectedMagnetLinks;

    const copyAllButton = document.createElement('button');
    copyAllButton.className = 'action-button';
    copyAllButton.textContent = 'Copy All Links';
    copyAllButton.onclick = copyAllMagnetLinks;
    copyAllButton.disabled = true;

    actionButtons.appendChild(fetchButton);
    actionButtons.appendChild(copyAllButton);
    document.body.appendChild(actionButtons);

    // Function to fetch magnet links using Hidden Iframes (Bypasses Cloudflare)
    function fetchSelectedMagnetLinks() {
        const checkedRows = Array.from(document.querySelectorAll('.checkbox-column input[type="checkbox"]:checked'));
        if (checkedRows.length === 0) {
            alert('No torrents selected! Please select at least one torrent.');
            return;
        }

        // Initialize queue
        const queue = checkedRows.map(checkbox => {
            const row = checkbox.closest('tr');
            const magnetCell = row.querySelector('.magnet-column');
            return {
                row: row,
                magnetCell: magnetCell,
                torrentUrl: magnetCell.dataset.torrentUrl
            };
        });

        fetchButton.disabled = true;
        copyAllButton.disabled = true;
        
        let processedCount = 0;
        const totalCount = queue.length;

        // Process first item
        processNextItem();

        function processNextItem() {
            if (queue.length === 0) {
                fetchButton.textContent = 'Fetch Selected Links';
                fetchButton.disabled = false;
                copyAllButton.disabled = false;
                return;
            }

            const item = queue.shift();
            const { magnetCell, torrentUrl } = item;

            // Skip if already done or invalid
            if (magnetCell.innerHTML !== '' || !torrentUrl) {
                processedCount++;
                updateFetchButtonStatus(processedCount, totalCount);
                processNextItem();
                return;
            }

            updateFetchButtonStatus(processedCount, totalCount);

            // Create hidden iframe
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = torrentUrl;
            document.body.appendChild(iframe);

            // Set a timeout to kill it if it hangs
            const timeoutId = setTimeout(() => {
                console.warn(`[IframeDebug] Timeout waiting for ${torrentUrl}`);
                magnetCell.textContent = 'Timeout';
                cleanup();
            }, 15000); // 15 second timeout

            function cleanup() {
                clearTimeout(timeoutId);
                try {
                    iframe.remove();
                } catch(e) {}
                processedCount++;
                updateFetchButtonStatus(processedCount, totalCount);
                // Wait a small random delay before next request to be human-like
                setTimeout(processNextItem, 500 + Math.random() * 500);
            }

            iframe.onload = function() {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    
                    // Check for Cloudflare challenge in iframe
                    if (doc.title.includes("Just a moment") || doc.title.includes("Attention Required")) {
                         console.log(`[IframeDebug] Cloudflare challenge detected in iframe for ${torrentUrl}. Waiting...`);
                         // Do not cleanup yet, let it reload itself if it solves headers. 
                         // But for now, we just let the timeout handle it if it gets stuck.
                         return; 
                    }

                    // Attempt 1: Standard selector
                    let magnetLink = doc.querySelector('a[href^="magnet:"]');
                    let magnetUrl = magnetLink ? magnetLink.href : null;

                    // Attempt 2: Fuzzy
                    if (!magnetUrl) {
                        const fuzzyLink = doc.querySelector('a[href*="magnet:"]');
                        if (fuzzyLink) magnetUrl = fuzzyLink.href;
                    }

                    // Attempt 3: Loop
                    if (!magnetUrl) {
                        const allLinks = doc.querySelectorAll('a');
                        for (let i = 0; i < allLinks.length; i++) {
                            if (allLinks[i].href && allLinks[i].href.includes('magnet:?')) {
                                magnetUrl = allLinks[i].href;
                                break;
                            }
                        }
                    }

                    if (magnetUrl) {
                        const copyLink = document.createElement('span');
                        copyLink.className = 'magnet-link';
                        copyLink.textContent = 'Copy';
                        copyLink.dataset.magnetUrl = magnetUrl;
                        copyLink.onclick = function() {
                            navigator.clipboard.writeText(magnetUrl).then(() => {
                                const originalText = copyLink.textContent;
                                copyLink.textContent = 'Copied!';
                                copyLink.classList.add('copy-success');
                                setTimeout(() => {
                                    copyLink.textContent = originalText;
                                    copyLink.classList.remove('copy-success');
                                }, 1000);
                            });
                        };
                        magnetCell.innerHTML = '';
                        magnetCell.appendChild(copyLink);
                        cleanup(); // Success!
                    } else {
                         // If we are here, page loaded but no magnet found. 
                         // Could be we need to wait for JS?
                         // Let's retry once after 2 seconds if not found?
                         // For simplicity, just mark fail.
                         console.warn(`[IframeDebug] No magnet found in iframe for ${torrentUrl}`);
                         magnetCell.textContent = 'Not found';
                         cleanup();
                    }

                } catch (err) {
                    console.error(`[IframeDebug] Error accessing iframe content (CORS?): ${err}`);
                    magnetCell.textContent = 'Access Denied';
                    cleanup();
                }
            };
        }
    }

    // Update fetch button status
    function updateFetchButtonStatus(completed, total) {
        fetchButton.textContent = `Fetching... (${completed}/${total})`;

        if (completed === total) {
            fetchButton.textContent = 'Fetch Selected Links';
            fetchButton.disabled = false;
            copyAllButton.disabled = false;
        }
    }

    // Function to copy all magnet links
    function copyAllMagnetLinks() {
        const magnetLinks = [];
        const magnetCells = document.querySelectorAll('.magnet-link');

        magnetCells.forEach(link => {
            if (link.dataset.magnetUrl) {
                magnetLinks.push(link.dataset.magnetUrl);
            }
        });

        if (magnetLinks.length === 0) {
            alert('No magnet links found!');
            return;
        }

        navigator.clipboard.writeText(magnetLinks.join('\n')).then(() => {
            const originalText = copyAllButton.textContent;
            copyAllButton.textContent = 'Copied All Links!';
            setTimeout(() => {
                copyAllButton.textContent = originalText;
            }, 1000);
        });
    }
})();