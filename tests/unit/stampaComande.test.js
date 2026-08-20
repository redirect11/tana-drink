// @vitest-environment happy-dom
'use strict'

// LA STAMPA DELLA COMANDA NON È UN AVVISO (BUG-050).
//
// Per anni l'auto-stampa è vissuta dentro il blocco della notifica «nuovo
// ordine», ereditandone i filtri. Due danni, tutti e due visti al banco:
// l'ordine battuto da QUESTO terminale non stampava mai la comanda («non
// avvisare chi l'ha battuto» è giusto per un beep, non per la stampante),
// e la SECONDA comanda di un conto già aperto non stampava — il blocco
// scattava solo sull'ordine nuovo.
//
// Ora la regola è per COMANDA: esce quello che è ancora al banco, nato da
// poco, una volta sola per terminale. Chiunque l'abbia battuto.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  comandeDaStampare,
  claimComandaPrint,
  releaseComandaPrint,
} from '../../src/lib/printer.js'

const ORA = Date.parse('2026-08-20T21:00:00.000Z')
const nataDa = (ms) => new Date(ORA - ms).toISOString()
const comanda = (over = {}) => ({
  id: 'c1',
  status: 'ricevuto',
  created_at: nataDa(60_000),
  ...over,
})
const conto = (comande, over = {}) => ({ id: 'o1', status: 'aperto', comande, ...over })

beforeEach(() => localStorage.clear())

describe('quali comande si stampano', () => {
  it('quella appena arrivata, chiunque l’abbia battuta: nessun filtro sul terminale', () => {
    // Il conto è battuto da qui (placed_by con device): per l'avviso conta,
    // per la stampante no — e infatti qui placed_by non si guarda proprio.
    const o = conto([comanda()], { placed_by: { name: 'Io', device: 'questo' } })
    expect(comandeDaStampare(o)).toHaveLength(1)
  })

  it('anche la seconda comanda di un conto già aperto', () => {
    const o = conto([
      comanda({ id: 'c1', status: 'pronto' }), // la prima è già avanti
      comanda({ id: 'c2', created_at: nataDa(5_000) }), // questa è appena nata
    ])
    const da = comandeDaStampare(o)
    expect(da.map((c) => c.id)).toEqual(['c2'])
  })

  it('una comanda già pronta o uscita non si stampa: è tardi', () => {
    for (const status of ['pronto', 'ritirato']) {
      expect(comandeDaStampare(conto([comanda({ status })]))).toHaveLength(0)
    }
  })

  it('le annullate e i conti annullati non stampano niente', () => {
    expect(comandeDaStampare(conto([comanda({ status: 'annullato' })]))).toHaveLength(0)
    expect(comandeDaStampare(conto([comanda()], { status: 'annullato' }))).toHaveLength(0)
  })

  // IL SEGNO STA SUL DATO: un browser con la memoria vuota vede
  // `auto_print_at` e non ristampa la serata; il secondo tablet con
  // l'auto-stampa accesa vede il segno del primo e non fa la seconda copia.
  it('una comanda già segnata stampata non si ristampa, da nessun terminale', () => {
    const stampata = comanda({ auto_print_at: nataDa(30_000) })
    expect(comandeDaStampare(conto([stampata]))).toHaveLength(0)
  })
})

describe('una copia per comanda, per terminale', () => {
  it('la pretesa passa una volta e poi mai più: tornare agli ordini non ristampa', () => {
    expect(claimComandaPrint('o1', 'c1')).toBe(true)
    // È il giro che prima «funzionava per sbaglio»: si tornava alla coda,
    // tutto risultava nuovo, e si ristampava. Ora la memoria è del
    // terminale, non della schermata.
    expect(claimComandaPrint('o1', 'c1')).toBe(false)
  })

  it('comande diverse dello stesso conto sono pretese diverse', () => {
    expect(claimComandaPrint('o1', 'c1')).toBe(true)
    expect(claimComandaPrint('o1', 'c2')).toBe(true)
  })

  it('la stampa fallita restituisce la pretesa: al prossimo giro si riprova', () => {
    claimComandaPrint('o1', 'c1')
    releaseComandaPrint('o1', 'c1') // carta finita, stampante spenta
    expect(claimComandaPrint('o1', 'c1')).toBe(true)
  })
})
