// @vitest-environment happy-dom
// @livello integrazione
'use strict'

// NEL PIANO SENZA STAMPA NON ESCE NIENTE (REQ-LIC-016, Daniele 12/11/2026:
// «il Free è senza stati di servizio e senza stampa»). La regia scrive
// `stampa: false` nei limiti del Free.
//
// Qui si guarda la CARTA, con la stampante finta che in locale apre una
// finestra a ogni lavoro: nessuna finestra vuol dire nessun foglio. Il
// cancello sta in printer.js (lavoroDiStampa), da cui passa ogni stampa,
// così anche un tasto dimenticato in una schermata non stampa. Gli
// automatismi rispondono «no» prima, per non far nascere un errore a ogni
// conto. E senza la voce — la Tana — tutto esce come sempre.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ricordaImpostazioni } from '../../src/lib/impostazioniLocali.js'
import { stampaNelPiano, MESSAGGI_PIANO } from '../../src/lib/limiti.js'
import {
  printScontrino,
  printComanda,
  printChiusuraCassa,
  printTest,
  scontrinoAutomatico,
  comandeDaStampare,
  preparaStampante,
} from '../../src/lib/printer.js'
import { statoRegistro } from '../../src/lib/registroStampe.js'

const SENZA_STAMPA = { piano: 'free', moduli: {}, limiti: { prodotti_max: 10, stampa: false } }

const CONTO = {
  id: 'o1',
  daily_number: 7,
  total: 16,
  order_items: [{ qty: 2, name: 'Negroni', unit_price: 8 }],
  comande: [{ id: 'c1', status: 'ricevuto', items: [{ qty: 2, name: 'Negroni', unit_price: 8 }] }],
}

let finestre
let apriOriginale
beforeEach(() => {
  localStorage.clear()
  finestre = 0
  apriOriginale = window.open
  window.open = vi.fn(() => {
    finestre += 1
    return { document: { write: () => {}, close: () => {} }, focus: () => {} }
  })
})
afterEach(() => {
  window.open = apriOriginale
})

describe('il piano senza stampa', () => {
  beforeEach(() => ricordaImpostazioni({ licenza: SENZA_STAMPA }))

  it('la domanda risponde dalla licenza ricordata', () => {
    expect(stampaNelPiano()).toBe(false)
  })

  it('scontrino, comanda, chiusura e prova non escono, e lo dicono con la frase del piano', async () => {
    const voci = statoRegistro().voci.length
    for (const stampa of [
      () => printScontrino(CONTO),
      () => printComanda(CONTO, CONTO.comande[0]),
      () => printChiusuraCassa({ incassato: 0, byMethod: {} }, { id: 's1', opened_at: '2026-11-12T18:00:00.000Z' }),
      () => printTest(),
    ]) {
      await expect(stampa()).rejects.toThrow(MESSAGGI_PIANO.stampa)
    }
    expect(finestre).toBe(0)
    // Non è una stampa non riuscita: nel registro non entra niente.
    expect(statoRegistro().voci.length).toBe(voci)
  })

  it('gli automatismi dicono «no» prima di provarci', () => {
    expect(scontrinoAutomatico('admin', { autoPrintScontrino: true, autoPrintScontrinoDa: 'tutti' })).toBe(false)
    expect(comandeDaStampare(CONTO, { daQui: () => true, impostazioni: { autoPrintComanda: true } })).toEqual([])
  })

  it('la stampante non si cerca', async () => {
    expect(await preparaStampante()).toEqual({ ok: false, motivo: MESSAGGI_PIANO.stampa })
  })
})

describe('senza la voce, come sempre', () => {
  it('la Tana stampa lo scontrino', async () => {
    expect(stampaNelPiano()).toBe(true)
    await printScontrino(CONTO)
    expect(finestre).toBe(1)
  })

  it('un Free di prima, senza `stampa`, stampa anche lui', async () => {
    ricordaImpostazioni({ licenza: { piano: 'free', moduli: {}, limiti: { prodotti_max: 10 } } })
    expect(scontrinoAutomatico('admin', { autoPrintScontrino: true, autoPrintScontrinoDa: 'tutti' })).toBe(true)
    await printScontrino(CONTO)
    expect(finestre).toBe(1)
  })
})
