// @vitest-environment happy-dom
'use strict'

// ── IL REGISTRO DELLE STAMPE (REQ-STAMPA-017, BUG-098) ───────────────
//
// «Quando fanno la chiusura cassa, la stampante non stampa lo scontrino di
// chiusura molto spesso» (Flavio, 28/08/2026) — e quando non stampa NON
// compare nessun avviso. Il perché è che una stampa fallita non lasciava
// niente: l'avviso viveva otto secondi in una striscia che compare
// insieme a quella verde «Cassa chiusa» (e i toast si accavallano,
// BUG-078), la risposta della stampante finiva in una console che nessuno
// legge. Con una cassa che si chiude UNA VOLTA A NOTTE, così si va per
// tentativi per settimane.
//
// Qui si prova che la traccia c'è, che è LEGGIBILE e che non diventa un
// problema per conto suo: non cresce all'infinito, non si porta dietro i
// clienti del locale, e non si mette in mezzo alla carta che esce.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let finestre

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  finestre = []
  window.open = vi.fn(() => {
    const scritto = []
    finestre.push(scritto)
    return { document: { write: (h) => scritto.push(h), close: () => {} }, focus: () => {} }
  })
  // Niente logo: qui non c'è un server che lo serva, e l'errore arriva
  // subito invece di far aspettare i tre secondi del tempo massimo.
  window.Image = class {
    set src(_v) {
      queueMicrotask(() => this.onerror?.(new Error('404')))
    }
  }
})

afterEach(() => {
  vi.useRealTimers()
})

// Il registro si scrive DI LATO, su un microtask: chi ha chiesto la stampa
// non aspetta nemmeno la serializzazione. Per leggerlo da disco bisogna
// quindi lasciar passare quel giro.
const scritturaFinita = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const CONTO = {
  id: 'o42',
  daily_number: 42,
  // I dati di una persona vera, come li ha un conto al banco: non devono
  // arrivare nel registro nemmeno per sbaglio.
  customer_name: 'Anna Esposito',
  customer_phone: '3331234567',
  table_label: '4',
  total: 23,
  created_at: '2026-08-28T21:00:00.000Z',
  order_items: [{ qty: 2, name: 'Negroni', unit_price: 8 }],
  comande: [{ id: 'c1', seq: 1, status: 'ricevuto', items: [{ qty: 2, name: 'Negroni' }] }],
}

describe('ogni stampa lascia la sua traccia', () => {
  it('la comanda uscita: una voce, con l’ora e l’esito', async () => {
    const P = await import('../../src/lib/printer.js')
    const { statoRegistro } = await import('../../src/lib/registroStampe.js')
    await P.printComanda(CONTO)

    const voci = statoRegistro().voci
    expect(voci).toHaveLength(1)
    expect(voci[0].che).toBe('Comanda conto #42')
    expect(voci[0].esito).toBe('riuscita')
    expect(Number.isFinite(Date.parse(voci[0].quando))).toBe(true)
  })

  it('e ogni documento si riconosce da com’è scritto nel registro', async () => {
    // Chi apre il pannello con la stampante che fa i capricci deve capire
    // COSA non è uscito, senza tradurre a mente.
    const P = await import('../../src/lib/printer.js')
    const { statoRegistro } = await import('../../src/lib/registroStampe.js')
    await P.printScontrino(CONTO)
    await P.printChiusuraCassa({ incassato: 50, byMethod: {} }, { opened_at: null }, {})
    await P.printOrdineFornitore({ supplier_name: 'Rossi', lines: [] })
    await P.printTest()

    expect(statoRegistro().voci.map((v) => v.che)).toEqual([
      'Prova di stampa',
      'Ordine fornitore',
      'Chiusura cassa',
      'Scontrino conto #42',
    ])
  })

  it('una stampa che non riesce lascia il MOTIVO, che è quello che si va a sistemare', async () => {
    const P = await import('../../src/lib/printer.js')
    const { statoRegistro } = await import('../../src/lib/registroStampe.js')
    // Un documento storto: la comanda si ferma a metà builder e non esce.
    // (Un oggetto senza prototipo fa esplodere `String(...)`: sta per
    // qualunque cosa possa andare storta a metà ticket.)
    await expect(
      P.printComanda({ ...CONTO, comande: [{ id: 'c', items: [{ qty: 1, name: Object.create(null) }] }] })
    ).rejects.toThrow()

    const voce = statoRegistro().voci[0]
    expect(voce.esito).toBe('fallita')
    expect(voce.motivo.length).toBeGreaterThan(0)
  })
})

