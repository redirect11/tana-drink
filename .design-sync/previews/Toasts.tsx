import { useState } from 'react'
// showToast arriva dal bundle apposta: importato dal sorgente ne nascerebbe una
// seconda copia dello store, e la pila non vedrebbe i messaggi.
import { Toasts, showToast } from 'karaoke-drink'

// La pila è un singolo, montato una volta sola in alto nell'albero: i messaggi
// arrivano dallo store di src/lib/toast.js, non da props. Un tipo per scheda —
// due messaggi insieme si sovrappongono (li mette entrambi al centro in basso),
// quindi mostrarne quattro nella stessa immagine direbbe una bugia.
function Pila({ testo, kind }: { testo: string; kind: string }) {
  useState(() => {
    showToast(testo, { kind, duration: 0, id: 'anteprima' })
    return null
  })
  return (
    <div style={{ minHeight: 220 }}>
      <p className="muted small" style={{ margin: 0 }}>
        La pila sta in basso, sopra qualunque schermata. Si tocca per chiudere.
      </p>
      <Toasts />
    </div>
  )
}

// Le azioni di staff e clienti: un ordine nuovo, una riga aggiunta a un conto.
export const Informazione = () => <Pila testo="Nuovo ordine al tavolo 4" kind="info" />

// Qualcosa è in corso: girella al posto del segno, e resta finché non finisce.
export const Sincronizzazione = () => <Pila testo="Sincronizzo tre modifiche…" kind="sync" />

export const Riuscito = () => <Pila testo="Conto #12 chiuso · 34,50 €" kind="success" />

// Gli errori restano più a lungo: otto secondi, non quattro.
export const Errore = () => <Pila testo="Il banco non risponde: riprovo fra poco" kind="error" />
