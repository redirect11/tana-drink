// ── LA LICENZA IN VIGORE, ADESSO (REQ-LIC-009) ────────────────────────
//
// Quale licenza vale in questo momento, a partire da quella che le
// impostazioni portano (subscribeSettings ce la mette, da `licenza/attuale`;
// all'apertura viene dalla memoria del dispositivo). Una sola domanda, che
// fanno tutte: licenza.js, limiti.js, aggiornamenti.js, App.
//
// SENZA LICENZA NON C'È NIENTE. Fino al 02/11/2026 qui ricadeva la licenza
// scritta nella build, per la Tana; con REQ-LIC-009 ogni installazione ha
// il suo `licenza/attuale` (la Tana compresa), e le regole senza quel
// documento non fanno scrivere niente. Null vuol dire «non si sa ancora»:
// chi chiama non si ferma (lo fa solo davanti a una licenza che dice di
// fermarsi, o a «non attivata» confermata dal server, lib/licenza.js).
//
// LA SCADENZA SI GUARDA QUI, A OGNI DOMANDA, con l'orologio del
// dispositivo: anche senza rete, e anche con l'app aperta da ieri. La regia
// alla scadenza riscrive comunque la licenza (Free o sospesa); questo copre
// il tratto in cui il locale non la vede ancora. `valida_fino` cade al
// taglio della giornata del locale, quindi non ferma mai l'app in pieno
// servizio. Con `alla_scadenza: 'free'` si lavora col Free; altrimenti
// l'installazione è scaduta e si ferma, come sospesa.
//
// Logica pura: niente Firebase, niente React. È un modulo foglia apposta:
// lo importano licenza.js e limiti.js, che si importano fra loro.

// I limiti del Free, come li scrive la regia (drink-regia,
// functions/piani.json, piano `free`). Servono quando la licenza scade
// verso il Free e la regia non l'ha ancora riscritta: per quel tratto
// l'app deve sapere da sola cosa vuol dire Free. Se la regia li cambia,
// si cambiano qui.
export const LIMITI_FREE = Object.freeze({
  prodotti_max: 10,
  conti_aperti_max: 5,
  sconti: false,
  storico_giorni: 7,
  utenti_max: 1,
  marchio: true,
  comande: false,
  // Dal 12/11/2026 (REQ-LIC-016, drink-regia #206): il Free non stampa.
  stampa: false,
  // Dal 13/11/2026 (REQ-LIC-017): il Free non ha l'AI.
  ai: false,
})

export const SCADUTA = 'scaduta'

// La data di scadenza, o null se non c'è o non si legge (una data
// illeggibile non ferma un locale).
export function scadenzaDi(licenza) {
  const v = licenza?.valida_fino
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// La licenza com'è adesso: quella scritta, o, passata la scadenza, il Free
// o lo stato «scaduta». `scaduta_il` resta, per dirlo a schermo.
export function inVigore(licenza, adesso = new Date()) {
  if (!licenza || typeof licenza !== 'object') return null
  const fino = scadenzaDi(licenza)
  if (!fino || adesso < fino) return licenza
  if (licenza.alla_scadenza === 'free') {
    return { ...licenza, piano: 'free', moduli: {}, prove: null, limiti: LIMITI_FREE, scaduta_il: licenza.valida_fino }
  }
  return { ...licenza, stato: SCADUTA, scaduta_il: licenza.valida_fino }
}

// LA LICENZA DI QUESTE IMPOSTAZIONI, in vigore adesso.
export const licenzaDi = (stato, adesso = new Date()) => inVigore(stato?.licenza ?? null, adesso)
