// IL MAGAZZINO IN UN PERIODO QUALUNQUE (REQ-STAT-002).
//
// Flavio, 17/09/2026: «quello che mi serve sapere dal magazzino è quanto
// avevo di deposito, quanto ho acquistato, quanto ho consumato in un
// determinato periodo». Il deposito non è scritto da nessuna parte: si
// cammina all'indietro dalla giacenza di adesso lungo i movimenti, e il
// conto deve tornare sempre — deposito + acquisti − consumo + rettifiche
// fa la giacenza di fine periodo.
//
// LE DUE TRAPPOLE, ed è per loro che questo file esiste:
//
// 1. LE UNITÀ. Un carico è scritto in PEZZI, una vendita nell'unità della
//    ricetta (40 ml di gin). Sommarli com'è darebbe «40 gin» dove ce n'è
//    meno di uno, e il numero uscito sembrerebbe plausibile a chi lo legge.
// 2. I MOTIVI. Uno storno e una consegna sono tutti e due «entrate», ma
//    uno è merce comprata e l'altro è una vendita disfatta. Confonderli
//    vorrebbe dire raccontare acquisti mai fatti.

import { describe, it, expect } from 'vitest'
import { magazzinoNelPeriodo, gruppoMovimento } from '../../src/lib/magazzinoPeriodo.js'

// Un gin: si compra a bottiglie da 70 cl, si versa a millilitri.
const gin = { id: 'gin', name: 'Gin Bosford', unit: 'pz', package_size: 700, content_unit: 'ml', stock: 4, cost: 10, vat: 22 }
// Una bibita che si compra e si vende a pezzo.
const cola = { id: 'cola', name: 'Coca Cola', unit: 'pz', package_size: null, stock: 20, cost: 1, vat: 22 }
const items = [gin, cola]

const mov = (item_id, type, qty, unit, reason, created_at) => ({
  item_id,
  type,
  qty,
  unit,
  reason,
  created_at,
})

// Il periodo si dice in GIORNATE COMMERCIALI, come dappertutto nell'app:
// gli orari qui sotto sono scelti apposta perché le 22 UTC sono le
// mezzanotte di Roma, cioè ancora la nottata del giorno prima.
const PERIODO = { dal: '2026-06-01', al: '2026-06-30' }
const riga = (r, id) => r.righe.find((x) => x.item_id === id)

describe('in che colonna finisce un movimento', () => {
  it('la merce entrata dalla porta è un acquisto', () => {
    expect(gruppoMovimento({ reason: 'carico' })).toBe('acquisto')
    expect(gruppoMovimento({ reason: 'ordine fornitore' })).toBe('acquisto')
    expect(gruppoMovimento({ reason: 'fattura fornitore' })).toBe('acquisto')
  })

  // Una comanda modificata e un conto annullato sono la stessa uscita
  // rifatta o disfatta: appartengono al consumo, non agli acquisti.
  it('quello che muovono le comande è consumo, nei due versi', () => {
    expect(gruppoMovimento({ reason: 'ordine' })).toBe('consumo')
    expect(gruppoMovimento({ reason: 'modifica ordine' })).toBe('consumo')
    expect(gruppoMovimento({ reason: 'storno' })).toBe('consumo')
  })

  it('le correzioni a mano sono rettifiche, e così quello che non si conosce', () => {
    expect(gruppoMovimento({ reason: 'rettifica' })).toBe('rettifica')
    expect(gruppoMovimento({ reason: 'conta' })).toBe('rettifica')
    // Un motivo nuovo non deve diventare un acquisto inventato.
    expect(gruppoMovimento({ reason: 'motivo che non esiste' })).toBe('rettifica')
    expect(gruppoMovimento({})).toBe('rettifica')
  })
})

