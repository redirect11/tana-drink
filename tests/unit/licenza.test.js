'use strict'

// LE FUNZIONI PREMIUM (REQ-LIC-001). Un posto solo che risponde per tutta
// l'app, e DUE domande che non si impastano:
//   INCLUSO — il locale ce l'ha (lo dirà la licenza);
//   ACCESO  — in questo momento lo usa (l'interruttore delle impostazioni).
// Senza la prima non si distingue un locale che la funzione non ce l'ha da
// uno che ce l'ha e l'ha spenta, e sono due schermate diverse.

import { describe, it, expect } from 'vitest'
import {
  MODULI_PREMIUM,
  MOTIVO_PREMIUM,
  chiaveModulo,
  ePremium,
  moduliPremium,
  moduloAcceso,
  moduloAttivo,
  moduloIncluso,
  voceVisibile,
  moduloDiSezione,
  menuDigitaleAttivo,
  ordinazioneClientiAttiva,
  accountClientiAttivi,
  licenzaEffettiva,
  installazioneBloccata,
  statoLicenza,
  STATI_LICENZA,
} from '../../src/lib/licenza.js'
import { LICENZA_TANA } from '../helpers/licenza.js'

// Una licenza con lo scadenzario e senza la conta: le prove partono da qui,
// scritta, come la scrive la regia in `licenza/attuale`.
const LIC = { licenza: { moduli: { scadenzario: true } } }

describe('una licenza con lo scadenzario e senza la conta', () => {
  it('lo scadenzario è incluso e lavora', () => {
    expect(moduloIncluso(LIC, 'scadenzario')).toBe(true)
    expect(moduloAttivo(LIC, 'scadenzario')).toBe(true)
  })

  it('la conta non è inclusa, e nessun interruttore la accende', () => {
    expect(moduloIncluso(LIC, 'conta')).toBe(false)
    expect(moduloAttivo(LIC, 'conta')).toBe(false)
    // IL PUNTO DELLA DISTINZIONE: il flag d'uso c'è e dice «acceso», ma il
    // locale la funzione non ce l'ha. Un flag solo non saprebbe dirlo.
    expect(moduloAcceso({ ...LIC, modulo_conta_enabled: true }, 'conta')).toBe(true)
    expect(moduloAttivo({ ...LIC, modulo_conta_enabled: true }, 'conta')).toBe(false)
  })
})

describe('incluso e acceso, le quattro combinazioni', () => {
  it('incluso e acceso: lavora', () => {
    expect(moduloAttivo({ ...LIC, modulo_scadenzario_enabled: true }, 'scadenzario')).toBe(true)
  })

  it('incluso e spento: non lavora, ma non è «non incluso»', () => {
    const stato = { ...LIC, modulo_scadenzario_enabled: false }
    expect(moduloIncluso(stato, 'scadenzario')).toBe(true)
    expect(moduloAcceso(stato, 'scadenzario')).toBe(false)
    expect(moduloAttivo(stato, 'scadenzario')).toBe(false)
  })

  it('non incluso: non lavora comunque, acceso o spento', () => {
    expect(moduloAttivo({ ...LIC, modulo_conta_enabled: true }, 'conta')).toBe(false)
    expect(moduloAttivo({ ...LIC, modulo_conta_enabled: false }, 'conta')).toBe(false)
  })

  it('quello che è incluso è acceso di suo: non serve accenderlo a mano', () => {
    // Idioma di `workflow_enabled !== false`: quello che il locale ha
    // comprato funziona senza che nessuno debba andare a cercarlo, e si
    // spegne solo se qualcuno lo spegne davvero.
    expect(moduloAcceso({}, 'scadenzario')).toBe(true)
    expect(moduloAcceso({ modulo_scadenzario_enabled: undefined }, 'scadenzario')).toBe(true)
    expect(moduloAcceso({ modulo_scadenzario_enabled: false }, 'scadenzario')).toBe(false)
  })
})

