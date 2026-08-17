// ── LE IMPOSTAZIONI DELL'ULTIMA VOLTA ────────────────────────────────
//
// Le impostazioni del locale arrivano da Firestore, e per un istante non ci
// sono: la schermata si disegna coi valori di partenza e poi si corregge.
// Di solito non si nota — ma quando l'impostazione decide un COLORE si
// vede: aprendo un conto le strisce comparivano colorate e sparivano un
// attimo dopo, in un locale che le aveva spente.
//
// Qui si tiene l'ultima risposta del server in memoria locale, e la si usa
// come punto di partenza al disegno successivo. È l'ultima verità nota:
// se nel frattempo qualcuno ha cambiato qualcosa, la correzione arriva
// comunque un istante dopo — ma senza il lampo.
//
// Non è una cache dei dati: sono preferenze, poche righe, e non si sta
// decidendo niente di importante su questa copia (gli ordini leggono
// sempre il documento vero).

const CHIAVE = 'tana:impostazioni'

export function ricordaImpostazioni(data) {
  if (!data || typeof data !== 'object') return
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(data))
  } catch {
    /* memoria piena o negata: si riparte dai default, come prima */
  }
}

// I valori con cui disegnare la PRIMA volta: i default con sopra l'ultima
// risposta del server, se la si ricorda.
export function impostazioniRicordate(defaults = {}) {
  try {
    const salvate = JSON.parse(localStorage.getItem(CHIAVE) || 'null')
    if (salvate && typeof salvate === 'object') return { ...defaults, ...salvate }
  } catch {
    /* roba illeggibile: meglio i default che un errore */
  }
  return { ...defaults }
}
