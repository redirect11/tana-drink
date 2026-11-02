// ── CHI PUÒ FARE COSA, PER RUOLO (REQ-FLOTTA-021) ─────────────────────
//
// I permessi del database scritti come DATI, uguali per ogni backend. Oggi
// li fa rispettare firestore.rules (tests/regole/permessi.test.js li prova
// contro l'emulatore); il giorno dell'installazione on premise li dovranno
// rispettare le regole dell'altro backend, e questa tabella è quella che
// dice se le due divergono.
//
// È la fotografia delle regole al 31/10/2026, non un desiderio: se una
// regola cambia, cambia anche qui, nello stesso commit, dicendo perché.
// I casi con condizioni sui campi (ordini, gruppi, chiamate, contatori)
// hanno le loro prove in tests/regole/: qui ci sono le collezioni dove
// conta solo chi sei.
//
// Non è un file *.test.js: lo usa chi lo fa girare.

// I cinque modi di presentarsi. Il ruolo, come in produzione, è un claim
// del token: sala = 'staff', banco = 'bartender', titolare = 'admin'. Chi
// ha un account senza ruolo è un cliente.
export const RUOLI = ['anonimo', 'cliente', 'sala', 'banco', 'admin']

const TUTTI = RUOLI
const PERSONALE = ['sala', 'banco', 'admin']
const BANCO = ['banco', 'admin']
const TITOLARE = ['admin']
const NESSUNO = []

// Per collezione: chi legge (un documento e l'elenco), chi crea, chi
// aggiorna, chi cancella. `scrive` vale per tutte e tre le scritture.
export const PERMESSI = [
  // Quello che vede il cliente al menù.
  { collezione: 'drinks', legge: TUTTI, scrive: BANCO },
  { collezione: 'categories', legge: TUTTI, scrive: BANCO },
  // Le impostazioni le scrive ogni bartender: anche `licenza`, che è della
  // regia. È un difetto noto, da chiudere con un documento di licenza a
  // parte (vedi REQ-FLOTTA-020): quando succede, questa riga cambia.
  { collezione: 'settings', legge: TUTTI, scrive: BANCO },
  { collezione: 'service_stats', legge: TUTTI, crea: BANCO, aggiorna: BANCO, cancella: BANCO },

  // Il magazzino e i fornitori: solo chi manda avanti il banco.
  { collezione: 'inventory_items', legge: BANCO, scrive: BANCO },
  { collezione: 'inventory_categories', legge: BANCO, scrive: BANCO },
  { collezione: 'macro_categories', legge: BANCO, scrive: BANCO },
  { collezione: 'suppliers', legge: BANCO, scrive: BANCO },
  { collezione: 'supplier_prices', legge: BANCO, scrive: BANCO },
  { collezione: 'supplier_price_history', legge: BANCO, scrive: BANCO },
  { collezione: 'stock_movements', legge: BANCO, scrive: BANCO },
  { collezione: 'stock_counts', legge: BANCO, scrive: BANCO },
  { collezione: 'purchase_orders', legge: BANCO, scrive: BANCO },
  { collezione: 'purchase_order_templates', legge: BANCO, scrive: BANCO },
  { collezione: 'supplier_invoices', legge: BANCO, scrive: BANCO },
  { collezione: 'altre_spese', legge: BANCO, scrive: BANCO },

  // Le paghe: nemmeno la sala vede quanto prendono gli altri.
  { collezione: 'staff_rates', legge: BANCO, scrive: BANCO },
  // L'extra del minimo lo scrive il solo titolare.
  { collezione: 'minimi_extra', legge: BANCO, scrive: TITOLARE },

  // Lo storico importato: dall'app si legge e basta.
  { collezione: 'vendite_storiche', legge: BANCO, scrive: NESSUNO },
  { collezione: 'mesi_storici', legge: BANCO, scrive: NESSUNO },
  { collezione: 'vendite_storiche_prodotti', legge: BANCO, scrive: NESSUNO },

  // Il lavoro della serata, di tutto il personale.
  { collezione: 'staff_hours', legge: PERSONALE, scrive: PERSONALE },
  { collezione: 'pos_prefs', legge: PERSONALE, scrive: PERSONALE },
  { collezione: 'vouchers', legge: PERSONALE, scrive: PERSONALE },
  { collezione: 'invoices', legge: PERSONALE, scrive: PERSONALE },
  // Gli incassi e la cassa non si cancellano, da nessuno.
  { collezione: 'payments', legge: PERSONALE, crea: PERSONALE, aggiorna: PERSONALE, cancella: NESSUNO },
  { collezione: 'cash_sessions', legge: PERSONALE, crea: PERSONALE, aggiorna: PERSONALE, cancella: NESSUNO },
  // Le timbrature: le corregge il banco.
  { collezione: 'staff_shifts', legge: PERSONALE, crea: PERSONALE, aggiorna: PERSONALE, cancella: BANCO },
  // Il diario della stampante: lo scrive chi stampa, lo legge il banco.
  { collezione: 'diagnostica_stampante', legge: BANCO, scrive: PERSONALE },

  // La scelta sugli aggiornamenti stava qui fino al 31/10/2026; ora è una
  // chiamata alla regia (REQ-FLOTTA-020), e la collezione è chiusa a tutti.
  { collezione: 'aggiornamenti', legge: NESSUNO, scrive: NESSUNO },
]

export const OPERAZIONI = ['legge', 'crea', 'aggiorna', 'cancella']

// Chi può fare `operazione` su questa riga della tabella.
export const chiPuo = (riga, operazione) => (operazione === 'legge' ? riga.legge : riga[operazione] ?? riga.scrive)

// I documenti PROPRI: qui conta di chi è il documento. L'uid di chi bussa è
// `<ruolo>-1` (cliente-1, sala-1, …); l'altro è sempre di qualcun altro.
export const PROPRI = [
  // Il profilo del cliente registrato: suo, e il banco lo legge.
  { collezione: 'customers', proprio: { legge: TUTTI.slice(1), scrive: TUTTI.slice(1) }, altrui: { legge: BANCO, scrive: NESSUNO } },
  // «Ci sono»: ognuno del personale scrive la sua riga; l'elenco lo legge
  // chi manda avanti il locale.
  {
    collezione: 'presenze',
    proprio: { legge: BANCO, crea: PERSONALE, aggiorna: PERSONALE, cancella: TUTTI.slice(1) },
    altrui: { legge: BANCO, crea: NESSUNO, aggiorna: NESSUNO, cancella: BANCO },
  },
]
