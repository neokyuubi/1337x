// ==UserScript==
// @name         1337x Magnet Link Fetcher
// @version      1.1
// @description  Adds checkboxes and magnet link extraction functionality to 1337x.to search results
// @author       neokyuubi
// @match        *://1337x.to/search/*
// @match        *://www.1337x.to/search/*
// @namespace    https://github.com/neokyuubi/1337x-Magnet-Link-Fetcher
// @icon         https://1337x.to/favicon.ico
// @description  <h1>1337x Magnet Link Fetcher</h1>
// <h2>Overview</h2>
// <p>This userscript enhances the functionality of the <a href="https://1337x.to">1337x.to</a> torrent site by adding checkboxes and a feature to extract magnet links directly from the search results. It simplifies the process of managing and downloading torrents by allowing users to select multiple torrents and fetch or copy their magnet links with ease.</p>
// <h2>Features</h2>
// <ul>
//   <li><strong>Checkbox Selection</strong>: Users can select multiple torrents using checkboxes.</li>
//   <li><strong>Shift-Click Selection</strong>: Allows range selection of checkboxes using the Shift key.</li>
//   <li><strong>Fetch Magnet Links</strong>: Retrieves magnet links for selected torrents.</li>
//   <li><strong>Copy Magnet Links</strong>: Allows copying of all fetched magnet links with a single click.</li>
//   <li><strong>Dynamic UI Updates</strong>: Provides real-time feedback on the status of magnet link fetching and copying.</li>
// </ul>
// <h2>Installation</h2>
// <ol>
//   <li>Install Tampermonkey or a similar userscript manager in your browser.</li>
//   <li>Create a new userscript and copy the contents of <code>index.js</code> into the script editor.</li>
//   <li>Save the script and ensure it's enabled.</li>
//   <li>Navigate to <a href="https://1337x.to">1337x.to</a> and the script will automatically enhance the search results page.</li>
// </ol>
// <h2>Usage</h2>
// <ul>
//   <li>Perform a search on <a href="https://1337x.to">1337x.to</a>.</li>
//   <li>Use the checkboxes to select the torrents for which you want to fetch or copy magnet links.</li>
//   <li>Click the "Fetch Selected Links" button to retrieve the magnet links.</li>
//   <li>Once fetched, click "Copy All Links" to copy the desired magnet links to the clipboard.</li>
// </ul>
// <h2>Preview</h2>
// <p>Below is a preview of the userscript in action:</p>
// <img src="https://raw.githubusercontent.com/neokyuubi/1337x/main/preview.jpg" alt="Preview">
// <h2>Contributing</h2>
// <p>Contributions to this project are welcome. Please fork the repository and submit a pull request with your enhancements.</p>
// <h2>License</h2>
// <p>This project is licensed under the MIT License - see the LICENSE file for details.</p>
// <h2>Acknowledgments</h2>
// <ul>
//   <li>Thanks to the developers of Tampermonkey for providing the platform to run userscripts.</li>
//   <li>This script is developed for educational purposes and personal use. Please respect copyright laws and the terms of service of 1337x.to.</li>
// </ul>
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==


(function() {
    'use strict';

    // Only run on search pages
    if (!window.location.href.includes('/search/') && !window.location.href.includes('/category/') && !window.location.href.includes('/popular/') && !window.location.href.includes('/top-100')) {
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
    const table = document.querySelector('.table-list') || document.querySelector('table.table-list');
    if (!table) return;

    // Add header columns for checkbox and magnet
    const headerRow = table.querySelector('thead tr');
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
        magnetCell.dataset.torrentUrl = row.querySelector('a[href^="/torrent/"]').href;
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

    // Function to fetch magnet links for selected torrents
    function fetchSelectedMagnetLinks() {
        const checkedRows = document.querySelectorAll('.checkbox-column input[type="checkbox"]:checked');
        if (checkedRows.length === 0) {
            alert('No torrents selected! Please select at least one torrent.');
            return;
        }

        let completedRequests = 0;
        let totalRequests = checkedRows.length;

        fetchButton.disabled = true;
        fetchButton.textContent = `Fetching... (0/${totalRequests})`;

        checkedRows.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const magnetCell = row.querySelector('.magnet-column');
            const torrentUrl = magnetCell.dataset.torrentUrl;

            // Skip if we already fetched this link
            if (magnetCell.innerHTML !== '') {
                completedRequests++;
                updateFetchButtonStatus(completedRequests, totalRequests);
                return;
            }

            // Fetch the torrent page
            GM_xmlhttpRequest({
                method: 'GET',
                url: torrentUrl,
                onload: function(response) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');

                    // Extract magnet link
                    const magnetLink = doc.querySelector('a[href^="magnet:"]');
                    if (magnetLink) {
                        const magnetUrl = magnetLink.href;

                        // Create copy button for the magnet link
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
                    } else {
                        magnetCell.textContent = 'Not found';
                    }

                    completedRequests++;
                    updateFetchButtonStatus(completedRequests, totalRequests);
                },
                onerror: function() {
                    magnetCell.textContent = 'Error';
                    completedRequests++;
                    updateFetchButtonStatus(completedRequests, totalRequests);
                }
            });
        });
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