describe('deposito, acquisti e consumo di un periodo', () => {
  // Il caso di tutti i giorni: sei bottiglie comprate, un po' di gin
  // versato. La giacenza di adesso è 4 pezzi e non si è mosso niente dopo
  // il periodo, quindi 4 è anche la giacenza di fine giugno.
  const movimenti = [
    mov('gin', 'load', 6, 'pz', 'ordine fornitore', '2026-06-05T09:00:00.000Z'),
    // 700 ml versati: un pezzo esatto, così il conto si legge a occhio.
    mov('gin', 'unload', 700, 'ml', 'ordine', '2026-06-10T22:00:00.000Z'),
    mov('gin', 'unload', 1400, 'ml', 'ordine', '2026-06-20T22:00:00.000Z'),
  ]

  it('il conto torna: deposito + acquisti − consumo = giacenza di fine periodo', () => {
    const r = riga(magazzinoNelPeriodo(movimenti, items, PERIODO), 'gin')
    expect(r.acq).toBe(6)
    expect(r.cons).toBe(3)
    expect(r.fine).toBe(4)
    expect(r.dep).toBe(1) // 1 + 6 − 3 = 4
  })

  // LA TRAPPOLA DELLE UNITÀ: i 2100 ml versati valgono tre pezzi, non
  // 2100. Senza la conversione il deposito verrebbe fuori negativo di
  // duemila bottiglie e nessuno saprebbe perché.
  it('millilitri versati e pezzi comprati si sommano nella stessa unità', () => {
    const r = riga(magazzinoNelPeriodo(movimenti, items, PERIODO), 'gin')
    expect(r.cons).toBe(3)
    expect(r.unit).toBe('pz')
  })

  it('e in euro, al prezzo del prodotto', () => {
    const r = riga(magazzinoNelPeriodo(movimenti, items, PERIODO), 'gin')
    // 10 € + IVA 22% = 12,20 € a bottiglia.
    expect(r.acq_valore).toBe(73.2)
    expect(r.cons_valore).toBe(36.6)
    expect(r.fine_valore).toBe(48.8)
  })
})

describe('il periodo è un recinto', () => {
  const movimenti = [
    mov('cola', 'load', 100, 'pz', 'carico', '2026-05-20T09:00:00.000Z'), // PRIMA
    mov('cola', 'load', 24, 'pz', 'carico', '2026-06-10T09:00:00.000Z'), // dentro
    mov('cola', 'unload', 30, 'pz', 'ordine', '2026-06-15T22:00:00.000Z'), // dentro
    mov('cola', 'load', 12, 'pz', 'carico', '2026-07-02T09:00:00.000Z'), // DOPO
    mov('cola', 'unload', 6, 'pz', 'ordine', '2026-07-03T22:00:00.000Z'), // DOPO
  ]

  // Quello che è successo prima non entra; quello che è successo dopo non
  // entra nelle colonne ma serve a sapere dov'era la giacenza alla fine di
  // giugno, che non è quella di oggi.
  it('quello che è dentro si conta, quello che è dopo riporta indietro la giacenza', () => {
    const r = riga(magazzinoNelPeriodo(movimenti, items, PERIODO), 'cola')
    expect(r.acq).toBe(24)
    expect(r.cons).toBe(30)
    // Oggi 20; dopo il periodo sono entrate 12 e uscite 6, quindi a fine
    // giugno ce n'erano 14.
    expect(r.fine).toBe(14)
    expect(r.dep).toBe(20) // 20 + 24 − 30 = 14
  })

  it('senza «al» il periodo arriva a oggi, e la giacenza è quella di adesso', () => {
    const r = riga(magazzinoNelPeriodo(movimenti, items, { dal: PERIODO.dal }), 'cola')
    expect(r.fine).toBe(20)
    expect(r.acq).toBe(36)
    expect(r.cons).toBe(36)
  })
})

// ── ALL'ORA, NON A GIORNATE (REQ-STAT-003) ───────────────────────
// Il periodo personalizzato delle statistiche si sceglie con l'ora: «dalle
// 18 alle 4» è una serata, e il magazzino deve dire quella, non le due
// giornate intere che la contengono.
describe('il periodo all’ora', () => {
  const movimenti = [
    mov('cola', 'unload', 5, 'pz', 'ordine', '2026-06-15T15:00:00.000Z'), // 17:00, PRIMA
    mov('cola', 'unload', 7, 'pz', 'ordine', '2026-06-15T20:00:00.000Z'), // 22:00, dentro
    mov('cola', 'unload', 3, 'pz', 'ordine', '2026-06-16T01:00:00.000Z'), // 03:00, dentro
    mov('cola', 'unload', 2, 'pz', 'ordine', '2026-06-16T02:00:00.000Z'), // 04:00, DOPO (fine esclusa)
  ]
  const SERATA = { da: '2026-06-15T16:00:00.000Z', a: '2026-06-16T02:00:00.000Z' }

  it('conta solo quello fra i due istanti, e la fine è esclusa', () => {
    const r = riga(magazzinoNelPeriodo(movimenti, items, SERATA), 'cola')
    expect(r.cons).toBe(10)
    // Oggi 20; dopo la fine ne sono usciti 2, quindi alle 04:00 ce n'erano 22.
    expect(r.fine).toBe(22)
  })
})

