// ── LE SEZIONI DEL GESTIONALE, in un posto solo ──────────────────────
// Le stesse voci servono in due punti che devono dire la stessa cosa: il
// menu laterale e il TITOLO nella barra in alto. Tenute in due elenchi
// separati, prima o poi uno dei due dice «Lista ordini» e l'altro
// «Storico» — e chi legge si chiede se siano due posti diversi.

import { isAdmin, isGestore } from './ruoli.js'

// Il QUARTO elemento di una voce dice CHI LA VEDE, ed è una funzione di
// `ruoli.js`: dove manca, la voce è di tutto il gestionale. Un flag di
// testo («solo admin») avrebbe rimesso il confronto sul ruolo qui dentro,
// che è la cosa che ruoli.js esiste per evitare.
export const NAV_GESTIONALE = [
  ['coda', '🧾', 'Coda ordini'],
  // La cassa è una sola: dentro ci sono flusso, lista ordini e chiusure
  // (vedi CassaTab). «Lista ordini» aveva una voce sua qui accanto, come
  // se fosse un altro mestiere.
  ['pagamenti', '💶', 'Cassa'],
  ['fatture', '📄', 'Fatture'],
  ['stats', '📊', 'Statistiche'],
  // BILANCIO: i conti del locale — incassi, stipendi, spese, netto del
  // mese. Li guarda chi il locale lo paga, non chi ci lavora: è la prima
  // voce che non basta essere gestori per vedere. Si TOGLIE dal menu, non
  // si nasconde dentro la pagina — una pagina che si apre e poi dice «non
  // puoi» si è già fatta vedere.
  ['bilancio', '⚖️', 'Bilancio', isAdmin],
  ['menu', '🍸', 'Menù'],
  ['inventario', '📦', 'Magazzino'],
  ['staff', '👥', 'Staff'],
  ['utenti', '🧑‍🤝‍🧑', 'Utenti e ruoli'],
  ['vista-cliente', '👀', 'Vista cliente'],
  ['impostazioni', '⚙️', 'Impostazioni'],
]

// La sala parte dalla STESSA coda del banco; «I miei ordini» non è più una
// pagina, è il filtro «Miei» dentro la coda.
export const NAV_SALA = [
  ['coda', '🧾', 'Coda ordini'],
  ['servizio', '🫱', 'Da servire'],
]

// Dove sono finite le sezioni che non ci sono più.
const VECCHI_INDIRIZZI = { storico: 'pagamenti' }

// Le pagine fuori dal gestionale che hanno comunque una testata visibile.
const FUORI = [
  ['/profilo-staff', '👤', 'Il mio profilo'],
  ['/profilo', '👤', 'Il mio profilo'],
  ['/ordini', '🧾', 'I miei ordini'],
  ['/accedi', '🔑', 'Accesso'],
  ['/registrati', '✍️', 'Registrazione'],
]

// IL TITOLO STA NELLA BARRA, non dentro la pagina: una riga di titolo in
// cima al contenuto è una riga in meno di contenuto, e su un tablet al banco
// si vede. Torna { icona, titolo } oppure null dove non serve — la coda è la
// schermata di partenza e si presenta da sé, il menù e le schermate del
// conto hanno già il loro.
export function titoloPagina(pathname = '', search = '') {
  if (pathname.startsWith('/bar')) {
    const tab = new URLSearchParams(search).get('tab') || 'coda'
    if (tab === 'coda') return null
    // Gli indirizzi VECCHI non restano senza nome: `?tab=storico` era la
    // lista ordini, che adesso è una sottosezione della cassa — e i
    // collegamenti salvati e i messaggi ce l'hanno ancora dentro.
    const effettivo = VECCHI_INDIRIZZI[tab] || tab
    const voce =
      NAV_GESTIONALE.find(([id]) => id === effettivo) ||
      NAV_SALA.find(([id]) => id === effettivo)
    return voce ? { icona: voce[1], titolo: voce[2] } : null
  }
  const voce = FUORI.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))
  return voce ? { icona: voce[1], titolo: voce[2] } : null
}

// ── CHI VEDE COSA ────────────────────────────────────────────────────
// Le voci del menu per un ruolo. Il filtro sta QUI e non in StaffDrawer:
// il menu non è l'unico posto che deve saperlo — l'indirizzo `?tab=…` si
// scrive anche a mano — e due filtri scritti in due punti diversi prima o
// poi dicono cose diverse.
export function vociPerRuolo(role) {
  if (!isGestore(role)) return NAV_SALA
  return NAV_GESTIONALE.filter(([, , , vede]) => !vede || vede(role))
}

// Una sezione del gestionale si può aprire con questo ruolo? Togliere la
// voce dal menu non basta: `?tab=bilancio` battuto a mano, o un
// collegamento salvato quando si era admin, ci arriverebbero lo stesso.
export function sezioneConsentita(id, role) {
  const voce = NAV_GESTIONALE.find(([v]) => v === id)
  return !voce?.[3] || voce[3](role)
}
