document.addEventListener('DOMContentLoaded', () => {
    const recordBtn = document.getElementById('record-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const statusText = document.getElementById('status-text');
    const statusContainer = document.getElementById('status-container');
    const recordingDot = document.querySelector('.recording-dot');
    const ghTokenInput = document.getElementById('gh-token');

    // Load saved API Token
    chrome.storage.local.get(['ghToken', 'isRecording'], (result) => {
        if (result.ghToken) {
            ghTokenInput.value = result.ghToken;
        }
        if (result.isRecording) {
            setRecordingUI(true);
        }
    });

    // Save Token on change
    ghTokenInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ ghToken: e.target.value });
    });

    // Open Dashboard
    dashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'dashboard.html' });
    });

    // Handle Record Button
    recordBtn.addEventListener('click', async () => {
        const ghToken = ghTokenInput.value.trim();
        if (!ghToken) {
            alert('Please enter your GitHub Personal Access Token first.');
            return;
        }

        chrome.storage.local.get(['isRecording'], async (result) => {
            if (result.isRecording) {
                // Stop recording (with GitHub actions, you'd typically cancel the workflow run)
                // For simplicity, we just reset the UI here. The action auto-terminates after 6h or when empty.
                chrome.storage.local.set({ isRecording: false });
                setRecordingUI(false);
            } else {
                // Start recording
                chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                    const currentTab = tabs[0];
                    if (!currentTab.url.includes('meet.google.com')) {
                        alert('Please navigate to a Google Meet tab first!');
                        return;
                    }
                    await startRecording(ghToken, currentTab.url);
                });
            }
        });
    });

    async function startRecording(ghToken, meetUrl) {
        statusText.innerText = 'Dispatching GitHub Action...';
        recordBtn.disabled = true;

        try {
            const response = await fetch(`https://api.github.com/repos/Airpyk-98/meet-recorder-extension/actions/workflows/record.yml/dispatches`, {
                method: 'POST',
                headers: { 
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `token ${ghToken}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ ref: 'main', inputs: { meet_url: meetUrl } })
            });

            if (response.ok || response.status === 204) {
                chrome.storage.local.set({ isRecording: true });
                setRecordingUI(true);
            } else {
                const data = await response.json();
                throw new Error(data.message || 'Failed to dispatch workflow');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
            setRecordingUI(false);
        } finally {
            recordBtn.disabled = false;
        }
    }

    function setRecordingUI(isRecording) {
        if (isRecording) {
            statusContainer.className = 'status recording';
            statusText.innerText = `Recording Active on GitHub...`;
            recordBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12"></rect>
                </svg>
                Reset UI
            `;
            recordBtn.classList.add('recording');
            recordingDot.classList.add('active');
        } else {
            statusContainer.className = 'status idle';
            statusText.innerText = 'Ready to Record';
            recordBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
                </svg>
                Start Recording
            `;
            recordBtn.classList.remove('recording');
            recordingDot.classList.remove('active');
        }
    }
});