// ── NIENTE DATI PERSONALI ────────────────────────────────────────────
//
// Un registro di diagnostica non è il posto dove tenere i clienti del
// locale: chi ripara la stampante non ha motivo di leggerli, e questa
// roba resta nel browser di un tablet che passa di mano tutta la sera.
describe('il registro non si porta dietro i clienti', () => {
  it('dice «Scontrino conto #42», non il nome di chi era al tavolo', async () => {
    const P = await import('../../src/lib/printer.js')
    const { statoRegistro } = await import('../../src/lib/registroStampe.js')
    await P.printScontrino(CONTO)
    await P.printComanda(CONTO)

    const tutto = JSON.stringify(statoRegistro().voci)
    expect(tutto).not.toContain('Anna')
    expect(tutto).not.toContain('Esposito')
    expect(tutto).not.toContain('3331234567')
    // Il numero di giornata invece sì: serve a ritrovare il conto e non è
    // il dato di nessuno.
    expect(tutto).toContain('#42')
  })

  it('e un conto senza numero non prova a inventarselo', async () => {
    const P = await import('../../src/lib/printer.js')
    const { statoRegistro } = await import('../../src/lib/registroStampe.js')
    await P.printComanda({ ...CONTO, daily_number: undefined })
    expect(statoRegistro().voci[0].che).toBe('Comanda')
  })
})

// ── NON CRESCE ALL'INFINITO ──────────────────────────────────────────
describe('il tetto delle voci', () => {
  it('oltre cinquanta, le più vecchie se ne vanno', async () => {
    const R = await import('../../src/lib/registroStampe.js')
    for (let n = 1; n <= R.TETTO_VOCI + 12; n++) {
      const id = R.lavoroInCoda(`Comanda conto #${n}`)
      R.lavoroFinito(id, 'riuscita')
    }
    const voci = R.statoRegistro().voci
    expect(voci).toHaveLength(R.TETTO_VOCI)
    // La più recente in cima: è quella che si va a leggere per prima.
    expect(voci[0].che).toBe(`Comanda conto #${R.TETTO_VOCI + 12}`)
    expect(voci.at(-1).che).toBe('Comanda conto #13')
  })

  it('e cinquanta bastano: la chiusura di cassa è l’ULTIMA stampa della serata', async () => {
    // È il motivo per cui il tetto può essere basso. La voce che conta —
    // la chiusura — non viene mai spinta fuori dalle comande della sera
    // dopo, perché quelle vengono DOPO di lei.
    const R = await import('../../src/lib/registroStampe.js')
    R.lavoroFinito(R.lavoroInCoda('Chiusura cassa'), 'fallita', 'la carta è finita')
    for (let n = 0; n < 20; n++) R.lavoroFinito(R.lavoroInCoda('Comanda conto #1'), 'riuscita')
    expect(R.statoRegistro().voci.some((v) => v.che === 'Chiusura cassa')).toBe(true)
  })
})

// ── SOPRAVVIVE A UN RICARICAMENTO ────────────────────────────────────
//
// La domanda vera si fa il giorno dopo: «ieri sera la chiusura è uscita?».
// Se il registro morisse con la pagina non risponderebbe a niente.
describe('il registro resta dov’è', () => {
  it('la voce si ritrova dopo che la pagina è stata ricaricata', async () => {
    const R = await import('../../src/lib/registroStampe.js')
    R.lavoroFinito(R.lavoroInCoda('Chiusura cassa'), 'fallita', 'la carta è finita')
    await scritturaFinita()

    // Un ricaricamento: il modulo riparte da zero e ritrova solo quello
    // che era stato messo per iscritto.
    vi.resetModules()
    const R2 = await import('../../src/lib/registroStampe.js')
    const voci = R2.statoRegistro().voci
    expect(voci).toHaveLength(1)
    expect(voci[0].che).toBe('Chiusura cassa')
    expect(voci[0].motivo).toMatch(/carta/)
  })

  it('la CODA invece no: un lavoro «in corso» dopo un ricaricamento sarebbe una bugia', async () => {
    const R = await import('../../src/lib/registroStampe.js')
    const id = R.lavoroInCoda('Comanda conto #7')
    R.lavoroPartito(id)
    expect(R.statoRegistro().inCorso.che).toBe('Comanda conto #7')
    await scritturaFinita()

    vi.resetModules()
    const R2 = await import('../../src/lib/registroStampe.js')
    expect(R2.statoRegistro().inCorso).toBe(null)
    expect(R2.statoRegistro().inAttesa).toHaveLength(0)
  })

  it('e si può svuotare, quando serve ripartire puliti', async () => {
    const R = await import('../../src/lib/registroStampe.js')
    R.lavoroFinito(R.lavoroInCoda('Prova di stampa'), 'riuscita')
    R.svuotaRegistro()
    await scritturaFinita()

    vi.resetModules()
    const R2 = await import('../../src/lib/registroStampe.js')
    expect(R2.statoRegistro().voci).toHaveLength(0)
  })

  it('memoria negata: il registro non c’è, ma la stampa esce lo stesso', async () => {
    // Navigazione privata, memoria piena: `localStorage` sa dire di no. La
    // carta viene prima di tutto.
    const vero = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('memoria negata')
      },
    })
    try {
      const P = await import('../../src/lib/printer.js')
      await P.printComanda(CONTO)
      expect(finestre).toHaveLength(1)
    } finally {
      Object.defineProperty(window, 'localStorage', vero)
    }
  })
})

