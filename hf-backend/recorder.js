const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { getStream, launch } = require('puppeteer-stream');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const meetUrl = process.argv[2];
const outputDir = process.argv[3];

if (!meetUrl || !outputDir) {
    console.error('Missing arguments. Usage: node recorder.js <meetUrl> <outputDir>');
    process.exit(1);
}

const outputFile = path.join(outputDir, 'video.webm');
const fileStream = fs.createWriteStream(outputFile);

async function startRecording() {
    console.log('Launching browser...');
    const browser = await launch(puppeteer, {
        headless: "new",
        executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--use-fake-ui-for-media-stream', // Auto-accept camera/mic permissions
            '--use-fake-device-for-media-stream',
            '--disable-web-security',
            '--mute-audio' // Mute audio locally so it doesn't echo, but puppeteer-stream still captures it
        ],
        defaultViewport: {
            width: 1280,
            height: 720
        }
    });

    const page = await browser.newPage();
    
    // Set a normal user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');

    console.log(`Navigating to ${meetUrl}...`);
    await page.goto(meetUrl, { waitUntil: 'networkidle2' });

    // Wait for the "What's your name?" input field for Guest joining
    console.log('Waiting for guest name input...');
    try {
        await page.waitForSelector('input[type="text"]', { timeout: 15000 });
        await page.type('input[type="text"]', 'Recording Bot');
        
        // Wait for and click the "Ask to join" button
        const joinButtonSelectors = [
            'button:contains("Ask to join")',
            'span:contains("Ask to join")',
            'div[role="button"]:contains("Ask to join")'
        ];
        
        // Custom evaluation since :contains isn't native CSS
        await page.evaluate(() => {
            const spans = Array.from(document.querySelectorAll('span'));
            const joinSpan = spans.find(span => span.textContent.includes('Ask to join'));
            if (joinSpan) {
                joinSpan.click();
            }
        });
        console.log('Clicked "Ask to join". Waiting for host to admit...');
    } catch (e) {
        console.log('Could not find guest join fields. Perhaps meeting requires login or is open.');
    }

    // Wait until the meeting interface loads (indicating we are in)
    try {
        // Wait for the end call button which indicates we are fully in the meeting
        await page.waitForSelector('button[aria-label="Leave call"]', { timeout: 120000 }); // Wait up to 2 mins for admit
        console.log('Successfully joined the meeting!');
    } catch (e) {
        console.error('Timeout waiting to be admitted to the meeting.');
        await browser.close();
        process.exit(1);
    }

    // Start capturing the stream
    console.log('Starting stream capture...');
    const stream = await getStream(page, { audio: true, video: true });
    stream.pipe(fileStream);

    console.log('Recording in progress...');

    // Monitoring Participant Count logic
    let aloneTimer = null;
    const ALONE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

    const checkParticipants = setInterval(async () => {
        try {
            const count = await page.evaluate(() => {
                const element = document.querySelector('.uGOf1d'); // Typically the participant count class, but varies
                // Fallback approach: count video elements or look at aria-labels
                if (element) return parseInt(element.textContent, 10);
                
                // Another common selector for people count in Google Meet
                const peopleIcon = document.querySelector('button[aria-label="Show everyone"]');
                if (peopleIcon) {
                    const match = peopleIcon.ariaLabel.match(/(\d+)/);
                    if (match) return parseInt(match[1], 10);
                }
                return null; // Unknown
            });

            if (count !== null) {
                if (count === 1) {
                    if (!aloneTimer) {
                        console.log(`Participant count is 1. Starting 10-minute timeout...`);
                        aloneTimer = setTimeout(async () => {
                            console.log('Bot has been alone for 10 minutes. Leaving call.');
                            clearInterval(checkParticipants);
                            await stream.destroy();
                            await browser.close();
                            process.exit(0);
                        }, ALONE_TIMEOUT_MS);
                    }
                } else {
                    if (aloneTimer) {
                        console.log(`Participant count is ${count}. Canceling timeout.`);
                        clearTimeout(aloneTimer);
                        aloneTimer = null;
                    }
                }
            }
        } catch (e) {
            console.error('Error checking participants:', e.message);
        }
    }, 10000); // Check every 10 seconds

    // Keep the process alive
    process.on('SIGINT', async () => {
        console.log('SIGINT received, stopping recording...');
        clearInterval(checkParticipants);
        await stream.destroy();
        await browser.close();
        process.exit(0);
    });
}

startRecording().catch(err => {
    console.error('Recording failed:', err);
    process.exit(1);
});
