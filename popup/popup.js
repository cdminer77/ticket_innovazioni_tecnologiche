// Logica Popup - Recorder Pro
let timerInterval = null;
let currentRecordedData = null; // Memorizza ultimo file e transcript

document.addEventListener("DOMContentLoaded", async () => {
  initModeSelector();
  initGDPRCheckbox();
  initActionButtons();
  initResultsButtons();
  initHistorySection();

  // Verifica stato corrente dal service worker
  await syncCurrentState();
});

// Sincronizza stato all'apertura del popup
async function syncCurrentState() {
  chrome.runtime.sendMessage({ type: "GET_CURRENT_STATE" }, (state) => {
    if (chrome.runtime.lastError) return;

    if (state && state.isRecording) {
      setRecordingUI(true, state.type, state.startTime);
      if (state.transcript) {
        updateTranscriptBox(state.transcript);
      }
    } else {
      setRecordingUI(false);
    }
  });

  // Ascolta aggiornamenti live della trascrizione mentre il popup è aperto
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TRANSCRIPT_UPDATE") {
      updateTranscriptBox(message.text);
    }
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

function initGDPRCheckbox() {
  const chk = document.getElementById("gdpr-checked");
  const btnStart = document.getElementById("btn-start");

  // Nota: l'operatore può avviare ricordando la formula
  chk.addEventListener("change", () => {
    // Opzionale: feedback visivo
  });
}

function initActionButtons() {
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");

  btnStart.addEventListener("click", async () => {
    const selectedMode = document.querySelector('input[name="recording-mode"]:checked').value;
    const gdprChecked = document.getElementById("gdpr-checked").checked;

    btnStart.disabled = true;
    btnStart.innerText = "Avvio in corso...";

    chrome.runtime.sendMessage({
      type: "START_RECORDING_REQUEST",
      payload: {
        type: selectedMode,
        enableSpeech: true,
        lang: "it-IT"
      }
    }, (response) => {
      btnStart.disabled = false;
      btnStart.innerHTML = `<span class="btn-icon">🔴</span><span>Avvia Registrazione</span>`;

      if (chrome.runtime.lastError) {
        alert("Errore avvio: " + chrome.runtime.lastError.message);
        return;
      }

      if (response && response.success) {
        setRecordingUI(true, selectedMode, Date.now());
      } else {
        alert("Impossibile avviare registrazione: " + (response ? response.error : "Errore"));
      }
    });
  });

  btnStop.addEventListener("click", () => {
    btnStop.disabled = true;
    btnStop.innerText = "Salvataggio...";

    chrome.runtime.sendMessage({ type: "STOP_RECORDING_REQUEST" }, (response) => {
      btnStop.disabled = false;
      btnStop.innerHTML = `<span class="btn-icon">⏹️</span><span>Termina & Salva</span>`;

      if (response && response.success && response.result) {
        currentRecordedData = response.result;
        setRecordingUI(false);
        showResults(response.result);
        loadHistory();
      } else {
        alert("Errore arresto registrazione.");
        setRecordingUI(false);
      }
    });
  });
}

function setRecordingUI(isRecording, mode = "audio", startTime = Date.now()) {
  const statusCard = document.getElementById("status-card");
  const statusLabel = document.getElementById("status-label");
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");
  const modeSelector = document.getElementById("mode-selector");

  if (isRecording) {
    statusCard.classList.add("recording");
    statusLabel.innerText = mode === "video" ? "Registrazione Schermo..." : "Registrazione Vocale...";
    btnStart.classList.add("hidden");
    btnStop.classList.remove("hidden");
    modeSelector.style.opacity = "0.5";
    modeSelector.style.pointerEvents = "none";

    // Mostra pannello trascrizione
    document.getElementById("results-panel").classList.remove("hidden");

    startTimer(startTime);
  } else {
    statusCard.classList.remove("recording");
    statusLabel.innerText = "Pronto per registrare";
    btnStart.classList.remove("hidden");
    btnStop.classList.add("hidden");
    modeSelector.style.opacity = "1";
    modeSelector.style.pointerEvents = "auto";

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
  box.innerText = text || "(In ascolto della conversazione...)";
  box.scrollTop = box.scrollHeight;
}

function showResults(result) {
  const resultsPanel = document.getElementById("results-panel");
  resultsPanel.classList.remove("hidden");

  const mediaLabel = document.getElementById("download-media-label");
  mediaLabel.innerText = result.type === "video" ? "Scarica Video (.webm)" : "Scarica Audio (.webm)";

  updateTranscriptBox(result.transcript || "(Nessun testo vocale rilevato)");
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

  // Scarica Media
  document.getElementById("btn-download-media").addEventListener("click", () => {
    if (!currentRecordedData || !currentRecordedData.blobDataUrl) {
      alert("Nessun file multimediale disponibile.");
      return;
    }
    const ext = currentRecordedData.type === "video" ? "webm" : "webm";
    const filename = `Registrazione_${formatFileDate(new Date())}.${ext}`;
    chrome.runtime.sendMessage({
      type: "DOWNLOAD_RECORDING",
      payload: {
        dataUrl: currentRecordedData.blobDataUrl,
        filename,
        mimeType: currentRecordedData.mimeType
      }
    });
  });

  // Scarica Testo
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
      chrome.runtime.sendMessage({
        type: "DOWNLOAD_RECORDING",
        payload: {
          dataUrl: reader.result,
          filename
        }
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

// Storico Locale
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
        <span class="history-title">${item.type === "video" ? "🖥️ Video Schermo" : "🎙️ Audio Vocale"}</span>
        <span class="history-sub">${dateStr} &bull; ${item.durationSeconds || 0}s</span>
      </div>
      <div class="history-actions">
        <button class="btn-sm btn-hist-copy" title="Copia Trascrizione">📋</button>
        <button class="btn-sm btn-hist-dl" title="Scarica File">💾</button>
      </div>
    `;

    // Click copia trascrizione storico
    div.querySelector(".btn-hist-copy").addEventListener("click", () => {
      if (item.transcript) {
        navigator.clipboard.writeText(item.transcript);
        alert("Trascrizione copiata negli appunti!");
      } else {
        alert("Nessun testo presente per questa registrazione.");
      }
    });

    // Click download file storico
    div.querySelector(".btn-hist-dl").addEventListener("click", () => {
      if (item.blobDataUrl) {
        chrome.runtime.sendMessage({
          type: "DOWNLOAD_RECORDING",
          payload: {
            dataUrl: item.blobDataUrl,
            filename: `Registrazione_${item.id}.${item.type === "video" ? "webm" : "webm"}`
          }
        });
      } else {
        alert("File multimediale non disponibile.");
      }
    });

    container.appendChild(div);
  });
}
