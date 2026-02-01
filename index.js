// ==UserScript==
// @name         1337x Magnet Link Fetcher
// @version      2.3
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

    // --- CONFIGURATION ---
    const SEARCH_PAGE_REGEX = /(\/search\/|\/category\/|\/category-search\/|\/popular\/|\/top-100|\/sort-search\/|\/trending|\/movie-library\/|\/cat\/)/;
    const TORRENT_PAGE_REGEX = /\/torrent\//;

    // --- SLAVE MODE: TORRENT PAGE ---
    // If we are on a torrent page AND we were opened by a script (window.name starts with "fetcher_"), do the work and close.
    if (TORRENT_PAGE_REGEX.test(window.location.href) && window.name.startsWith('1337x_fetcher_')) {
        console.log("Fetcher Slave Active");
        
        // Wait for content (in case of cloudflare, it might reload automatically. 
        // We set a slightly longer delay or check for magnet immediately if ready)
        function extractAndClose() {
             // Check for Cloudflare title
             if (document.title.includes("Just a moment") || document.title.includes("Attention Required")) {
                 console.log("Cloudflare detected, waiting...");
                 setTimeout(extractAndClose, 1000); // Retry in 1s
                 return;
             }

             // Attempt magnet extraction
             let magnetUrl = null;
             
             // 1. Standard
             let magnetLink = document.querySelector('a[href^="magnet:"]');
             if (magnetLink) magnetUrl = magnetLink.href;

             // 2. Fuzzy
             if (!magnetUrl) {
                 const fuzzy = document.querySelector('a[href*="magnet:"]');
                 if (fuzzy) magnetUrl = fuzzy.href;
             }

             // Send result back to opener
             if (window.opener) {
                 window.opener.postMessage({
                     type: 'MAGNET_RESULT',
                     windowName: window.name,
                     magnetUrl: magnetUrl,
                     status: magnetUrl ? 'success' : 'not-found'
                 }, '*');
             }

             // Close self
             window.close();
        }

        // Run after decent delay to allow cloudflare pass
        setTimeout(extractAndClose, 500); 
        return; 
    }

    // --- MASTER MODE: SEARCH/LIST PAGE ---
    if (!SEARCH_PAGE_REGEX.test(window.location.href)) {
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

    // Find the table containing search results
    const table = document.querySelector('table.table-list') || 
                  document.querySelector('.table-list') || 
                  document.querySelector('table.table.table-responsive.table-striped');
    if (!table) return;

    // Add header columns
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
    
    const checkboxHeader = document.createElement('th');
    checkboxHeader.className = 'checkbox-column';
    checkboxHeader.textContent = '';
    headerRow.insertBefore(checkboxHeader, headerRow.firstChild);

    const magnetHeader = document.createElement('th');
    magnetHeader.className = 'magnet-column';
    magnetHeader.textContent = 'Magnet';
    headerRow.appendChild(magnetHeader);

    // Add checkboxes and magnet cells
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const checkboxCell = document.createElement('td');
        checkboxCell.className = 'checkbox-column';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';

        checkbox.addEventListener('click', function(e) {
            if (shiftPressed && lastChecked && lastChecked !== this) {
                const checkboxes = Array.from(document.querySelectorAll('.checkbox-column input[type="checkbox"]'));
                const startIndex = checkboxes.indexOf(this);
                const endIndex = checkboxes.indexOf(lastChecked);
                const start = Math.min(startIndex, endIndex);
                const end = Math.max(startIndex, endIndex);
                for (let i = start; i <= end; i++) {
                    checkboxes[i].checked = this.checked;
                }
            }
            lastChecked = this;
        });

        checkboxCell.appendChild(checkbox);
        row.insertBefore(checkboxCell, row.firstChild);

        const magnetCell = document.createElement('td');
        magnetCell.className = 'magnet-column';
        const torrentLink = row.querySelector('a[href^="/torrent/"]');
        if (torrentLink) {
            magnetCell.dataset.torrentUrl = torrentLink.href;
        }
        row.appendChild(magnetCell);
    });

    // Action buttons
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

    // Function to fetch magnet links using Native Fetch (Same Origin)
    function fetchSelectedMagnetLinks() {
        const checkedRows = Array.from(document.querySelectorAll('.checkbox-column input[type="checkbox"]:checked'));
        if (checkedRows.length === 0) {
            alert('No torrents selected!');
            return;
        }

        // Initialize queue
        const queue = checkedRows.map(checkbox => {
            const row = checkbox.closest('tr');
            const magnetCell = row.querySelector('.magnet-column');
            return {
                magnetCell: magnetCell,
                torrentUrl: magnetCell.dataset.torrentUrl
            };
        }).filter(item => item.magnetCell.innerHTML === '' && item.torrentUrl);

        let processedCount = 0;
        let totalCount = queue.length;
        
        if (totalCount === 0) {
             alert('All selected links already fetched!');
             return;
        }

        fetchButton.disabled = true;
        
        // Process queue sequentially to prevent browser stutter
        function processNext() {
            if (queue.length === 0) {
                fetchButton.textContent = 'Fetch Selected Links';
                fetchButton.disabled = false;
                copyAllButton.disabled = false;
                return;
            }

            const item = queue.shift();
            fetchButton.textContent = `Fetching... (${processedCount}/${totalCount})`;

            // Use native fetch
            fetch(item.torrentUrl)
                .then(response => {
                    if (!response.ok) throw new Error("HTTP " + response.status);
                    return response.text();
                })
                .then(html => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    // Check for Cloudflare challenge in doc
                    if (doc.title.includes("Just a moment") || doc.title.includes("Attention Required")) {
                         console.warn(`[FetcherDebug] Cloudflare detected for ${item.torrentUrl}`);
                         item.magnetCell.textContent = 'Blocked';
                         item.magnetCell.title = "Cloudflare denied the background fetch.";
                         return; 
                    }

                    // Attempt 1: Standard
                    let magnetLink = doc.querySelector('a[href^="magnet:"]');
                    let magnetUrl = magnetLink ? magnetLink.href : null;

                    // Attempt 2: Fuzzy
                    if (!magnetUrl) {
                        const fuzzy = doc.querySelector('a[href*="magnet:"]');
                        if (fuzzy) magnetUrl = fuzzy.href;
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
                        item.magnetCell.innerHTML = '';
                        item.magnetCell.appendChild(copyLink);
                    } else {
                         item.magnetCell.textContent = 'Not Found';
                    }
                })
                .catch(err => {
                    console.error('Fetch error:', err);
                    item.magnetCell.textContent = 'Error';
                })
                .finally(() => {
                    processedCount++;
                    // Small delay to be polite
                    setTimeout(processNext, 200);
                });
        }

        processNext();
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