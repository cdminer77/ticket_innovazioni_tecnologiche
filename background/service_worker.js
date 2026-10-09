// Background Service Worker (Manifest V3) - Recorder Pro v1.1

chrome.runtime.onInstalled.addListener(() => {
  console.log("Audio & Video Recorder Pro installato con successo.");
});

// Ascolta messaggi generici o per download
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SET_REC_BADGE") {
    if (message.active) {
      chrome.action.setBadgeText({ text: "REC" });
      chrome.action.setBadgeBackgroundColor({ color: "#EC3C11" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
    sendResponse({ success: true });
  }
});
