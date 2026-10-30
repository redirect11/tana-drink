// @vitest-environment happy-dom
'use strict'

// LA FIRMA DEL PRODOTTO IN FONDO ALLO SCONTRINO (REQ-LIC-003,
// `limiti.marchio`). Il piano Free porta una riga «Creato con <nome del
// prodotto>» in fondo allo scontrino; nessun altro piano, e soprattutto non
// la Tana, che una licenza non ce l'ha. Si guarda la carta: in locale la
// stampante è finta e ogni lavoro apre il suo facsimile (come in
// campiDiStampa.test.js, che tiene fermo lo scontrino di sempre).

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
  window.Image = class {
    set src(_v) {
      queueMicrotask(() => this.onerror?.(new Error('404')))
    }
  }
  vi.useFakeTimers({ now: Date.parse('2026-10-30T21:30:00.000Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

// L'ultima riga scritta, prima del taglio della carta.
const ultimaRiga = (testo) =>
  testo
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r && !/^[─-]+$/.test(r))
    .at(-1)

const carta = (n = 0) => (finestre[n] || []).join('').match(/<pre>([\s\S]*?)<\/pre>/)?.[1] ?? ''
const impostazioni = (dati) => localStorage.setItem('drink:impostazioni', JSON.stringify(dati))

const CONTO = {
  id: 'conto-free',
  daily_number: 3,
  status: 'pagato',
  created_at: '2026-10-30T21:00:00.000Z',
  total: 8,
  payment_method: 'contanti',
  order_items: [{ qty: 1, name: 'Negroni', unit_price: 8 }],
  comande: [{ id: 'c1', status: 'ricevuto', items: [{ qty: 1, name: 'Negroni', unit_price: 8 }] }],
}

const stampa = async (quale = 'scontrino') => {
  const printer = await import('../../src/lib/printer.js')
  printer.impostaUtenteStampante('u1', { name: 'Titolare' })
  if (quale === 'acconto') await printer.printScontrinoAcconto(CONTO, { amount: 4, method: 'banco' })
  else await printer.printScontrino(CONTO)
  return carta()
}

describe('la firma del prodotto', () => {
  it('nel piano Free esce in fondo allo scontrino', async () => {
    impostazioni({ licenza: { piano: 'free', limiti: { marchio: true } } })
    const testo = await stampa()
    expect(ultimaRiga(testo)).toBe('Creato con Drink')
  })

  it('e in fondo alla ricevuta d’acconto', async () => {
    impostazioni({ licenza: { piano: 'free', limiti: { marchio: true } } })
    const testo = await stampa('acconto')
    expect(ultimaRiga(testo)).toBe('Creato con Drink')
  })

  it('senza limiti nella licenza non c’è: lo scontrino della Tana è quello di sempre', async () => {
    const testo = await stampa()
    expect(testo).not.toMatch(/Creato con/)
    expect(testo).toMatch(/L a   T a n a/)
  })

  it('né in un piano a pagamento', async () => {
    impostazioni({ licenza: { piano: 'pro', limiti: null } })
    expect(await stampa()).not.toMatch(/Creato con/)
  })
})
