document.addEventListener('DOMContentLoaded', () => {
    const recordBtn = document.getElementById('record-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const statusText = document.getElementById('status-text');
    const statusContainer = document.getElementById('status-container');
    const recordingDot = document.querySelector('.recording-dot');
    const hfUrlInput = document.getElementById('hf-url');

    // Load saved API URL
    chrome.storage.local.get(['hfSpaceUrl', 'isRecording', 'currentMeetingId'], (result) => {
        if (result.hfSpaceUrl) {
            hfUrlInput.value = result.hfSpaceUrl;
        }
        if (result.isRecording) {
            setRecordingUI(true, result.currentMeetingId);
        }
    });

    // Save API URL on change
    hfUrlInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ hfSpaceUrl: e.target.value });
    });

    // Open Dashboard
    dashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'dashboard.html' });
    });

    // Handle Record Button
    recordBtn.addEventListener('click', async () => {
        const apiUrl = hfUrlInput.value.trim();
        if (!apiUrl) {
            alert('Please enter your Hugging Face Space URL first.');
            return;
        }

        chrome.storage.local.get(['isRecording', 'currentMeetingId'], async (result) => {
            if (result.isRecording) {
                // Stop recording
                await stopRecording(apiUrl, result.currentMeetingId);
            } else {
                // Start recording
                chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                    const currentTab = tabs[0];
                    if (!currentTab.url.includes('meet.google.com')) {
                        alert('Please navigate to a Google Meet tab first!');
                        return;
                    }
                    await startRecording(apiUrl, currentTab.url);
                });
            }
        });
    });

    async function startRecording(apiUrl, meetUrl) {
        statusText.innerText = 'Connecting to Cloud Bot...';
        recordBtn.disabled = true;

        try {
            const response = await fetch(`${apiUrl}/api/record`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meetUrl })
            });

            const data = await response.json();

            if (response.ok) {
                chrome.storage.local.set({ 
                    isRecording: true, 
                    currentMeetingId: data.meetingId 
                });
                setRecordingUI(true, data.meetingId);
            } else {
                throw new Error(data.error || 'Failed to start recording');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
            setRecordingUI(false);
        } finally {
            recordBtn.disabled = false;
        }
    }

    async function stopRecording(apiUrl, meetingId) {
        statusText.innerText = 'Stopping Bot...';
        recordBtn.disabled = true;

        try {
            const response = await fetch(`${apiUrl}/api/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meetingId })
            });

            if (response.ok) {
                chrome.storage.local.set({ isRecording: false, currentMeetingId: null });
                setRecordingUI(false);
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to stop recording');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            recordBtn.disabled = false;
        }
    }

    function setRecordingUI(isRecording, meetingId = '') {
        if (isRecording) {
            statusContainer.className = 'status recording';
            statusText.innerText = `Recording Meet ID: ${meetingId}`;
            recordBtn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12"></rect>
                </svg>
                Stop Recording
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
