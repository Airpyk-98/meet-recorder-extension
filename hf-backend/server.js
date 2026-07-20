const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7860;

// In-memory store for active recordings
const activeRecordings = new Map();

app.post('/api/record', (req, res) => {
    const { meetUrl } = req.body;

    if (!meetUrl || !meetUrl.includes('meet.google.com')) {
        return res.status(400).json({ error: 'Valid Google Meet URL required' });
    }

    const meetingId = meetUrl.split('.com/')[1]?.split('?')[0];
    if (!meetingId) {
        return res.status(400).json({ error: 'Could not extract Meeting ID' });
    }

    if (activeRecordings.has(meetingId)) {
        return res.status(400).json({ error: 'Already recording this meeting' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(__dirname, 'recordings', `${timestamp}_${meetingId}`);
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Starting recorder for ${meetUrl}`);

    // Spawn the puppeteer script as a child process
    const recorderProcess = spawn('node', ['recorder.js', meetUrl, outputDir]);

    activeRecordings.set(meetingId, recorderProcess);

    recorderProcess.stdout.on('data', (data) => {
        console.log(`[Recorder ${meetingId}]: ${data}`);
    });

    recorderProcess.stderr.on('data', (data) => {
        console.error(`[Recorder Error ${meetingId}]: ${data}`);
    });

    recorderProcess.on('close', (code) => {
        console.log(`Recorder process for ${meetingId} exited with code ${code}`);
        activeRecordings.delete(meetingId);
        // After recording process finishes, we would trigger HF Dataset upload
        uploadToHuggingFace(outputDir, meetingId);
    });

    res.json({ message: 'Recording started', meetingId });
});

app.post('/api/stop', (req, res) => {
    const { meetingId } = req.body;
    const process = activeRecordings.get(meetingId);
    
    if (process) {
        process.kill();
        activeRecordings.delete(meetingId);
        res.json({ message: 'Recording stopped manually' });
    } else {
        res.status(404).json({ error: 'Recording not found' });
    }
});

app.get('/', (req, res) => {
    res.send('Google Meet Recorder Backend is running.');
});

async function uploadToHuggingFace(outputDir, meetingId) {
    console.log(`Triggering upload for ${outputDir} to Hugging Face Datasets...`);
    // This will use the @huggingface/hub library in a separate script or function
    // to upload the .webm and .txt files.
    const uploaderProcess = spawn('node', ['upload.js', outputDir, meetingId]);
    uploaderProcess.stdout.on('data', (data) => console.log(`[Upload]: ${data}`));
    uploaderProcess.stderr.on('data', (data) => console.error(`[Upload Error]: ${data}`));
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});
