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

// ── LE CORSIE SPENTE SU QUESTO TERMINALE ─────────────────────────────
//
// Quali colonne della coda a corsie chi sta a questo schermo non vuole
// vedere. È una preferenza del DISPOSITIVO, non del locale: il tablet del
// banco guarda «Da fare» e «Al banco», quello della cassa «Da incassare»,
// e sono due persone diverse davanti a due schermi diversi. Metterla sulle
// impostazioni del bar vorrebbe dire che accendendo una colonna al banco
// si spegne alla cassa.

const CHIAVE_CORSIE = 'tana:corsie:nascoste'

// Torna null quando su questo terminale non si è ancora scelto niente:
// quali colonne convenga tenere spente all'inizio è una decisione del
// dominio, e sta in coda.js con le corsie.
export function corsieNascoste() {
  try {
    const salvate = JSON.parse(localStorage.getItem(CHIAVE_CORSIE) || 'null')
    return Array.isArray(salvate) ? salvate.filter((x) => typeof x === 'string') : null
  } catch {
    /* roba illeggibile: decide il default */
    return null
  }
}

export function ricordaCorsieNascoste(ids) {
  try {
    localStorage.setItem(CHIAVE_CORSIE, JSON.stringify([...new Set(ids || [])]))
  } catch {
    /* niente memoria: la scelta vale per questa sessione */
  }
}

// ── COSA GUARDA QUESTO TERMINALE: I CONTI O LE COMANDE ───────────────
//
// Chi sta al banco vede sempre le comande — è il suo lavoro — ma chi
// guarda la serata vuole tutte e due le cose: «come sta andando» (i conti:
// in corso, chiusi, annullati) e «a che punto è la preparazione» (le
// comande, nei passi del servizio). Sono due domande diverse sullo stesso
// schermo, e quale delle due si sta facendo lo sa solo chi ci sta davanti:
// per questo la scelta è del dispositivo, come le altre qui sopra.
//
// Torna null quando non si è scelto niente: decide il ruolo.

const CHIAVE_VISTA = 'tana:corsie:vista'

export function vistaCorsie() {
  try {
    const v = localStorage.getItem(CHIAVE_VISTA)
    return v === 'conti' || v === 'comande' ? v : null
  } catch {
    return null
  }
}

export function ricordaVistaCorsie(vista) {
  try {
    if (vista) localStorage.setItem(CHIAVE_VISTA, vista)
    else localStorage.removeItem(CHIAVE_VISTA)
  } catch {
    /* niente memoria: la scelta vale per questa sessione */
  }
}

// ── I TASTI DEL CONTO: aperti o ridotti ──────────────────────────────
//
// Sopra la lista delle righe stanno «Unisci», «Dati conto» e «Prodotto
// libero»: comodi a chi batte conti complicati, tre righe di schermo
// rubate alla lista a chi fa solo drink. Chi li riduce li ritrova tutti
// nel ⋯ — non spariscono, si spostano — e «Comande» resta comunque a
// vista, che è la cosa che si apre di continuo.
//
// È una scelta del dispositivo, come le altre qui sopra: il tablet del
// banco e il telefono di chi gira in sala vogliono cose diverse.

const CHIAVE_AZIONI_CONTO = 'tana:conto:azioni-ridotte'

export function azioniContoRidotte() {
  try {
    return localStorage.getItem(CHIAVE_AZIONI_CONTO) === '1'
  } catch {
    return false
  }
}

export function ricordaAzioniContoRidotte(ridotte) {
  try {
    if (ridotte) localStorage.setItem(CHIAVE_AZIONI_CONTO, '1')
    else localStorage.removeItem(CHIAVE_AZIONI_CONTO)
  } catch {
    /* niente memoria: la scelta vale per questa sessione */
  }
}
