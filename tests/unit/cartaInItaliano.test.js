// @vitest-environment happy-dom
// LO SCONTRINO RESTA IN ITALIANO ANCHE COL GESTIONALE IN INGLESE (REQ-UI-039).
//
// Le stesse etichette vanno a schermo e sulla carta: a schermo seguono la
// lingua di chi guarda, sullo scontrino — un documento fiscale italiano, e la
// comanda che legge il banco — restano in italiano. È il comportamento di
// partenza delle funzioni condivise (printer.js le chiama senza opzioni), e
// qui lo si fissa: dalla revisione del 17/11, niente lo impediva.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { impostaLingua } from '../../src/lib/lingua.js'
import { scontiDelConto, etichettaSconto, dettaglioIncassi } from '../../src/lib/pagamento.js'
import { STATUS_LABELS, PAYMENT_METHOD_PRINT, CANCEL_PHRASES, ORDER_STATUSES } from '../../src/lib/orderStatus.js'

const conto = {
  total: 20,
  discount: { type: 'percent', value: 10 },
  discount_items: [{ qty: 2 }],
  payments: [{ amount: 10, method: 'carta', sconto: { type: 'importo', amount: 2, items: [{ qty: 1 }] } }],
  sconto_preparato: 2,
}

beforeEach(() => impostaLingua('en'))
afterEach(() => impostaLingua('it'))

describe('con la lingua inglese, quello che va su carta resta italiano', () => {
  it('le etichette degli sconti, senza { aSchermo }', () => {
    expect(etichettaSconto({ type: 'percent', value: 10 })).toBe('Sconto 10%')
    expect(etichettaSconto({ type: 'buono' })).toBe('Buono')
    expect(etichettaSconto({ type: 'importo', items: [{ qty: 2 }] })).toBe('Sconto su 2 prodotti')
    for (const s of scontiDelConto(conto)) expect(s.etichetta).toMatch(/^(Sconto|Buono)/)
    for (const p of dettaglioIncassi(conto).incassi) if (p.sconto) expect(p.sconto.etichetta).toMatch(/^Sconto/)
  })

  it('e a schermo, con { aSchermo: true }, sono in inglese', () => {
    expect(etichettaSconto({ type: 'percent', value: 10 }, { aSchermo: true })).toBe('Discount 10%')
    expect(etichettaSconto({ type: 'importo', items: [{ qty: 1 }] }, { aSchermo: true })).toMatch(/on 1 item$/)
  })

  it('le tabelle che finiscono su carta o al cliente', () => {
    expect(STATUS_LABELS[ORDER_STATUSES.RICEVUTO]).toBe('Ordine ricevuto')
    expect(PAYMENT_METHOD_PRINT.banco).toBe('Contante')
    expect(CANCEL_PHRASES.bancone).toBe('Prego recarsi al bancone.')
  })
})