describe('i casi storti: nel dubbio, non lavora', () => {
  it('impostazioni non ancora arrivate: nessun modulo, ma niente si ferma', () => {
    // Fino a REQ-LIC-009 qui valeva la licenza della build. Ora una licenza
    // che non si sa ancora non dà moduli (il primo disegno, sui dispositivi
    // già usati, ha l'ultima licenza ricordata), e non ferma l'app: a
    // fermarla è solo una licenza che lo dice.
    for (const id of Object.keys(MODULI_PREMIUM)) {
      expect(moduloIncluso(null, id), id).toBe(false)
      expect(moduloIncluso(undefined, id), id).toBe(false)
    }
    expect(installazioneBloccata(null)).toBe(false)
    expect(installazioneBloccata({})).toBe(false)
  })

  it('la FORMA VECCHIA delle impostazioni non cambia niente', () => {
    // Il documento settings/bar dei locali è stato scritto anni prima di
    // questi campi: quello che non c'è non toglie l'incluso e non accende
    // il non incluso.
    const vecchio = { ...LIC, workflow_enabled: true, price_markup: 3 }
    expect(moduloAttivo(vecchio, 'scadenzario')).toBe(true)
    expect(moduloAttivo(vecchio, 'conta')).toBe(false)
  })

  it('solo il booleano `false` spegne', () => {
    // Un `0` o una stringa «false» arrivano da import e migrazioni scritti
    // a mano, e non sono una decisione di nessuno.
    expect(moduloAcceso({ modulo_scadenzario_enabled: 0 }, 'scadenzario')).toBe(true)
    expect(moduloAcceso({ modulo_scadenzario_enabled: 'false' }, 'scadenzario')).toBe(true)
  })

  it('un id che non è un modulo premium non è incluso, non è acceso, non è attivo', () => {
    for (const id of ['prodotti', undefined, 'licenza']) {
      expect(moduloIncluso({ licenza: { moduli: { [id]: true } } }, id)).toBe(false)
      expect(moduloAcceso({}, id)).toBe(false)
      expect(moduloAttivo({}, id)).toBe(false)
    }
  })
})

describe('la licenza comanda per intero', () => {
  // La licenza della regia ha sempre il piano accanto ai moduli
  // (drink-regia, functions/lib/licenza.js): è lei la verità per intero.
  it('quello che la licenza non nomina non c’è', () => {
    const stato = { licenza: { piano: 'base', moduli: { conta: true } } }
    expect(moduloIncluso(stato, 'scadenzario')).toBe(false)
    expect(moduloAttivo(stato, 'scadenzario')).toBe(false)
    expect(moduloIncluso({ licenza: { piano: 'base', moduli: {} } }, 'scadenzario')).toBe(false)
  })

  it('quello che nomina c’è', () => {
    const stato = { licenza: { moduli: { conta: true, scadenzario: true } } }
    expect(moduloIncluso(stato, 'conta')).toBe(true)
    expect(moduloAttivo(stato, 'conta')).toBe(true)
  })

  // CAMBIATO CON BUG-125 (01/11/2026). Fino ad allora una licenza senza
  // piano comandava solo sui moduli che nominava, e per gli altri tornava
  // alla colonna `incluso` del codice (BUG-122): era la licenza scritta
  // dagli strumenti di sviluppo in settings/bar, sulla Tana, coi tre moduli
  // di allora. Quella licenza ora non si legge più, la colonna non c'è, e
  // la licenza della Tana sta nella sua build e nomina ogni modulo. Una
  // regola sola, per ogni licenza: il silenzio è un no.
  it('anche una licenza senza piano: il silenzio è un no', () => {
    const vecchia = { licenza: { moduli: { conta: false, fatture: false, scadenzario: true } } }
    for (const id of ['menu_tavoli', 'ordini_cliente', 'clienti', 'magazzino', 'statistiche', 'staff', 'sumup']) {
      expect(moduloIncluso(vecchia, id), id).toBe(false)
    }
    expect(moduloIncluso(vecchia, 'scadenzario')).toBe(true)
  })

  // CAMBIATO CON BUG-125: prima una licenza senza `moduli` tornava alla
  // tabella, cioè dava quasi tutto. «Nn va bene che senza licenza sia tutto
  // acceso» (l'utente, 31/10/2026): senza elenco non c'è niente.
  it('una licenza senza l’elenco dei moduli non ne include nessuno', () => {
    for (const id of Object.keys(MODULI_PREMIUM)) {
      expect(moduloIncluso({ licenza: { piano: 'base' } }, id), id).toBe(false)
    }
  })

  it('la licenza dice cosa il locale HA, non se lo sta usando', () => {
    // La licenza nomina il modulo, l'impostazione lo spegne: comandano
    // tutt'e due, ognuna sulla sua domanda.
    const stato = { licenza: { moduli: { conta: true } }, modulo_conta_enabled: false }
    expect(moduloIncluso(stato, 'conta')).toBe(true)
    expect(moduloAcceso(stato, 'conta')).toBe(false)
    expect(moduloAttivo(stato, 'conta')).toBe(false)
    // E il verso opposto: l'impostazione accesa su un modulo che la licenza
    // non nomina non lo fa entrare dalla finestra.
    const altro = { licenza: { piano: 'base', moduli: { conta: true } }, modulo_scadenzario_enabled: true }
    expect(moduloAcceso(altro, 'scadenzario')).toBe(true)
    expect(moduloAttivo(altro, 'scadenzario')).toBe(false)
  })
})

