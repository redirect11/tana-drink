import { isGestore } from './ruoli.js'

// ── L'ULTIMO RUOLO CONOSCIUTO SU QUESTO DISPOSITIVO ──────────────────
//
// Il ruolo vive nei claim del token di Firebase Auth, e per leggerlo si
// chiama `getIdTokenResult()`. Il token dura un'ora: quando è scaduto quella
// chiamata VA IN RETE — e con la linea del locale che risulta collegata ma
// non passa, resta appesa. All'avvio dell'app si può aspettare; in mezzo a un
// GESTO no, ed è quello che succedeva aprendo una comanda dalla card: la
// schermata restava su «Apro la comanda…» finché il ruolo non tornava.
// Sono 300-450 tocchi a sera.
//
// Qui si tiene l'ultimo ruolo letto, con l'utente a cui apparteneva, così chi
// deve disegnare in fretta parte dall'ultima verità nota e il token si
// rilegge in sottofondo.
//
// NON È UN PERMESSO. I permessi veri stanno nelle regole del database, che
// guardano il token e non questa copia: falsificarla non apre niente. Qui si
// decide soltanto cosa far vedere per PRIMO, mentre la risposta vera arriva.
//
// PORTA L'UTENTE CON SÉ: due persone allo stesso tablet non si prestano il
// ruolo, e chi si scollega non lascia il suo in eredità a chi entra dopo.

const CHIAVE = 'tana:ruolo'

export function ricordaRuolo(uid, ruolo) {
  try {
    if (!uid || !ruolo) localStorage.removeItem(CHIAVE)
    else localStorage.setItem(CHIAVE, JSON.stringify({ uid, ruolo }))
  } catch {
    /* niente memoria: si aspetta il token, come prima */
  }
}

// Torna null quando non si sa: non c'è niente scritto, oppure quello scritto
// è di un altro utente. Chi chiama aspetta il token, che è il comportamento
// di sempre.
export function ruoloRicordato(uid) {
  if (!uid) return null
  try {
    const salvato = JSON.parse(localStorage.getItem(CHIAVE) || 'null')
    return salvato && salvato.uid === uid ? salvato.ruolo || null : null
  } catch {
    return null
  }
}

// Comodo per chi deve solo sapere se aprire la schermata del banco.
export const gestoreRicordato = (uid) => isGestore(ruoloRicordato(uid))
