// ── LE NOVITÀ DI UNA VERSIONE ─────────────────────────────────────────
// L'app si aggiorna da sé mentre la si usa, e chi lavora se ne accorge solo
// perché qualcosa "è cambiato di posto". Le note di rilascio ci sono già
// (Impostazioni → Informazioni), ma nessuno va a cercarle: vanno portate
// davanti una volta, subito dopo l'aggiornamento, e poi mai più.
//
// Due cose, insieme: il BOX quando la build cambia — comunque ci si sia
// arrivati — e una NOTIFICA che resta in campanella, così di un
// aggiornamento c'è traccia anche dopo aver chiuso il box.
//
// Qui la logica pura e le chiavi di memoria; chi la usa è App.jsx.

// SI GUARDA LA BUILD, NON IL NUMERO DI VERSIONE. Il numero (v1.3.0) cambia
// solo quando si rilascia: fra un aggiornamento e l'altro dell'ambiente di
// test è sempre lo stesso, e legando le novità a quello non compariva mai
// niente — provato al banco, due aggiornamenti di fila e nessun box. La
// build invece cambia a ogni pubblicazione, ed è già quella che fa comparire
// «Nuova versione disponibile»: le due cose devono guardare la stessa cosa.
const CHIAVE_VISTA = 'tana:novita:vista' // ultima BUILD di cui si sono viste le note

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

// COSA FARE ALL'AVVIO, in una funzione sola e provabile.
//
// LA BUILD È CAMBIATA? Allora il box, punto — non importa COME ci si è
// arrivati: toccando il banner, riaprendo l'app da un terminale rimasto
// indietro, o ricaricando la pagina da zero. Legarlo al tocco sul banner
// significava che il tablet lasciato acceso tutta la notte, che al mattino
// si aggiorna da solo, non lo vedeva mai — ed è proprio quello dove nessuno
// va a leggere le note.
//
// In ogni caso la notifica si registra SEMPRE, così di un aggiornamento
// resta traccia: già letta se il box è uscito (l'hai appena visto), da
// leggere se no.
//
//   'box'      → mostra le novità adesso, e archivia la notifica come letta
//   'notifica' → solo l'avviso in campanella, da leggere
//   'niente'   → stessa build di prima, o è la prima volta su questo
//                dispositivo (non è stato aggiornato niente: per lui l'app
//                nasce adesso)
export function cosaFareAllAvvio({ build, vista }) {
  if (!build) return 'niente'
  if (vista === build) return 'niente'
  if (!vista) return 'niente' // prima volta qui: si registra e zitti
  return 'box'
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
