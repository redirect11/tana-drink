// ── DOVE SERVONO I TASTI DELLO ZOOM ──────────────────────────────────
//
// Non dappertutto. Servono dove si LEGGE tanta roba fitta e si sta fermi a
// guardarla: la coda ordini, il conto (creazione, modifica, incasso) e il
// flusso cassa. Lì chi non ci vede bene allarga, e chi vuole più conti a
// schermo stringe.
//
// Nelle altre schermate sono due tasti flottanti nell'angolo che coprono il
// contenuto per una cosa che nessuno usa lì: nel magazzino e nelle
// impostazioni si scorre, non si guarda un quadro d'insieme.
//
// Il livello scelto NON si azzera cambiando pagina: resta quello, si smette
// solo di poterlo cambiare da lì.

const TAB_CON_ZOOM = new Set(['coda', 'pagamenti'])

// `pathname` e `search` di react-router, `staff` = c'è un ruolo di lavoro.
// Al cliente non servono: il suo browser lo zoom ce l'ha già.
export function zoomDove(pathname = '', search = '', staff = false) {
  if (!staff) return false
  // Il conto: creazione (POS) e apertura di uno esistente. L'incasso è una
  // schermata di questi due, quindi ci sta dentro.
  if (pathname === '/pos' || pathname.startsWith('/ordine/')) return true
  if (!pathname.startsWith('/bar')) return false
  // Senza `tab` il gestionale apre la coda.
  const tab = new URLSearchParams(search).get('tab') || 'coda'
  return TAB_CON_ZOOM.has(tab)
}

export default zoomDove
