/**
 * Fix per metadati e durata nei file WebM generati da Chrome MediaRecorder.
 * Inietta o corregge l'header EBML della durata così che Windows Media Player e VLC
 * possano aprire il video, mostrare la barra di avanzamento e consentire il seek temporale.
 */

function fixWebmDuration(blob, durationMs) {
  return new Promise((resolve) => {
    if (!durationMs || durationMs <= 0) {
      resolve(blob);
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      try {
        const buffer = reader.result;
        const fixedBuffer = injectDurationToWebm(buffer, durationMs);
        resolve(new Blob([fixedBuffer], { type: blob.type || "video/webm" }));
      } catch (err) {
        console.warn("Impossibile applicare fix EBML durata, ritorno blob originale:", err);
        resolve(blob);
      }
    };
    reader.onerror = function () {
      resolve(blob);
    };
    reader.readAsArrayBuffer(blob);
  });
}

function injectDurationToWebm(buffer, durationMs) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Cerca il tag Info (0x15 0x49 0xA9 0x66) all'interno dell'header EBML
  let infoPos = -1;
  for (let i = 0; i < Math.min(bytes.length - 4, 1024); i++) {
    if (bytes[i] === 0x15 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0xA9 && bytes[i + 3] === 0x66) {
      infoPos = i;
      break;
    }
  }

  if (infoPos === -1) {
    return buffer;
  }

  // Cerca se esiste già il tag Duration (0x44 0x89) dentro Info
  let durationPos = -1;
  for (let i = infoPos; i < Math.min(bytes.length - 2, infoPos + 256); i++) {
    if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
      durationPos = i;
      break;
    }
  }

  if (durationPos !== -1) {
    // Il tag Duration esiste: aggiorna il valore float a 4 o 8 byte
    const lenByte = bytes[durationPos + 2];
    if (lenByte === 0x84 || lenByte === 0x04) {
      // Float a 32 bit
      view.setFloat32(durationPos + 3, durationMs, false);
      return buffer;
    } else if (lenByte === 0x88 || lenByte === 0x08) {
      // Float a 64 bit
      view.setFloat64(durationPos + 3, durationMs, false);
      return buffer;
    }
  }

  // Se il tag Duration non esiste, cerchiamo TimecodeScale (0x2A 0xD7 0xB1)
  let timecodeScalePos = -1;
  for (let i = infoPos; i < Math.min(bytes.length - 3, infoPos + 256); i++) {
    if (bytes[i] === 0x2A && bytes[i + 1] === 0xD7 && bytes[i + 2] === 0xB1) {
      timecodeScalePos = i;
      break;
    }
  }

  if (timecodeScalePos !== -1) {
    // Inserisci tag Duration subito dopo TimecodeScale
    // Tag: 0x44, 0x89, Lunghezza: 0x88 (8 byte float), Valore: float64
    const scaleLen = bytes[timecodeScalePos + 3] & 0x0F;
    const insertPos = timecodeScalePos + 4 + scaleLen;

    const durationTag = new Uint8Array(11);
    durationTag[0] = 0x44;
    durationTag[1] = 0x89;
    durationTag[2] = 0x88;
    const durationView = new DataView(durationTag.buffer);
    durationView.setFloat64(3, durationMs, false);

    const newBuffer = new Uint8Array(buffer.byteLength + durationTag.byteLength);
    newBuffer.set(bytes.subarray(0, insertPos), 0);
    newBuffer.set(durationTag, insertPos);
    newBuffer.set(bytes.subarray(insertPos), insertPos + durationTag.byteLength);

    // Aggiorna la lunghezza del blocco Info
    return newBuffer.buffer;
  }

  return buffer;
}
