// Logica Popup - Recorder Pro v1.1
let mediaRecorder = null;
let mediaStream = null;
let audioContext = null;
let recordedChunks = [];
let speechRecognizer = null;
let isRecording = false;
let recordStartTime = null;
let timerInterval = null;
let fullTranscript = [];
let currentRecordedData = null; // Memorizza dati ultima registrazione per download e anteprima

document.addEventListener("DOMContentLoaded", () => {
  initModeSelector();
  initPopoutButton();
  initActionButtons();
  initResultsButtons();
  initHistorySection();

  // Ripristina preferenza formato
  chrome.storage.local.get(["preferred_format"], (res) => {
    if (res && res.preferred_format) {
      document.getElementById("format-select").value = res.preferred_format;
    }
  });

  document.getElementById("format-select").addEventListener("change", (e) => {
    chrome.storage.local.set({ preferred_format: e.target.value });
  });
});

// Apre l'estensione in una finestra popup fluttuante dedicata per evitare chiusure accidentali
function initPopoutButton() {
  const btn = document.getElementById("btn-popout");
  if (!btn) return;

  // Se siamo già in una finestra separata, nascondi il bottone popout
  if (window.location.search.includes("window=true")) {
    btn.style.display = "none";
    return;
  }

  btn.addEventListener("click", () => {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup/popup.html?window=true"),
      type: "popup",
      width: 425,
      height: 640,
      focused: true
    });
    window.close(); // Chiude il popup a scomparsa
  });
}

function initModeSelector() {
  const modeCards = document.querySelectorAll(".mode-card");
  modeCards.forEach((card) => {
    card.addEventListener("click", () => {
      modeCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });
}

function initActionButtons() {
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");

  // AVVIO REGISTRAZIONE (Eseguito DIRETTAMENTE nel contesto del click per evitare blocchi permessi)
  btnStart.addEventListener("click", async () => {
    const selectedMode = document.querySelector('input[name="recording-mode"]:checked').value;
    const formatChoice = document.getElementById("format-select").value;

    btnStart.disabled = true;
    btnStart.innerHTML = `<span>⏳</span><span>Preparazione dispositivi...</span>`;

    try {
      await startLiveRecording(selectedMode, formatChoice);
      setRecordingUI(true, selectedMode);
    } catch (err) {
      console.error("Errore durante avvio registrazione:", err);
      let errorMsg = err.message || err.name;
      if (err.name === "NotAllowedError" || errorMsg.includes("Permission denied")) {
        errorMsg = "Permesso di condivisione o microfono annullato o negato nel browser.";
      }
      alert("Impossibile avviare registrazione:\n" + errorMsg);
      setRecordingUI(false);
    } finally {
      btnStart.disabled = false;
      btnStart.innerHTML = `<span class="btn-icon">🔴</span><span>Avvia Registrazione</span>`;
    }
  });

  // ARRESTO E SALVATAGGIO
  btnStop.addEventListener("click", async () => {
    btnStop.disabled = true;
    btnStop.innerHTML = `<span>⏳</span><span>Salvataggio e codifica file...</span>`;

    try {
      await stopLiveRecording();
    } catch (err) {
      console.error("Errore arresto registrazione:", err);
      alert("Errore durante l'elaborazione del file: " + err.message);
    } finally {
      btnStop.disabled = false;
      btnStop.innerHTML = `<span class="btn-icon">⏹️</span><span>Termina & Salva Registrazione</span>`;
      setRecordingUI(false);
    }
  });
}

/**
 * Avvia la registrazione audio/video direttamente in risposta al click
 * Questo garantisce che Chrome NON neghi mai il consenso tra una registrazione e l'altra!
 */
async function startLiveRecording(mode, formatChoice) {
  // Pulisci eventuali stream pendenti
  cleanupStreams();

  recordedChunks = [];
  fullTranscript = [];
  recordStartTime = Date.now();
  currentRecordedData = null;

  // 1. Acquisizione Stream
  if (mode === "video") {
    // Cattura Schermo / Finestra con Audio di Sistema
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: true
    });

    // Prova ad aggiungere il microfono per avere sia l'audio PC sia la voce dell'operatore
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioContext.createMediaStreamDestination();

      if (displayStream.getAudioTracks().length > 0) {
        const sysSource = audioContext.createMediaStreamSource(displayStream);
        sysSource.connect(dest);
      }
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(dest);

      const combinedTracks = [
        ...displayStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ];
      mediaStream = new MediaStream(combinedTracks);
    } catch (e) {
      console.warn("Microfono non aggiunto allo stream video, uso solo audio schermo:", e);
      mediaStream = displayStream;
    }

    // Se l'utente preme "Interrompi condivisione" dalla barra blu di sistema di Chrome
    mediaStream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        if (isRecording) {
          document.getElementById("btn-stop").click();
        }
      };
    });
  } else {
    // Solo Audio Microfono
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  }

  // 2. Selezione MIME type ottimale per massima compatibilità (VLC / Windows Media Player)
  let selectedMimeType = "";
  let finalExtension = "webm";

  if (mode === "video") {
    if (formatChoice === "mp4" && MediaRecorder.isTypeSupported("video/mp4")) {
      selectedMimeType = "video/mp4";
      finalExtension = "mp4";
    } else if (formatChoice === "mp4" && MediaRecorder.isTypeSupported("video/mp4;codecs=avc1,mp4a.40.2")) {
      selectedMimeType = "video/mp4;codecs=avc1,mp4a.40.2";
      finalExtension = "mp4";
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
      selectedMimeType = "video/webm;codecs=vp8,opus";
      finalExtension = "webm";
    } else {
      selectedMimeType = "video/webm";
      finalExtension = "webm";
    }
  } else {
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      selectedMimeType = "audio/webm;codecs=opus";
      finalExtension = "webm";
    } else {
      selectedMimeType = "audio/webm";
      finalExtension = "webm";
    }
  }

  mediaRecorder = new MediaRecorder(mediaStream, { mimeType: selectedMimeType });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.start(1000); // Raccoglie dati a intervalli di 1 secondo
  isRecording = true;

  // 3. Avvia Riconoscimento Vocale Live (Speech-to-Text in Italiano)
  startSpeechRecognition();

  // Notifica Service Worker per impostare il Badge "REC"
  chrome.action.setBadgeText({ text: "REC" });
  chrome.action.setBadgeBackgroundColor({ color: "#EC3C11" });

  // Salva stato corrente per download
  currentRecordedData = {
    type: mode,
    extension: finalExtension,
    mimeType: selectedMimeType
  };
}

