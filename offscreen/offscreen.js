// Offscreen Media & Speech Engine (Manifest V3)
let mediaRecorder = null;
let recordedChunks = [];
let mediaStream = null;
let audioContext = null;
let speechRecognizer = null;
let isRecording = false;
let startTime = null;
let fullTranscript = [];
let currentInterimText = "";
let recordingType = "audio"; // 'audio' | 'video'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  switch (message.type) {
    case 'START_RECORDING':
      startRecording(message.payload)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // Risposta asincrona

    case 'STOP_RECORDING':
      stopRecording()
        .then((result) => sendResponse({ success: true, result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case 'GET_STATUS':
      sendResponse({
        isRecording,
        recordingType,
        elapsedSeconds: isRecording && startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
        transcript: fullTranscript.join("\n") + (currentInterimText ? `\n... ${currentInterimText}` : "")
      });
      break;
  }
});

async function startRecording({ type = "audio", enableSpeech = true, lang = "it-IT" }) {
  if (isRecording) {
    throw new Error("Una registrazione è già in corso.");
  }

  recordingType = type;
  recordedChunks = [];
  fullTranscript = [];
  currentInterimText = "";
  startTime = Date.now();

  try {
    if (type === "video") {
      // Cattura Schermo / Finestra con Audio di Sistema
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true
      });

      // Tentativo di catturare anche il microfono per mixare voce operatore + audio PC
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new AudioContext();
        const dest = audioContext.createMediaStreamDestination();

        if (displayStream.getAudioTracks().length > 0) {
          const sysSource = audioContext.createMediaStreamSource(displayStream);
          sysSource.connect(dest);
        }
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(dest);

        // Combina video dello schermo con audio mixato
        const combinedTracks = [
          ...displayStream.getVideoTracks(),
          ...dest.stream.getAudioTracks()
        ];
        mediaStream = new MediaStream(combinedTracks);
      } catch (e) {
        console.warn("Impossibile acquisire microfono contemporaneamente, uso solo audio di sistema:", e);
        mediaStream = displayStream;
      }
    } else {
      // Cattura solo Microfono
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    }

    // Se l'utente interrompe la condivisione dello schermo dalla barra di sistema del browser
    mediaStream.getVideoTracks().forEach(track => {
      track.onended = () => {
        chrome.runtime.sendMessage({ type: "EXTERNAL_STOP_TRIGGERED" });
      };
    });

    const mimeType = type === "video"
      ? (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm")
      : (MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm");

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.start(1000); // Raccoglie dati ogni 1 secondo
    isRecording = true;

    // Avvio riconoscimento vocale live (Web Speech API)
    if (enableSpeech) {
      initSpeechRecognition(lang);
    }

    return true;
  } catch (error) {
    cleanupStreams();
    throw error;
  }
}

function initSpeechRecognition(lang = "it-IT") {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Web Speech API non supportata in questo browser.");
    return;
  }

  speechRecognizer = new SpeechRecognition();
  speechRecognizer.continuous = true;
  speechRecognizer.interimResults = true;
  speechRecognizer.lang = lang;

  speechRecognizer.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcriptPiece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        const min = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const sec = String(elapsedSec % 60).padStart(2, '0');
        fullTranscript.push(`[${min}:${sec}] ${transcriptPiece.trim()}`);
        currentInterimText = "";

        // Notifica il popup in tempo reale
        chrome.runtime.sendMessage({
          type: "TRANSCRIPT_UPDATE",
          text: fullTranscript.join("\n")
        });
      } else {
        interim += transcriptPiece;
      }
    }
    currentInterimText = interim;
  };

  speechRecognizer.onerror = (event) => {
    console.warn("Errore SpeechRecognition:", event.error);
  };

  speechRecognizer.onend = () => {
    // Se stiamo ancora registrando, riavviamo l'ascolto per mantenerlo continuo
    if (isRecording && speechRecognizer) {
      try {
        speechRecognizer.start();
      } catch (e) {
        // Ignora se già attivo
      }
    }
  };

  try {
    speechRecognizer.start();
  } catch (e) {
    console.warn("Impossibile avviare speechRecognizer:", e);
  }
}

function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      cleanupStreams();
      resolve({
        transcript: fullTranscript.join("\n"),
        durationSeconds: 0,
        blobDataUrl: null,
        type: recordingType
      });
      return;
    }

    isRecording = false;

    if (speechRecognizer) {
      try {
        speechRecognizer.stop();
        speechRecognizer = null;
      } catch (e) {}
    }

    mediaRecorder.onstop = () => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const mimeType = mediaRecorder.mimeType || (recordingType === "video" ? "video/webm" : "audio/webm");
      const blob = new Blob(recordedChunks, { type: mimeType });

      // Converti Blob in Data URL per passarlo al background/download
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        cleanupStreams();
        resolve({
          transcript: fullTranscript.join("\n"),
          durationSeconds: elapsedSeconds,
          blobDataUrl: dataUrl,
          mimeType,
          type: recordingType
        });
      };
      reader.onerror = (err) => {
        cleanupStreams();
        reject(err);
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorder.stop();
  });
}

function cleanupStreams() {
  isRecording = false;
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }
  mediaRecorder = null;
  recordedChunks = [];
}
