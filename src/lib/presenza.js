import { isGestore, isPersonale } from './ruoli.js'

// ── CHI C'È STASERA ───────────────────────────────────────────────────
//
// Nella coda ogni conto porta l'iniziale di chi l'ha battuto, e la legenda
// in alto dice quale nome sta dietro a quella lettera. Finora la legenda
// nasceva SOLO dai conti già battuti: chi si collegava e non aveva ancora
// aperto niente non compariva da nessuna parte — nemmeno per sé stesso.
//
// Adesso la legenda dice anche CHI È COLLEGATO. Serve a due cose che al
// banco capitano ogni sera: sapere che la propria iniziale è la «M» prima
// di battere il primo conto, e vedere che stasera in sala c'è anche Lucia.
//
// CHI PUÒ SAPERLO: solo admin e bartender (isGestore). La sala vede la
// legenda di sempre — le lettere dei conti battuti — e non chi è online;
// per il cliente non esiste proprio. È una scelta di riservatezza: chi
// lavora non deve poter controllare i colleghi, e sapere chi è collegato
// è un'informazione di chi manda avanti il locale.
//
// QUANDO UNO È «COLLEGATO»: quando il suo terminale ha dato un colpo di
// vita di recente. Non c'è un logout affidabile — si chiude l'app, si
// blocca il tablet, finisce la batteria — quindi la presenza non si spegne
// da sola: SCADE. Ogni terminale scrive «ci sono» ogni tanto, e chi tace
// da più di FINESTRA_PRESENZA esce dall'elenco. Non serve nessuna pulizia:
// il tempo fa da solo.

// Ogni quanto un terminale dice «ci sono», e per quanto quel colpo vale.
// Tre minuti fra un colpo e l'altro, dieci di margine: si sopportano due
// colpi persi — rete che va e viene, tablet che dorme un momento — senza
// far sparire dalla legenda uno che sta lavorando. Il costo è una
// scrittura ogni tre minuti per terminale: nulla, per un bar.
export const BATTITO_PRESENZA_MS = 3 * 60 * 1000
export const FINESTRA_PRESENZA_MS = 10 * 60 * 1000

// Da quando è stato visto l'ultima volta: c'è ancora o è sparito?
export function eCollegato(riga, adesso = Date.now()) {
  const visto = Date.parse(riga?.last_seen || '')
  if (!Number.isFinite(visto)) return false
  return adesso - visto <= FINESTRA_PRESENZA_MS
}

// L'iniziale con cui uno si riconosce sulle card: la stessa regola di
// placedByLetter (orderStatus.js), che guarda il nome di chi ha battuto.
// Sta qui perché la presenza ha in mano un nome e non un `placed_by`.
export function inizialeDi(nome) {
  const n = String(nome || '').trim()
  return n ? n[0].toUpperCase() : null
}

// ── LA LEGENDA, MESSA INSIEME ─────────────────────────────────────────
//
// Prende le lettere già ricavate dai conti battuti e ci unisce chi è
// collegato adesso, se chi guarda ha diritto di saperlo.
//
// LE VOCI NON SI DUPLICANO E NON SI SOVRASCRIVONO: chi ha battuto un conto
// c'è già, e resta com'è — la sua lettera nasce dai conti, che è il dato
// più vecchio e più sicuro. Chi è collegato senza aver battuto niente si
// aggiunge, marcato `soloOnline`, perché sono due cose diverse: una lettera
// che si vede sulle card e una persona che è qui e non ha ancora battuto.
//
// `mio` dice qual è la voce di chi sta guardando: serve a scriverci accanto
// «sei tu», che è metà del motivo per cui questa cosa è stata chiesta.
export function legendaConPresenze(
  daiConti,
  presenze,
  { ruolo, uidMio = null, adesso = Date.now() } = {}
) {
  const voci = (daiConti || []).map(([lettera, nome]) => ({
    lettera,
    nome,
    soloOnline: false,
    mio: false,
  }))
  // Chi non è personale non vede niente di tutto questo, e chi è in sala
  // vede la legenda di sempre: la presenza è roba di chi manda avanti il
  // locale. Il controllo sta qui, dove si decide cosa mostrare, e non nella
  // schermata — così vale per ogni schermata che userà questa funzione.
  if (!isPersonale(ruolo) || !isGestore(ruolo)) return voci

  const gia = new Set(voci.map((v) => v.lettera))
  for (const p of presenze || []) {
    if (!eCollegato(p, adesso)) continue
    if (!isPersonale(p?.role)) continue
    const lettera = inizialeDi(p?.name)
    if (!lettera) continue
    if (gia.has(lettera)) {
      // Ha già battuto: la voce c'è. Si segna solo se è la propria, che è
      // l'unica cosa che la presenza aggiunge in quel caso.
      if (uidMio && p.uid === uidMio) {
        const v = voci.find((x) => x.lettera === lettera)
        if (v) v.mio = true
      }
      continue
    }
    gia.add(lettera)
    voci.push({
      lettera,
      nome: p.name,
      soloOnline: true,
      mio: !!(uidMio && p.uid === uidMio),
    })
  }
  return voci.sort((a, b) => a.lettera.localeCompare(b.lettera))
}