/**
 * Ferma la registrazione e genera il file finale corretto
 */
function stopLiveRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      cleanupStreams();
      resolve();
      return;
    }

    isRecording = false;

    // Ferma riconoscimento vocale
    if (speechRecognizer) {
      try {
        speechRecognizer.stop();
        speechRecognizer = null;
      } catch (e) {}
    }

    mediaRecorder.onstop = async () => {
      const elapsedMs = Date.now() - recordStartTime;
      const durationSec = Math.max(1, Math.floor(elapsedMs / 1000));
      const mimeType = mediaRecorder.mimeType || "video/webm";

      let rawBlob = new Blob(recordedChunks, { type: mimeType });

      // Se è un file WebM, inietta la durata EBML così che VLC e Media Player mostrino la durata esatta e il seek
      let finalBlob = rawBlob;
      if (mimeType.includes("webm") && typeof fixWebmDuration === "function") {
        try {
          finalBlob = await fixWebmDuration(rawBlob, elapsedMs);
        } catch (err) {
          console.warn("Errore fix durata WebM:", err);
        }
      }

      const blobUrl = URL.createObjectURL(finalBlob);

      // Converti in Data URL per download sicuro tramite chrome.downloads
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result;

        currentRecordedData = {
          ...currentRecordedData,
          blobUrl,
          dataUrl,
          durationSeconds: durationSec,
          transcript: fullTranscript.join("\n"),
          timestamp: new Date().toISOString()
        };

        // Mostra Risultati e Anteprima
        showResults(currentRecordedData);

        // Salva nello storico
        await saveToHistory(currentRecordedData);

        cleanupStreams();
        chrome.action.setBadgeText({ text: "" });
        resolve();
      };
      reader.readAsDataURL(finalBlob);
    };

    mediaRecorder.stop();
  });
}

