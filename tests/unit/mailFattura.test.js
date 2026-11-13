'use strict'

// LA MAIL DI UNA FATTURA DI CORTESIA (REQ-FLOTTA-030). Era scritta due volte,
// nella schermata di pagamento e nell'elenco delle fatture, e i dati
// fiscali di chi emette erano finiti in una sola: la mail mandata subito
// dopo l'incasso, la più frequente, ne restava senza.

import { describe, it, expect } from 'vitest'
import { mailFattura } from '../../src/lib/mailFattura.js'

const FATTURA = {
  number: '4/2026',
  total: 16,
  discount_amount: 0,
  customer: { denominazione: 'Rossi Srl', piva: '09876543210', email: 'amministrazione@rossi.it' },
  items: [{ qty: 2, name: 'Negroni', unit_price: 8 }],
}

const corpo = (mailto) => decodeURIComponent(mailto.split('body=')[1])

describe('la mail della fattura di cortesia', () => {
  it('va al cliente, col numero nell’oggetto', () => {
    const m = mailFattura(FATTURA, { nomeLocale: 'La Tana' })
    expect(m.startsWith('mailto:amministrazione%40rossi.it?subject=')).toBe(true)
    expect(decodeURIComponent(m)).toContain('Fattura di cortesia n. 4/2026')
  })

  it('dice chi la emette, coi dati fiscali, e a chi è intestata', () => {
    const testo = corpo(mailFattura(FATTURA, { nomeLocale: 'La Tana', datiFiscali: ['Sede legale: Via Roma 1', 'P.IVA 01234567890'] }))
    expect(testo.split('\n').slice(0, 4)).toEqual(['Fattura di cortesia n. 4/2026', 'La Tana', 'Sede legale: Via Roma 1', 'P.IVA 01234567890'])
    expect(testo).toContain('Intestata a: Rossi Srl')
    expect(testo).toContain('P.IVA: 09876543210')
    expect(testo).toContain('2x Negroni')
    expect(testo).toContain('Documento non fiscale — copia di cortesia.')
  })

  it('senza dati fiscali niente righe vuote in più', () => {
    const testo = corpo(mailFattura(FATTURA, { nomeLocale: 'La Tana' }))
    expect(testo.split('\n').slice(0, 3)).toEqual(['Fattura di cortesia n. 4/2026', 'La Tana', ''])
  })
})
