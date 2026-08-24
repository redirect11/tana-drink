// @vitest-environment happy-dom
'use strict'

// ── L'ALIQUOTA IVA È UNA SOLA, QUELLA DEL LOCALE (BUG-084) ───────────
//
// Ce n'erano due, e non lo sapeva nessuno: `ivaRate` fra le impostazioni
// della stampante — nel browser, PER TERMINALE — che finiva sulla riga IVA
// dello scontrino, e `sale_vat` su settings/bar — CONDIVISA — che usano
// margini, prezzo consigliato e statistiche. Due tablet potevano stampare
// scontrini con aliquote diverse, e l'IVA sulla carta poteva non tornare
// con quella dei conti.
//
// Un'aliquota è un fatto del locale, non una preferenza del tablet che ha
// stampato: vince `sale_vat`, e il campo nelle impostazioni della stampante
// è sparito. Chi aveva un `ivaRate` diverso salvato nel browser se lo tiene
// lì, inerte: non lo legge più nessuno, e la carta che esce da quel tablet
// è uguale a quella di tutti gli altri. È esattamente la cosa da provare.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let finestre

beforeEach(() => {
  // Il printer è un singleton di modulo: ogni prova riparte da capo.
  vi.resetModules()
  localStorage.clear()
  finestre = []
  window.open = vi.fn(() => {
    const scritto = []
    finestre.push(scritto)
    return { document: { write: (h) => scritto.push(h), close: () => {} }, focus: () => {} }
  })
  window.Image = class {
    constructor() {
      this.width = 400
      this.height = 200
    }
    set src(_v) {
      queueMicrotask(() => this.onerror?.(new Error('404')))
    }
  }
  vi.useFakeTimers({ now: Date.parse('2026-08-22T21:30:00.000Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

const carta = () => {
  const html = (finestre[0] || []).join('')
  return html.match(/<pre>([\s\S]*?)<\/pre>/)?.[1] ?? ''
}

// Le impostazioni del locale, come le lascia `subscribeSettings` per chi
// stampa: nella memoria del terminale, mai da chiedere alla rete.
const impostazioniDelBar = (dati) => localStorage.setItem('tana:impostazioni', JSON.stringify(dati))

const CONTO = {
  id: 'o1',
  daily_number: 3,
  status: 'pagato',
  created_at: '2026-08-22T21:00:00.000Z',
  total: 22,
  payment_method: 'contanti',
  order_items: [{ qty: 2, name: 'Negroni', unit_price: 11 }],
}

// La riga IVA dello scontrino: «IVA 10.0% (A)   2.00€».
const rigaIva = async (order = CONTO) => {
  const printer = await import('../../src/lib/printer.js')
  await printer.printScontrino(order)
  return carta()
    .split('\n')
    .map((r) => r.trim().replace(/\s+/g, ' '))
    .find((r) => r.startsWith('IVA'))
}

describe('l’aliquota dello scontrino viene dalle impostazioni del locale', () => {
  it('senza niente scelto è il 10 della somministrazione, come è sempre stato', async () => {
    expect(await rigaIva()).toBe('IVA 10.0% (A) 2.00€')
  })

  it('cambiando `sale_vat` cambia la riga IVA sulla carta', async () => {
    impostazioniDelBar({ sale_vat: 22 })
    expect(await rigaIva()).toBe('IVA 22.0% (A) 3.97€')
  })

  // CHI AVEVA UN'ALIQUOTA DIVERSA NEL BROWSER: si ignora, e basta. Quel
  // valore resta scritto nella memoria del terminale — non c'è migrazione
  // da far girare — ma non lo legge più nessuno.
  it('un `ivaRate` vecchio rimasto nel browser non conta più niente', async () => {
    localStorage.setItem('tana_printer_v2', JSON.stringify({ ivaRate: 4 }))
    impostazioniDelBar({ sale_vat: 10 })
    expect(await rigaIva()).toBe('IVA 10.0% (A) 2.00€')
  })

  // LO SCONTRINO PRIMA E DOPO, quando i due valori coincidevano: identico.
  // È la prova che nessun locale si sveglia con la carta cambiata.
  it('quando le due aliquote coincidevano, la carta è la stessa', async () => {
    localStorage.setItem('tana_printer_v2', JSON.stringify({ ivaRate: 10 }))
    impostazioniDelBar({ sale_vat: 10 })
    const conVecchia = await rigaIva()
    vi.resetModules()
    localStorage.clear()
    finestre = []
    impostazioniDelBar({ sale_vat: 10 })
    expect(await rigaIva()).toBe(conVecchia)
  })
})

describe('aliquotaScontrino: la regola, senza stampante', () => {
  it('legge `sale_vat` dalle impostazioni del bar', async () => {
    const { aliquotaScontrino } = await import('../../src/lib/printer.js')
    expect(aliquotaScontrino({ sale_vat: 22 })).toBe(22)
  })

  it('uno ZERO è un’aliquota vera: non si scorpora niente', async () => {
    const { aliquotaScontrino } = await import('../../src/lib/printer.js')
    expect(aliquotaScontrino({ sale_vat: 0 })).toBe(0)
  })

  it('assente o storta torna al 10 della somministrazione', async () => {
    const { aliquotaScontrino, ALIQUOTA_DEFAULT } = await import('../../src/lib/printer.js')
    expect(ALIQUOTA_DEFAULT).toBe(10)
    for (const v of [undefined, null, '', 'dieci', NaN]) {
      expect(aliquotaScontrino({ sale_vat: v })).toBe(10)
    }
    expect(aliquotaScontrino({})).toBe(10)
  })

  it('l’aliquota non sta più fra le impostazioni della stampante', async () => {
    const { DEFAULT_PRINTER_SETTINGS } = await import('../../src/lib/printer.js')
    expect(DEFAULT_PRINTER_SETTINGS).not.toHaveProperty('ivaRate')
  })
})