// QUALE LICENZA VALE (BUG-125, REQ-LIC-009). Il documento `licenza/attuale`,
// se c'è; se no l'installazione non è attivata — ma solo quando lo dice il
// server. Fino al 02/11/2026 in mezzo c'era la licenza della build, per la
// Tana: ora anche la Tana ha il suo documento.
describe('quale licenza vale', () => {
  const REGIA = { piano: 'base', stato: 'attiva', moduli: { magazzino: true } }

  it('il documento, anche se viene dalla cache: è la licenza che il dispositivo conosce', () => {
    expect(licenzaEffettiva({ documento: REGIA, certo: true })).toBe(REGIA)
    expect(licenzaEffettiva({ documento: REGIA, certo: false })).toBe(REGIA)
  })

  it('senza documento, «non attivata» solo se il server ha confermato', () => {
    // Alla prima apertura senza rete la cache non sa niente: «non lo so»
    // non è «non c'è», e un locale in regola non si ferma.
    expect(licenzaEffettiva({ documento: null, certo: false })).toBeNull()
    expect(licenzaEffettiva(null)).toBeNull()
    const nessuna = licenzaEffettiva({ documento: null, certo: true })
    expect(nessuna).toEqual({ stato: STATI_LICENZA.NON_ATTIVATA })
    expect(statoLicenza({ licenza: nessuna })).toBe(STATI_LICENZA.NON_ATTIVATA)
    expect(installazioneBloccata({ licenza: nessuna })).toBe(true)
    for (const id of Object.keys(MODULI_PREMIUM)) expect(moduloIncluso({ licenza: nessuna }, id), id).toBe(false)
  })
})

describe('la tabella dei moduli', () => {
  it('la chiave di ogni modulo è quella scritta sui documenti dei locali', () => {
    expect(chiaveModulo('conta')).toBe('modulo_conta_enabled')
    expect(chiaveModulo('scadenzario')).toBe('modulo_scadenzario_enabled')
    expect(chiaveModulo('prodotti')).toBeNull()
  })

  it('ogni modulo ha nome, descrizione, una chiave sua, e non dice se è incluso', () => {
    // Fino a BUG-125 la colonna `incluso` era la licenza di chi non ne
    // aveva una: una licenza nascosta nel codice. Ora lo dice solo la licenza.
    const chiavi = new Set()
    for (const m of moduliPremium()) {
      expect(m.label).toBeTruthy()
      expect(m.descrizione).toBeTruthy()
      expect(m.chiave).toMatch(/^modulo_.*_enabled$/)
      expect(m).not.toHaveProperty('incluso')
      expect(chiavi.has(m.chiave)).toBe(false)
      chiavi.add(m.chiave)
    }
    expect(moduliPremium().map((m) => m.id)).toEqual(Object.keys(MODULI_PREMIUM))
  })

  it('il motivo dell’interruttore bloccato dice cosa è e non promette niente', () => {
    expect(MOTIVO_PREMIUM).toMatch(/premium/i)
    // Niente toni da venditore a schermo (DESIGN.md, guardrail 3).
    expect(MOTIVO_PREMIUM).not.toMatch(/sblocca|acquista|ora!|scopri/i)
  })
})

