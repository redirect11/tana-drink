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
