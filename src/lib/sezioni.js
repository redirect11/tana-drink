// ── LE SEZIONI DEL GESTIONALE, in un posto solo ──────────────────────
// Le stesse voci servono in due punti che devono dire la stessa cosa: il
// menu laterale e il TITOLO nella barra in alto. Tenute in due elenchi
// separati, prima o poi uno dei due dice «Lista ordini» e l'altro
// «Storico» — e chi legge si chiede se siano due posti diversi.

export const NAV_GESTIONALE = [
  ['coda', '🧾', 'Coda ordini'],
  ['pagamenti', '💶', 'Flusso cassa'],
  ['storico', '📋', 'Lista ordini'],
  ['fatture', '📄', 'Fatture'],
  ['stats', '📊', 'Statistiche'],
  ['menu', '🍸', 'Menù'],
  ['inventario', '📦', 'Inventario'],
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
    const voce =
      NAV_GESTIONALE.find(([id]) => id === tab) || NAV_SALA.find(([id]) => id === tab)
    return voce ? { icona: voce[1], titolo: voce[2] } : null
  }
  const voce = FUORI.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))
  return voce ? { icona: voce[1], titolo: voce[2] } : null
}
