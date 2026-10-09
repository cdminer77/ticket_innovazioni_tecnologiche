# 🎙️ Audio & Video Recorder Pro — con Trascrizione AI & GDPR Promemoria

> **Estensione Web autonoma (Manifest V3)** per registrare chiamate, riunioni tecniche e sessioni video dello schermo in formato MP4/WebM compatibile con VLC e Windows Media Player, con trascrizione vocale in tempo reale e promemoria visivo di consenso privacy GDPR.

---

## 🌟 Novità e Caratteristiche (v1.1)

* **Compatibilità Totale con Windows Media Player & VLC**:
  * Supporto nativo per il formato **MP4** (`video/mp4` con codifica universale H.264/AAC), apribile da qualsiasi lettore multimediale senza codec aggiuntivi.
  * Per il formato WebM, iniezione automatica dell'header EBML della durata (`fixWebmDuration`) per eliminare il problema della timeline bloccata o dello schermo nero su VLC.
* **Registrazioni Consecutive Illimitate**:
  * Architettura con cattura su User Gesture diretta: risolto il problema di blocco permessi/consenso. È possibile registrare 1, 2, 10, 50 sessioni di seguito senza dover ricaricare o reinstallare l'estensione.
* **Finestra Fluttuante Indipendente (Pulsante 🗗)**:
  * Oltre al popup standard, con 1 clic è possibile aprire una finestra dedicata fluttuante che non si chiude quando si naviga su AnyDesk, Word o altre schede.
* **Player di Anteprima Integrato**:
  * Rivedi o riascolta subito la registrazione direttamente dentro l'estensione prima di scaricarla.
* **Doppia Modalità di Cattura**:
  * 🎙️ **Chiamata / Solo Audio**: registra voce dell'operatore e chiamate telefoniche con cancellazione dell'eco.
  * 🖥️ **Schermo Intero / Video**: cattura intero monitor, singola finestra o scheda con mixaggio audio di sistema e microfono.
* **Promemoria Visivo Obbligatorio Privacy GDPR**:
  * Riquadro dorato ad alto contrasto con la formula legale da leggere al cliente prima dell'avvio.
* **Trascrizione Vocale Live (Speech-to-Text)**:
  * Trascrizione in tempo reale in lingua italiana (`it-IT`) con segmentazione temporale (`[MM:SS]`).
* **Download Istantaneo & Storico Locale**:
  * Esportazione del file video/audio (`.mp4` o `.webm`) e del file testo (`.txt`).
  * Memorizzazione crittografata nello storage locale del browser per riascoltare o riscaricare le ultime 15 sessioni.

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
├── popup/                   # Interfaccia grafica utente e motore di registrazione
│   ├── popup.html           # Struttura con player e controlli
│   ├── popup.css            # Stile Afterbit Tech
│   ├── popup.js             # Logica di registrazione, permessi e trascrizione
│   └── webm-duration-fix.js # Fix EBML durata per compatibilità VLC / Media Player
└── background/              # Gestore eventi del browser
    └── service_worker.js
```

---

## 🚀 Come Installare l'Estensione

Consulta la [Guida all'Installazione (COME_INSTALLARE.md)](COME_INSTALLARE.md).

In breve:
1. Apri **Chrome** o **Edge** e vai su `chrome://extensions` (oppure `edge://extensions`).
2. Attiva la **"Modalità sviluppatore"** in alto a destra.
3. Clicca su **"Carica estensione non pacchettizzata"** e seleziona questa cartella.
4. Fissa l'icona dell'estensione nella barra in alto.
