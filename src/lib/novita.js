// ── LE NOVITÀ DI UNA VERSIONE ─────────────────────────────────────────
// L'app si aggiorna da sé mentre la si usa, e chi lavora se ne accorge solo
// perché qualcosa "è cambiato di posto". Le note di rilascio ci sono già
// (Impostazioni → Informazioni), ma nessuno va a cercarle: vanno portate
// davanti una volta, subito dopo l'aggiornamento, e poi mai più.
//
// Due strade, perché una sola non basta:
//   1. si tocca «Nuova versione disponibile» → alla riapertura esce il box
//      con cosa è cambiato;
//   2. l'aggiornamento arriva da sé (l'app riaperta il giorno dopo) → nella
//      campanella resta una notifica che porta alle Informazioni.
//
// Qui la logica pura e le chiavi di memoria; chi la usa è App.jsx.

const CHIAVE_VISTA = 'tana:novita:vista' // ultima versione di cui si sono viste le note
const CHIAVE_ATTESA = 'tana:novita:attesa' // "sto ricaricando per aggiornare"

const leggi = (k) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const scrivi = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* senza memoria locale si resta com'era: nessun box, nessun danno */
  }
}

export const versioneVista = () => leggi(CHIAVE_VISTA)
export const segnaVersioneVista = (v) => scrivi(CHIAVE_VISTA, v || null)

// Toccando «Nuova versione disponibile» si lascia un segno PRIMA di
// ricaricare: al riavvio è l'unico modo per sapere che quel riavvio l'ha
// chiesto qualcuno per aggiornare, e non è una pagina riaperta a caso.
export const chiediNovitaAlRiavvio = () => scrivi(CHIAVE_ATTESA, '1')
export const novitaAttese = () => leggi(CHIAVE_ATTESA) === '1'
export const dimenticaNovitaAttese = () => scrivi(CHIAVE_ATTESA, null)

// COSA FARE ALL'AVVIO, in una funzione sola e provabile.
//   'box'      → mostra subito le novità (l'aggiornamento l'ha chiesto lui)
//   'notifica' → la versione è cambiata da sé: lascia un avviso e basta
//   'niente'   → stessa versione di prima, o è la prima volta su questo
//                dispositivo (un box di benvenuto con le note di rilascio
//                non lo vuole nessuno)
export function cosaFareAllAvvio({ versione, vista, attese }) {
  if (!versione) return 'niente'
  if (vista === versione) return 'niente'
  if (attese) return 'box'
  if (!vista) return 'niente' // prima volta qui: si registra e zitti
  return 'notifica'
}

// Il pezzo di changelog di UNA versione. Il file è in Markdown e le versioni
// sono titoli `## 1.4.0 — data`: si prende dal titolo che corrisponde fino al
// titolo dopo. Senza corrispondenza si torna la prima sezione, che è la più
// recente — meglio le note di ieri che una finestra vuota.
export function sezioneChangelog(md, versione) {
  const testo = String(md || '')
  if (!testo.trim()) return ''
  const righe = testo.split('\n')
  const inizi = []
  righe.forEach((r, i) => {
    if (r.startsWith('## ')) inizi.push(i)
  })
  if (inizi.length === 0) return ''
  const num = String(versione || '').replace(/^v/, '').trim()
  let scelto = inizi[0]
  if (num) {
    const trovato = inizi.find((i) => righe[i].includes(num))
    if (trovato != null) scelto = trovato
  }
  const dopo = inizi.find((i) => i > scelto)
  return righe
    .slice(scelto, dopo == null ? righe.length : dopo)
    .join('\n')
    .replace(/\n+---\s*$/, '')
    .trimEnd()
}
