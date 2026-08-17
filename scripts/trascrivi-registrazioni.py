#!/usr/bin/env python
"""
Trascrive le note vocali della cartella `registrazioni/`.

I guai del banco arrivano come messaggi vocali di WhatsApp, non come issue
scritte bene: chi sta lavorando racconta cosa è successo mentre ha le mani
occupate. Questo script li trasforma in testo, così l'agente `rilascio-hotfix`
può leggerli e scriverne le voci in `requirements/bugs.yaml`.

Gira in locale e offline: faster-whisper col modello `small` già in cache
(niente rete, niente audio spedito da qualche parte — dentro ci sono i nomi
dei clienti e le voci di chi lavora qui).

    python scripts/trascrivi-registrazioni.py            # le nuove
    python scripts/trascrivi-registrazioni.py --tutto    # rifa' tutto
    python scripts/trascrivi-registrazioni.py <file>...  # solo questi

Le trascrizioni finiscono in `registrazioni/trascrizioni/<nome>.txt`.
La cartella `registrazioni/` è ignorata da git: quella roba non si committa.

Serve una volta sola, se manca:
    pip install faster-whisper
e ffmpeg nel PATH (per i video e per i formati che non sono wav).
"""

import sys
import os
from pathlib import Path

# Windows manda in errore la stampa degli accenti quando l'uscita è una pipe.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

RADICE = Path(__file__).resolve().parent.parent
CARTELLA = RADICE / "registrazioni"
USCITA = CARTELLA / "trascrizioni"

# Vocali e video: dal video si prende l'audio, i fotogrammi si guardano a parte.
ESTENSIONI = {".ogg", ".opus", ".m4a", ".mp3", ".wav", ".aac", ".mp4", ".mov", ".webm"}

MODELLO = os.environ.get("WHISPER_MODEL", "small")


def registrazioni(argomenti):
    espliciti = [Path(a) for a in argomenti if not a.startswith("--")]
    if espliciti:
        return sorted(p for p in espliciti if p.suffix.lower() in ESTENSIONI)
    if not CARTELLA.is_dir():
        return []
    return sorted(p for p in CARTELLA.iterdir() if p.suffix.lower() in ESTENSIONI)


def main():
    tutto = "--tutto" in sys.argv
    file = registrazioni(sys.argv[1:])

    if not file:
        print(f"Nessuna registrazione in {CARTELLA}")
        return 0

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("Manca faster-whisper. Installalo con: pip install faster-whisper")
        return 1

    USCITA.mkdir(parents=True, exist_ok=True)

    # Il modello si carica una volta sola: caricarlo per ogni file costa più
    # della trascrizione stessa.
    modello = None

    for audio in file:
        testo = USCITA / (audio.stem + ".txt")
        if testo.exists() and not tutto:
            print(f"= {testo.relative_to(RADICE)} (già fatta)")
            continue

        if modello is None:
            print(f"Carico il modello {MODELLO}…", file=sys.stderr)
            modello = WhisperModel(MODELLO, device="cpu", compute_type="int8")

        # vad_filter: le note vocali cominciano e finiscono con secondi di
        # niente, e senza filtro il modello ci ricama sopra parole mai dette.
        segmenti, info = modello.transcribe(str(audio), language="it", vad_filter=True)
        righe = [f"# {audio.name}", f"# durata: {info.duration:.0f}s", ""]
        for s in segmenti:
            righe.append(f"[{int(s.start // 60):d}:{int(s.start % 60):02d}] {s.text.strip()}")

        testo.write_text("\n".join(righe) + "\n", encoding="utf-8")
        print(f"+ {testo.relative_to(RADICE)}")

    immagini = sorted(
        p.name for p in CARTELLA.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".heic"}
    ) if CARTELLA.is_dir() else []
    if immagini:
        print(f"\n{len(immagini)} immagini da guardare a parte in {CARTELLA.name}/:")
        for nome in immagini:
            print(f"  {nome}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