describe('storni e rettifiche', () => {
  // Un conto annullato rimette il gin sullo scaffale: è consumo che si
  // disfa, non gin comprato.
  it('uno storno abbassa il consumo invece di alzare gli acquisti', () => {
    const movimenti = [
      mov('gin', 'unload', 1400, 'ml', 'ordine', '2026-06-10T22:00:00.000Z'),
      mov('gin', 'load', 700, 'ml', 'storno', '2026-06-10T22:30:00.000Z'),
    ]
    const r = riga(magazzinoNelPeriodo(movimenti, items, PERIODO), 'gin')
    expect(r.cons).toBe(1)
    expect(r.acq).toBe(0)
  })

  // Una rettifica non è né merce comprata né merce bevuta, ma il conto
  // deve tornare lo stesso: sta in una colonna sua e si vede.
  it('una rettifica sta per conto suo, e la somma torna', () => {
    const movimenti = [
      mov('cola', 'load', 24, 'pz', 'carico', '2026-06-10T09:00:00.000Z'),
      mov('cola', 'unload', 30, 'pz', 'ordine', '2026-06-15T22:00:00.000Z'),
      mov('cola', 'unload', 4, 'pz', 'conta', '2026-06-30T10:00:00.000Z'),
    ]
    const r = riga(magazzinoNelPeriodo(movimenti, items, PERIODO), 'cola')
    expect(r.rett).toBe(-4)
    expect(r.dep + r.acq - r.cons + r.rett).toBe(r.fine)
  })
})

describe('cosa entra nell’elenco', () => {
  const fermo = [mov('gin', 'load', 1, 'pz', 'carico', '2026-06-05T09:00:00.000Z')]

  // Su quattrocento articoli, trecento sono fermi: elencarli tutti a zero
  // nasconde i trenta che raccontano qualcosa.
  it('un prodotto che non si è mosso non è una riga', () => {
    const r = magazzinoNelPeriodo(fermo, items, PERIODO)
    expect(r.righe.map((x) => x.item_id)).toEqual(['gin'])
    expect(r.totali.prodotti).toBe(1)
  })

  // Un prodotto cancellato dal magazzino non ha più un'unità: convertire
  // la sua quantità a caso darebbe un numero sbagliato dall'aria giusta.
  it('un movimento di un prodotto che non c’è più si salta', () => {
    const r = magazzinoNelPeriodo(
      [mov('sparito', 'unload', 500, 'ml', 'ordine', '2026-06-10T22:00:00.000Z')],
      items,
      PERIODO
    )
    expect(r.righe).toEqual([])
  })

  // In cima quello che è costato di più: la domanda dietro l'elenco è dove
  // se ne va il denaro, e trenta bottiglie d'acqua non sono la risposta.
  it('in cima c’è quello che ha consumato più euro', () => {
    const movimenti = [
      mov('cola', 'unload', 30, 'pz', 'ordine', '2026-06-15T22:00:00.000Z'),
      mov('gin', 'unload', 2800, 'ml', 'ordine', '2026-06-20T22:00:00.000Z'),
    ]
    const r = magazzinoNelPeriodo(movimenti, items, PERIODO)
    // 4 gin a 12,20 fanno 48,80; 30 cole a 1,22 fanno 36,60.
    expect(r.righe.map((x) => x.item_id)).toEqual(['gin', 'cola'])
    expect(r.righe.map((x) => x.cons_valore)).toEqual([48.8, 36.6])
    expect(r.totali.cons_valore).toBe(85.4)
  })

  it('senza movimenti non c’è niente da mostrare', () => {
    expect(magazzinoNelPeriodo([], items, PERIODO).righe).toEqual([])
    expect(magazzinoNelPeriodo(undefined, items, PERIODO).totali.prodotti).toBe(0)
  })
})
