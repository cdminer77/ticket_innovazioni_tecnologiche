# 🎙️ Audio & Video Recorder Pro — con Trascrizione AI & GDPR Promemoria

> **Estensione Web autonoma (Manifest V3)** per registrare chiamate, riunioni tecniche e sessioni video dello schermo con trascrizione vocale in tempo reale e promemoria visivo di consenso privacy GDPR.

---

## 🌟 Caratteristiche Principali

* **100% Autonoma & Standalone**: funziona interamente nel browser client senza richiedere installazioni esterne di Python, librerie o server dedicati.
* **Architettura Manifest V3 con Offscreen API**: la registrazione prosegue senza interruzioni in background anche se l'operatore chiude il popup, naviga su altre schede o utilizza software esterni (es. AnyDesk, TeamViewer, client email o console web).
* **Doppia Modalità di Cattura**:
  * 🎙️ **Chiamata / Solo Audio**: registra voce dell'operatore e chiamate telefoniche con cancellazione dell'eco.
  * 🖥️ **Schermo Intero / Video**: cattura intero monitor, singola finestra o scheda con mixaggio audio di sistema e microfono.
* **Promemoria Visivo Obbligatorio Privacy GDPR**:
  * Riquadro dorato ad alto contrasto con la formula legale da leggere al cliente prima dell'avvio.
  * Garanzia di conformità e tracciamento vocale dell'assenso nei primi secondi.
* **Trascrizione Vocale in Tempo Reale (Speech-to-Text)**:
  * Trascrizione live in lingua italiana (`it-IT`) con segmentazione temporale (`[MM:SS]`).
  * Testo editabile e copiabile istantaneamente negli appunti.
* **Download Istantaneo**:
  * Download del video/audio in formato standard WebM compatibile con qualsiasi player.
  * Esportazione della trascrizione in formato file di testo (`.txt`).
* **Storico Locale Recente**:
  * Memorizzazione crittografata nello storage locale del browser per riascoltare o riscaricare le ultime 20 sessioni.

---

## 📂 Struttura del Progetto

```text
ticket_innovazioni_tecnologiche/
├── manifest.json            # Configurazione Manifest V3 (Chromium / Firefox)
├── COME_INSTALLARE.md       # Guida passo-passo per colleghi (1 minuto)
├── README.md                # Questo documento
├── .gitignore               # Regole di esclusione file
├── icons/                   # Icone ad alta risoluzione (16, 32, 48, 128 px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── popup/                   # Interfaccia grafica utente
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/              # Gestore eventi del browser
│   └── service_worker.js
└── offscreen/               # Motore di registrazione continua in background
    ├── offscreen.html
    └── offscreen.js
```

---

## 🚀 Come Installare l'Estensione

Consulta la [Guida all'Installazione (COME_INSTALLARE.md)](COME_INSTALLARE.md) per i dettagli completi.

In breve:
1. Apri **Chrome** o **Edge** e vai su `chrome://extensions` (oppure `edge://extensions`).
2. Attiva la **"Modalità sviluppatore"** in alto a destra.
3. Clicca su **"Carica estensione non pacchettizzata"** e seleziona questa cartella.
4. Fissa l'icona dell'estensione nella barra in alto.

---

## ⚖️ Conformità Privacy (GDPR)

L'estensione non invia alcun dato a server esterni proprietari o cloud di terze parti:
- L'audio e il video rimangono memorizzati unicamente sul computer locale dell'utente.
- Nessun dato telemetrico viene raccolto.
- L'acquisizione del consenso tramite la formula standard assicura la piena adempienza agli obblighi del Regolamento UE 2016/679 (GDPR).

---

## 📄 Licenza

Distribuito ad uso interno del team tecnico.
