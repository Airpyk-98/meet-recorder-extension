const { uploadFile } = require('@huggingface/hub');
const fs = require('fs');
const path = require('path');

const outputDir = process.argv[2];
const meetingId = process.argv[3];

if (!outputDir || !meetingId) {
    console.error('Usage: node upload.js <outputDir> <meetingId>');
    process.exit(1);
}

const HF_TOKEN = process.env.HF_TOKEN; // We'll assume the user configures their EPIC98 token here
const REPO_ID = process.env.HF_DATASET_REPO || 'EPIC98/meet-recordings';

async function upload() {
    if (!HF_TOKEN) {
        console.error('Error: HF_TOKEN environment variable is not set. Skipping upload.');
        process.exit(1);
    }

    const videoPath = path.join(outputDir, 'video.webm');
    if (!fs.existsSync(videoPath)) {
        console.error('Error: Video file not found at', videoPath);
        process.exit(1);
    }

    console.log(`Uploading ${videoPath} to ${REPO_ID}...`);
    
    // In a real scenario, we might also run Whisper here to generate a transcript before uploading.
    // For now, we upload the raw video.

    const dateStr = new Date().toISOString().split('T')[0];
    const remotePath = `${dateStr}_${meetingId}/video.webm`;

    try {
        await uploadFile({
            repo: { type: 'dataset', name: REPO_ID },
            credentials: { accessToken: HF_TOKEN },
            file: {
                path: remotePath,
                content: new Blob([fs.readFileSync(videoPath)])
            }
        });
        console.log(`Successfully uploaded to dataset at ${remotePath}`);
        
        // Clean up local file after successful upload to save space
        fs.unlinkSync(videoPath);
        fs.rmdirSync(outputDir, { recursive: true });
    } catch (err) {
        console.error('Upload failed:', err);
    }
}

upload();