describe('filtrare un elenco di voci', () => {
  it('una voce che non è premium passa sempre', () => {
    expect(voceVisibile({}, 'prodotti')).toBe(true)
    expect(voceVisibile(null, 'movimenti')).toBe(true)
    expect(ePremium('prodotti')).toBe(false)
  })

  it('una voce premium passa solo se il modulo lavora', () => {
    expect(ePremium('conta')).toBe(true)
    expect(voceVisibile(LIC, 'conta')).toBe(false)
    expect(voceVisibile(LIC, 'scadenzario')).toBe(true)
    expect(voceVisibile({ ...LIC, modulo_scadenzario_enabled: false }, 'scadenzario')).toBe(false)
  })

  // Lo storico inventari (REQ-MAG-052) si accende con l'inventario: la
  // corrispondenza sta nel modulo (`sezioni`), non nella schermata.
  it('una sezione elencata da un modulo segue quel modulo', () => {
    expect(moduloDiSezione('storico')).toBe('conta')
    expect(moduloDiSezione('conta')).toBe('conta')
    expect(moduloDiSezione('prodotti')).toBe('prodotti')
    expect(ePremium('storico')).toBe(true)
    expect(voceVisibile(LIC, 'storico')).toBe(false)
    expect(voceVisibile({ licenza: { moduli: { conta: true } } }, 'storico')).toBe(true)
    expect(voceVisibile({ licenza: { moduli: { conta: true } }, modulo_conta_enabled: false }, 'storico')).toBe(false)
  })
})

// I MODULI DEL PRODOTTO (REQ-LIC-002). Decisione dell'utente, 22/10/2026:
// «di base quello che può fare è creare gli item di menu e la gestione
// delle ordinazioni»; il resto è premium, con gli id del listino della
// regia. La Tana tiene quello che aveva, con la sua licenza.
describe('i moduli del prodotto', () => {
  // LA LICENZA DELLA TANA. Prima i sette moduli della 1.10.0 venivano
  // dalla colonna `incluso`, inventario e scadenzario da
  // settings/bar.licenza; con BUG-125 da un file nella build; da REQ-LIC-009
  // dal suo `licenza/attuale`, con gli stessi moduli (tests/helpers).
  it('la Tana, con la sua licenza, ha quello che aveva', () => {
    const tana = { licenza: LICENZA_TANA }
    for (const id of ['menu_tavoli', 'ordini_cliente', 'clienti', 'magazzino', 'statistiche', 'staff', 'sumup', 'conta', 'scadenzario']) {
      expect(moduloAttivo(tana, id), id).toBe(true)
    }
    expect(moduloAttivo(tana, 'fatture')).toBe(true)
    expect(menuDigitaleAttivo(tana)).toBe(true)
    expect(ordinazioneClientiAttiva(tana)).toBe(true)
    expect(accountClientiAttivi(tana)).toBe(true)
  })

  it('con la licenza del piano base, magazzino, statistiche e staff spariscono dal gestionale', () => {
    const base = { licenza: { moduli: { menu_tavoli: false, ordini_cliente: false, clienti: false, magazzino: false, statistiche: false, staff: false, sumup: false } } }
    for (const sezione of ['inventario', 'fornitori', 'stats', 'bilancio', 'vista-cliente']) {
      expect(voceVisibile(base, sezione), sezione).toBe(false)
    }
    // Quello che è di base resta.
    for (const sezione of ['coda', 'pagamenti', 'menu', 'impostazioni', 'utenti']) {
      expect(voceVisibile(base, sezione), sezione).toBe(true)
    }
    expect(menuDigitaleAttivo(base)).toBe(false)
    expect(ordinazioneClientiAttiva(base)).toBe(false)
    expect(accountClientiAttivi(base)).toBe(false)
  })

  it('gli account clienti vogliono il modulo E l’interruttore del locale', () => {
    expect(accountClientiAttivi({ licenza: { moduli: { clienti: true } }, customer_accounts_enabled: false })).toBe(false)
    expect(accountClientiAttivi({ licenza: { moduli: { clienti: true } }, customer_accounts_enabled: true })).toBe(true)
  })

  it('ogni modulo ha chiave, etichetta e descrizione, e gli id sono quelli del listino', () => {
    for (const [id, m] of Object.entries(MODULI_PREMIUM)) {
      expect(m.chiave, id).toBe(`modulo_${id}_enabled`)
      expect(m.label, id).toBeTruthy()
      expect(m.descrizione, id).toBeTruthy()
    }
  })
})