function cleanupStreams() {
  isRecording = false;
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
    audioContext = null;
  }
  mediaRecorder = null;
  recordedChunks = [];
}

/**
 * Riconoscimento Vocale Nativo del Browser (Web Speech API)
 */
function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Web Speech API non disponibile nel browser.");
    return;
  }

  speechRecognizer = new SpeechRecognition();
  speechRecognizer.continuous = true;
  speechRecognizer.interimResults = true;
  speechRecognizer.lang = "it-IT";

  speechRecognizer.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        const elapsedSec = Math.floor((Date.now() - recordStartTime) / 1000);
        const min = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
        const sec = String(elapsedSec % 60).padStart(2, "0");
        fullTranscript.push(`[${min}:${sec}] ${piece.trim()}`);
        updateTranscriptBox(fullTranscript.join("\n"));
      } else {
        interim += piece;
      }
    }
    if (interim) {
      updateTranscriptBox(fullTranscript.join("\n") + (fullTranscript.length > 0 ? "\n" : "") + `... ${interim}`);
    }
  };

  speechRecognizer.onerror = (event) => {
    console.warn("SpeechRecognition notice:", event.error);
  };

  speechRecognizer.onend = () => {
    if (isRecording && speechRecognizer) {
      try {
        speechRecognizer.start();
      } catch (e) {}
    }
  };

  try {
    speechRecognizer.start();
  } catch (e) {
    console.warn("SpeechRecognition avvio fallito:", e);
  }
}

function setRecordingUI(recording, mode = "audio") {
  const statusCard = document.getElementById("status-card");
  const statusLabel = document.getElementById("status-label");
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");
  const modeSelector = document.getElementById("mode-selector");
  const formatSelect = document.getElementById("format-select");

  if (recording) {
    statusCard.classList.add("recording");
    statusLabel.innerText = mode === "video" ? "Registrazione Schermo in corso..." : "Registrazione Vocale in corso...";
    btnStart.classList.add("hidden");
    btnStop.classList.remove("hidden");
    modeSelector.style.opacity = "0.5";
    modeSelector.style.pointerEvents = "none";
    formatSelect.disabled = true;

    document.getElementById("results-panel").classList.remove("hidden");
    startTimer(recordStartTime || Date.now());
  } else {
    statusCard.classList.remove("recording");
    statusLabel.innerText = "Pronto per registrare";
    btnStart.classList.remove("hidden");
    btnStop.classList.add("hidden");
    modeSelector.style.opacity = "1";
    modeSelector.style.pointerEvents = "auto";
    formatSelect.disabled = false;

    stopTimer();
  }
}

function startTimer(startTime) {
  stopTimer();
  const timerDisplay = document.getElementById("timer-display");

  const update = () => {
    const elapsedMs = Date.now() - startTime;
    const totalSec = Math.floor(elapsedMs / 1000);
    const hrs = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const min = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const sec = String(totalSec % 60).padStart(2, "0");
    timerDisplay.innerText = `${hrs}:${min}:${sec}`;
  };

  update();
  timerInterval = setInterval(update, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  document.getElementById("timer-display").innerText = "00:00:00";
}

function updateTranscriptBox(text) {
  const box = document.getElementById("transcript-box");
  box.innerText = text || "(In ascolto della voce...)";
  box.scrollTop = box.scrollHeight;
}

function showResults(data) {
  const resultsPanel = document.getElementById("results-panel");
  resultsPanel.classList.remove("hidden");

  // Aggiorna player di anteprima immediata
  const player = document.getElementById("preview-player");
  if (data.blobUrl) {
    player.src = data.blobUrl;
    player.style.display = "block";
    player.load();
  }

  const mediaLabel = document.getElementById("download-media-label");
  const ext = data.extension || "webm";
  mediaLabel.innerText = data.type === "video" ? `Scarica Video (.${ext})` : `Scarica Audio (.${ext})`;

  updateTranscriptBox(data.transcript || "(Nessuna frase parlata rilevata)");
}

function initResultsButtons() {
  // Copia Testo
  const btnCopy = document.getElementById("btn-copy-transcript");
  btnCopy.addEventListener("click", () => {
    const text = document.getElementById("transcript-box").innerText;
    if (!text || text.startsWith("(")) {
      alert("Nessun testo da copiare.");
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      const orig = btnCopy.innerHTML;
      btnCopy.innerText = "✓ Copiato!";
      setTimeout(() => { btnCopy.innerHTML = orig; }, 1800);
    });
  });

  // Scarica Media Registrato
  document.getElementById("btn-download-media").addEventListener("click", () => {
    if (!currentRecordedData || (!currentRecordedData.dataUrl && !currentRecordedData.blobUrl)) {
      alert("Nessun file multimediale disponibile.");
      return;
    }

    const ext = currentRecordedData.extension || "webm";
    const filename = `Registrazione_${currentRecordedData.type === "video" ? "Video" : "Audio"}_${formatFileDate(new Date())}.${ext}`;

    chrome.downloads.download({
      url: currentRecordedData.dataUrl || currentRecordedData.blobUrl,
      filename,
      saveAs: true
    });
  });

  // Scarica Testo Trascritto
  document.getElementById("btn-download-txt").addEventListener("click", () => {
    const text = document.getElementById("transcript-box").innerText;
    if (!text || text.startsWith("(")) {
      alert("Nessun testo da salvare.");
      return;
    }

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const reader = new FileReader();
    reader.onloadend = () => {
      const filename = `Trascrizione_${formatFileDate(new Date())}.txt`;
      chrome.downloads.download({
        url: reader.result,
        filename,
        saveAs: true
      });
    };
    reader.readAsDataURL(blob);
  });
}

function formatFileDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hr = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}${m}${day}_${hr}${min}`;
}

async function saveToHistory(item) {
  const historyItem = {
    id: Date.now(),
    timestamp: item.timestamp,
    type: item.type,
    extension: item.extension,
    durationSeconds: item.durationSeconds,
    transcript: item.transcript,
    dataUrl: item.dataUrl
  };

  const storageData = await chrome.storage.local.get(["recordings_history"]);
  const history = storageData.recordings_history || [];
  history.unshift(historyItem);
  await chrome.storage.local.set({ recordings_history: history.slice(0, 15) });
  loadHistory();
}

function initHistorySection() {
  const toggle = document.getElementById("history-toggle");
  const list = document.getElementById("history-list");
  const arrow = document.getElementById("history-arrow");

  toggle.addEventListener("click", () => {
    const isHidden = list.classList.contains("hidden");
    if (isHidden) {
      list.classList.remove("hidden");
      arrow.innerText = "▲";
      loadHistory();
    } else {
      list.classList.add("hidden");
      arrow.innerText = "▼";
    }
  });

  loadHistory();
}

async function loadHistory() {
  const data = await chrome.storage.local.get(["recordings_history"]);
  const history = data.recordings_history || [];

  document.getElementById("history-count").innerText = history.length;
  const container = document.getElementById("history-list");

  if (history.length === 0) {
    container.innerHTML = `<div class="history-empty">Nessuna registrazione recente in memoria.</div>`;
    return;
  }

  container.innerHTML = "";
  history.forEach((item) => {
    const dateStr = new Date(item.timestamp).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <div class="history-meta">
        <span class="history-title">${item.type === "video" ? "🖥️ Video Schermo" : "🎙️ Audio Vocale"} (.${item.extension || "webm"})</span>
        <span class="history-sub">${dateStr} &bull; ${item.durationSeconds || 0}s</span>
      </div>
      <div class="history-actions">
        <button class="btn-sm btn-hist-copy" title="Copia Trascrizione">📋</button>
        <button class="btn-sm btn-hist-dl" title="Scarica File">💾</button>
      </div>
    `;

    div.querySelector(".btn-hist-copy").addEventListener("click", () => {
      if (item.transcript) {
        navigator.clipboard.writeText(item.transcript);
        alert("Trascrizione copiata negli appunti!");
      } else {
        alert("Nessun testo presente per questa registrazione.");
      }
    });

    div.querySelector(".btn-hist-dl").addEventListener("click", () => {
      if (item.dataUrl) {
        chrome.downloads.download({
          url: item.dataUrl,
          filename: `Registrazione_${item.id}.${item.extension || "webm"}`,
          saveAs: true
        });
      } else {
        alert("File multimediale non disponibile.");
      }
    });

    container.appendChild(div);
  });
}
