// ── IL NOME DEL PRODOTTO, IN UN POSTO SOLO ────────────────────────────
//
// Il nome con cui il prodotto si presenta ai locali: «Lime - SmartOrders»
// (decisione dell'utente, 09/11/2026; fino ad allora il segnaposto era
// «Drink»). Sta qui e solo qui; la regia ha il suo gemello in drink-regia
// (`src/lib/prodotto.js`), e i due vanno cambiati insieme.
//
// Il trattino è quello corto, non «—»: la riga va anche sullo scontrino, e
// la termica stampa con la tabella caratteri italiana dell'SDK Epson, dove
// il trattino lungo non è garantito.
//
// Non è il nome del LOCALE (quello sta in lib/venue.js): è la firma del
// prodotto, che compare solo dove la licenza la chiede (REQ-LIC-003,
// `limiti.marchio`).
export const NOME_PRODOTTO = 'Lime - SmartOrders'

// Il nome sotto l'icona dell'app installata, dove il nome intero non ci
// sta: è il nome corto di ripiego di un locale che non ne ha uno suo.
export const NOME_CORTO_PRODOTTO = 'Lime'

// La qualifica accanto al nome nel marchio, come nella barra della regia
// (drink-regia `src/lib/prodotto.js`, QUALIFICA): «Lime» e, piccolo,
// «SmartOrders» (REQ-UI-035).
export const QUALIFICA_PRODOTTO = 'SmartOrders'

// SIAMO NEL GESTIONALE? Lì in alto c'è il marchio del prodotto, non il nome
// del locale (REQ-UI-035): la coda e le sezioni (/bar), il conto al banco
// (/pos) e il profilo di chi lavora. Le pagine dei clienti — la home, il
// menù anche quando lo apre il personale, lo stato di un ordine — restano
// del locale.
const DEL_GESTIONALE = ['/bar', '/pos', '/profilo-staff']
export const nelGestionale = (percorso) =>
  DEL_GESTIONALE.some((p) => percorso === p || String(percorso || '').startsWith(`${p}/`))
