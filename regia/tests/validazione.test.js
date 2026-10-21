'use strict'

// I CONTROLLI DELLA REGISTRAZIONE (REQ-FLOTTA-003): partita IVA e codice
// fiscale con la cifra di controllo, password seria, fattura elettronica
// con PEC o SDI, consensi obbligatori. Puri e provati, perché il modulo
// li usa passo per passo e le regole Firestore li ripetono in piccolo.

import { describe, it, expect } from 'vitest'
import {
  validaPartitaIva,
  validaCodiceFiscale,
  problemaPassword,
  problemiAccount,
  problemiLocale,
  problemiFatturazione,
  problemiReferente,
} from '../src/lib/validazione.js'

describe('partita IVA', () => {
  it('accetta una partita IVA con la cifra di controllo giusta, anche con IT davanti', () => {
    expect(validaPartitaIva('00000000000')).toBe(true)
    expect(validaPartitaIva('IT 01234567897')).toBe(true)
    expect(validaPartitaIva('12345678901')).toBe(false)
    expect(validaPartitaIva('1234567890')).toBe(false)
  })
})

describe('codice fiscale', () => {
  it('persona con la lettera di controllo, o società con la partita IVA', () => {
    expect(validaCodiceFiscale('RSSMRA80A01H501U')).toBe(true)
    expect(validaCodiceFiscale('rssmra80a01h501u')).toBe(true)
    expect(validaCodiceFiscale('RSSMRA80A01H501A')).toBe(false)
    expect(validaCodiceFiscale('01234567897')).toBe(true)
    expect(validaCodiceFiscale('ABC')).toBe(false)
  })
})

describe('password', () => {
  it('almeno 10 caratteri con lettere e una cifra', () => {
    expect(problemaPassword('corta1')).toMatch(/10/)
    expect(problemaPassword('sololettereee')).toMatch(/cifra/)
    expect(problemaPassword('bar-mario-2026')).toBeNull()
  })
})

describe('i quattro passi', () => {
  it('account: email valida, password seria, ripetuta uguale', () => {
    expect(problemiAccount({ email: 'x', password: 'bar-mario-2026', conferma: 'altra' })).toEqual({
      email: expect.any(String),
      conferma: expect.any(String),
    })
    expect(problemiAccount({ email: 'mario@example.it', password: 'bar-mario-2026', conferma: 'bar-mario-2026' })).toEqual({})
  })

  it('locale: nome, tipo, indirizzo completo, telefono', () => {
    const p = problemiLocale({ nome: '', tipo: 'x', via: '', cap: '123', citta: '', provincia: 'Napoli', telefono: '' })
    expect(Object.keys(p).sort()).toEqual(['cap', 'citta', 'nome', 'provincia', 'telefono', 'tipo', 'via'])
    expect(problemiLocale({ nome: 'Bar Mario', tipo: 'bar', via: 'Via Roma 1', cap: '80035', citta: 'Nola', provincia: 'na', telefono: '081 1234567' })).toEqual({})
  })

  it('fatturazione: ragione sociale, partita IVA buona, PEC o SDI, sede se diversa', () => {
    const base = { ragione_sociale: 'Bar Mario srl', partita_iva: '01234567897', codice_fiscale: '', pec: '', sdi: '', stessa_sede: true }
    expect(problemiFatturazione(base)).toEqual({ pec: expect.stringMatching(/PEC o il codice destinatario/) })
    expect(problemiFatturazione({ ...base, sdi: 'ABCDEFG' })).toEqual({})
    expect(problemiFatturazione({ ...base, pec: 'bar@pec.it' })).toEqual({})
    expect(problemiFatturazione({ ...base, pec: 'bar@pec.it', partita_iva: '12345678901' })).toEqual({ partita_iva: expect.any(String) })
    expect(problemiFatturazione({ ...base, pec: 'bar@pec.it', stessa_sede: false, via: '', cap: '', citta: '', provincia: '' })).toEqual({
      via: expect.any(String),
      cap: expect.any(String),
      citta: expect.any(String),
      provincia: expect.any(String),
    })
  })

  it('referente: nome, cognome e i due consensi obbligatori', () => {
    expect(problemiReferente({ nome: '', cognome: '', telefono: '', termini: false, privacy: false })).toEqual({
      nome: expect.any(String),
      cognome: expect.any(String),
      termini: expect.any(String),
      privacy: expect.any(String),
    })
    expect(problemiReferente({ nome: 'Mario', cognome: 'Rossi', telefono: '', termini: true, privacy: true })).toEqual({})
  })
})
