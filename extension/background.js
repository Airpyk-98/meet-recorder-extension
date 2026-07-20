// Service Worker Background Script
// Keeps the extension alive and handles installation events

chrome.runtime.onInstalled.addListener(() => {
    console.log("MeetRecorder AI Extension Installed.");
});
