'use strict'

// IL CLIENTE (REQ-FLOTTA-003): lo slug dal nome del locale è il prefisso
// del progetto Firebase dell'istanza, quindi vale la regola dei project id;
// il documento nasce a blocchi, con i consensi datati.

import { describe, it, expect } from 'vitest'
import { slugDi, problemaSlug, nuovoCliente, contattoDi } from '../src/lib/clienti.js'

describe('slugDi', () => {
  it('minuscole, senza accenti, trattini', () => {
    expect(slugDi('La Tana del Coniglio')).toBe('la-tana-del-coniglio')
    expect(slugDi('  Caffè  Sant’Anna  ')).toBe('caffe-sant-anna')
    expect(slugDi('Bar 2000!!')).toBe('bar-2000')
  })

  it('non supera i 30 caratteri e non finisce con un trattino', () => {
    const lungo = slugDi('Un nome di locale davvero molto lungo per un bar')
    expect(lungo.length).toBeLessThanOrEqual(30)
    expect(lungo).not.toMatch(/-$/)
  })
})

describe('problemaSlug', () => {
  it('accetta uno slug buono e spiega quelli cattivi', () => {
    expect(problemaSlug('bar-mario')).toBeNull()
    expect(problemaSlug('')).toMatch(/nome/)
    expect(problemaSlug('bar')).toMatch(/corto/)
    expect(problemaSlug('1bar-mario')).toMatch(/lettera/)
    expect(problemaSlug('demo')).toMatch(/riservato|corto/)
  })
})

describe('nuovoCliente', () => {
  const dati = {
    uid: 'u1',
    email: ' Mario@Example.IT ',
    locale: { nome: ' Bar Mario ', tipo: 'bar', via: 'Via Roma 1', cap: '80035', citta: 'Nola', provincia: 'na', telefono: '081 1234567', sito: '' },
    fatturazione: { ragione_sociale: 'Bar Mario srl', partita_iva: 'IT01234567897', codice_fiscale: '', pec: 'Bar@PEC.it', sdi: '', stessa_sede: true },
    referente: { nome: 'Mario', cognome: 'Rossi', ruolo: 'titolare', telefono: '', marketing: false },
    adesso: new Date('2026-10-22T10:00:00Z'),
  }

  it('nasce a blocchi, con slug, email pulita, sede legale uguale al locale e consensi datati', () => {
    const c = nuovoCliente(dati)
    expect(c.versione_schema).toBe(2)
    expect(c.email).toBe('mario@example.it')
    expect(c.nome_locale).toBe('Bar Mario')
    expect(c.slug).toBe('bar-mario')
    expect(c.locale.indirizzo).toEqual({ via: 'Via Roma 1', cap: '80035', citta: 'Nola', provincia: 'NA' })
    expect(c.fatturazione.partita_iva).toBe('01234567897')
    expect(c.fatturazione.pec).toBe('bar@pec.it')
    expect(c.fatturazione.sede_legale).toEqual(c.locale.indirizzo)
    expect(c.referente).toEqual({ nome: 'Mario', cognome: 'Rossi', ruolo: 'titolare', telefono: '' })
    expect(c.consensi).toEqual({ termini_il: '2026-10-22T10:00:00.000Z', privacy_il: '2026-10-22T10:00:00.000Z', marketing: false })
    expect(c.creato_il).toBe('2026-10-22T10:00:00.000Z')
  })

  it('con la sede legale diversa la tiene a parte', () => {
    const c = nuovoCliente({ ...dati, fatturazione: { ...dati.fatturazione, stessa_sede: false, via: 'Via Sede 2', cap: '80100', citta: 'Napoli', provincia: 'na' } })
    expect(c.fatturazione.sede_legale).toEqual({ via: 'Via Sede 2', cap: '80100', citta: 'Napoli', provincia: 'NA' })
  })

  it('con un nome che non dà uno slug valido si ferma', () => {
    expect(() => nuovoCliente({ ...dati, locale: { ...dati.locale, nome: 'Bar' } })).toThrow(/corto/)
  })

  it('contattoDi legge il referente, o il contatto dei documenti vecchi', () => {
    expect(contattoDi(nuovoCliente(dati))).toBe('Mario Rossi')
    expect(contattoDi({ contatto: 'Giulia' })).toBe('Giulia')
    expect(contattoDi({})).toBe('')
  })
})
