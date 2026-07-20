document.addEventListener('DOMContentLoaded', () => {
    const tokenInput = document.getElementById('hf-token');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error-msg');
    const errorText = document.getElementById('error-text');
    const datasetGrid = document.getElementById('dataset-grid');

    const REPO_ID = 'EPIC98/meet-recordings'; // Default as requested

    // Load saved token
    chrome.storage.local.get(['hfToken'], (result) => {
        if (result.hfToken) {
            tokenInput.value = result.hfToken;
            fetchRecordings(result.hfToken);
        }
    });

    // Save token and refetch on change
    tokenInput.addEventListener('change', (e) => {
        const token = e.target.value.trim();
        chrome.storage.local.set({ hfToken: token });
        if (token) fetchRecordings(token);
    });

    async function fetchRecordings(token) {
        datasetGrid.innerHTML = '';
        errorDiv.style.display = 'none';
        loadingDiv.style.display = 'block';

        try {
            // Use HF Hub REST API to list files in the dataset
            const url = `https://huggingface.co/api/datasets/${REPO_ID}/tree/main`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) throw new Error('Invalid Hugging Face Token.');
                if (response.status === 404) throw new Error('Dataset repository not found. Please ensure it exists.');
                throw new Error('Failed to fetch dataset.');
            }

            const files = await response.json();
            
            // Group files by folder (Meeting)
            const meetings = {};
            files.forEach(file => {
                const parts = file.path.split('/');
                if (parts.length > 1) {
                    const folder = parts[0];
                    if (!meetings[folder]) meetings[folder] = [];
                    meetings[folder].push(file);
                }
            });

            renderMeetings(meetings);

        } catch (error) {
            errorText.innerText = error.message;
            errorDiv.style.display = 'block';
        } finally {
            loadingDiv.style.display = 'none';
        }
    }

    function renderMeetings(meetings) {
        if (Object.keys(meetings).length === 0) {
            datasetGrid.innerHTML = `<div style="text-align: center; grid-column: 1/-1; color: #94a3b8;">No recordings found in dataset.</div>`;
            return;
        }

        for (const [folderName, files] of Object.entries(meetings)) {
            const card = document.createElement('div');
            card.className = 'record-card';

            const videoFile = files.find(f => f.path.endsWith('.webm'));
            const txtFile = files.find(f => f.path.endsWith('.txt'));

            // Parse Date and ID from folder name (e.g. 2023-10-25_abc-defg-hij)
            const parts = folderName.split('_');
            const dateStr = parts[0] || 'Unknown Date';
            const meetId = parts[1] || 'Unknown ID';

            let downloadLinks = '';
            
            if (videoFile) {
                const downloadUrl = `https://huggingface.co/datasets/${REPO_ID}/resolve/main/${videoFile.path}`;
                downloadLinks += `<a href="${downloadUrl}" target="_blank" class="download-btn">🎥 Video</a>`;
            }
            if (txtFile) {
                const downloadUrl = `https://huggingface.co/datasets/${REPO_ID}/resolve/main/${txtFile.path}`;
                downloadLinks += `<a href="${downloadUrl}" target="_blank" class="download-btn">📝 Transcript</a>`;
            }

            card.innerHTML = `
                <div class="record-title">Meeting: ${meetId}</div>
                <div class="record-date">${dateStr}</div>
                <div class="record-actions">
                    ${downloadLinks}
                </div>
            `;
            
            datasetGrid.appendChild(card);
        }
    }
});