// ── LA CODA, MENTRE LA CARTA ESCE ────────────────────────────────────
//
// La seconda domanda davanti a una stampante ferma è «si è impiantata?».
describe('lo stato della coda', () => {
  it('si vede cosa è in corso e quanto c’è dietro', async () => {
    const R = await import('../../src/lib/registroStampe.js')
    const uno = R.lavoroInCoda('Comanda conto #1')
    const due = R.lavoroInCoda('Comanda conto #2')
    R.lavoroPartito(uno)

    expect(R.statoRegistro().inCorso.che).toBe('Comanda conto #1')
    expect(R.statoRegistro().inAttesa.map((l) => l.che)).toEqual(['Comanda conto #2'])

    R.lavoroFinito(uno, 'riuscita')
    R.lavoroPartito(due)
    expect(R.statoRegistro().inCorso.che).toBe('Comanda conto #2')
    expect(R.statoRegistro().inAttesa).toHaveLength(0)
  })

  it('chi guarda il pannello viene avvisato a ogni passaggio', async () => {
    const R = await import('../../src/lib/registroStampe.js')
    const visto = vi.fn()
    const smetti = R.iscrivitiAlRegistro(visto)
    const id = R.lavoroInCoda('Prova di stampa')
    R.lavoroPartito(id)
    R.lavoroFinito(id, 'riuscita')
    expect(visto).toHaveBeenCalledTimes(3)

    smetti()
    R.lavoroFinito(R.lavoroInCoda('Prova di stampa'), 'riuscita')
    expect(visto).toHaveBeenCalledTimes(3)
  })

  it('l’istantanea non cambia se non è cambiato niente', async () => {
    // Chi disegna la confronta per riferimento (useSyncExternalStore):
    // ricrearla a ogni lettura sarebbe un ridisegno all'infinito.
    const R = await import('../../src/lib/registroStampe.js')
    const prima = R.statoRegistro()
    expect(R.statoRegistro()).toBe(prima)
    R.lavoroInCoda('Prova di stampa')
    expect(R.statoRegistro()).not.toBe(prima)
  })
})

// ── NON RALLENTA LA STAMPA ───────────────────────────────────────────
describe('il registro sta di lato', () => {
  it('la carta esce PRIMA che il registro sia finito su disco', async () => {
    const R = await import('../../src/lib/registroStampe.js')
    const scritture = vi.spyOn(window.localStorage, 'setItem')
    scritture.mockClear()
    R.lavoroFinito(R.lavoroInCoda('Comanda conto #1'), 'riuscita')
    // Nell'istante del gesto non è ancora stato scritto niente: la voce è
    // in memoria, il disco viene dopo.
    expect(scritture).not.toHaveBeenCalled()
    await scritturaFinita()
    expect(scritture).toHaveBeenCalled()
    scritture.mockRestore()
  })

  it('e dieci voci di fila costano UN salvataggio solo', async () => {
    const R = await import('../../src/lib/registroStampe.js')
    const scritture = vi.spyOn(window.localStorage, 'setItem')
    scritture.mockClear()
    for (let n = 0; n < 10; n++) R.lavoroFinito(R.lavoroInCoda('Comanda conto #1'), 'riuscita')
    await scritturaFinita()
    expect(scritture).toHaveBeenCalledTimes(1)
    scritture.mockRestore()
  })
})
