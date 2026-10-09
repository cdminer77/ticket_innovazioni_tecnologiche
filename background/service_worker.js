// Background Service Worker (Manifest V3)
let isOffscreenCreated = false;
let currentRecordingState = {
  isRecording: false,
  type: "audio",
  startTime: null,
  durationSeconds: 0,
  transcript: ""
};

// Crea documento offscreen se non già presente
async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    isOffscreenCreated = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen/offscreen.html",
    reasons: ["USER_MEDIA", "DISPLAY_MEDIA"],
    justification: "Registrazione continua audio microfono e video dello schermo in background"
  });
  isOffscreenCreated = true;
}

async function hasOffscreenDocument() {
  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen/offscreen.html')]
    });
    return contexts.length > 0;
  }
  return isOffscreenCreated;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen') {
    // Lascia gestire all'offscreen
    return false;
  }

  switch (message.type) {
    case 'START_RECORDING_REQUEST':
      handleStartRecording(message.payload)
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case 'STOP_RECORDING_REQUEST':
      handleStopRecording()
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case 'GET_CURRENT_STATE':
      sendResponse(currentRecordingState);
      break;

    case 'TRANSCRIPT_UPDATE':
      currentRecordingState.transcript = message.text;
      break;

    case 'EXTERNAL_STOP_TRIGGERED':
      handleStopRecording().catch(console.error);
      break;

    case 'DOWNLOAD_RECORDING':
      triggerDownload(message.payload)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
  }
});

async function handleStartRecording(payload) {
  await ensureOffscreenDocument();

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'START_RECORDING',
      payload
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response && response.success) {
        currentRecordingState.isRecording = true;
        currentRecordingState.type = payload.type || "audio";
        currentRecordingState.startTime = Date.now();
        currentRecordingState.transcript = "";

        // Aggiorna Badge rosso REC
        chrome.action.setBadgeText({ text: "REC" });
        chrome.action.setBadgeBackgroundColor({ color: "#EC3C11" });

        resolve({ success: true });
      } else {
        reject(new Error(response ? response.error : "Errore sconosciuto nell'avvio della registrazione"));
      }
    });
  });
}

async function handleStopRecording() {
  if (!currentRecordingState.isRecording) {
    return { success: true, message: "Nessuna registrazione attiva." };
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'STOP_RECORDING'
    }, async (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      currentRecordingState.isRecording = false;
      currentRecordingState.startTime = null;
      chrome.action.setBadgeText({ text: "" });

      if (response && response.success) {
        const result = response.result;
        currentRecordingState.transcript = result.transcript;
        currentRecordingState.durationSeconds = result.durationSeconds;

        // Salva metadati nello storico locale
        const historyItem = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          type: result.type,
          durationSeconds: result.durationSeconds,
          transcript: result.transcript,
          blobDataUrl: result.blobDataUrl
        };

        const storageData = await chrome.storage.local.get(["recordings_history"]);
        const history = storageData.recordings_history || [];
        history.unshift(historyItem);
        // Mantieni ultime 20 registrazioni
        await chrome.storage.local.set({ recordings_history: history.slice(0, 20) });

        resolve({ success: true, result });
      } else {
        reject(new Error(response ? response.error : "Errore arresto registrazione"));
      }
    });
  });
}

async function triggerDownload({ dataUrl, filename, mimeType }) {
  if (!dataUrl) throw new Error("Dati file non disponibili per il download");
  
  await chrome.downloads.download({
    url: dataUrl,
    filename: filename || `Registrazione_${Date.now()}.${mimeType && mimeType.includes("video") ? "webm" : "webm"}`,
    saveAs: true
  });
}
