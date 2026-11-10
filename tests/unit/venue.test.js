'use strict'

// IL LOCALE È UN DATO (REQ-VENUE-001, REQ-VENUE-003). Due strati e una
// riserva: le impostazioni vincono sulla build, la build sulla riserva
// neutra; una chiave vuota non cancella quella sotto. Nei test la build è
// quella della Tana (vitest.config.mjs), come in produzione.

import { describe, it, expect } from 'vitest'
import { NOME_PRODOTTO } from '../../src/lib/prodotto.js'
import { VENUE_NEUTRO, venueDi, venuePredefinito, intestazioneScontrino, socialDaTesto, socialInTesto, VENUE_VUOTO, CHIAVI_VENUE, CLIENTE, pressoIlLocale, righeFiscali } from '../../src/lib/venue.js'

describe('venueDi', () => {
  it('senza impostazioni vale la build: la Tana', () => {
    const v = venuePredefinito()
    expect(CLIENTE).toBe('tana')
    expect(v.venue_name).toBe('La Tana del Coniglio')
    expect(v.venue_short_name).toBe('La Tana')
    expect(v.venue_legal_name).toBe('EFFEVI - SRLS')
    expect(v.venue_socials.map((s) => s.piattaforma)).toContain('instagram')
  })

  it('le impostazioni vincono, chiave per chiave', () => {
    const v = venueDi({ venue_name: 'Bar Mario', venue_socials: [{ piattaforma: 'facebook', href: 'https://fb.example/mario' }] })
    expect(v.venue_name).toBe('Bar Mario')
    // Non scritta: resta la build.
    expect(v.venue_address).toBe('Corso Tommaso Vitale 87/89')
    expect(v.venue_socials).toEqual([{ piattaforma: 'facebook', href: 'https://fb.example/mario' }])
  })

  it('una chiave vuota nelle impostazioni non cancella la build', () => {
    const v = venueDi({ venue_name: '', venue_socials: [], venue_email: null })
    expect(v.venue_name).toBe('La Tana del Coniglio')
    expect(v.venue_email).toBe('info@latanadelconiglio.it')
    expect(v.venue_socials.length).toBeGreaterThan(0)
  })

  // Un locale senza nome, né nella build né nelle impostazioni, si chiama
  // come il prodotto: è un segnaposto, e non il nome di un altro locale.
  it('la riserva neutra porta il nome del prodotto', () => {
    expect(VENUE_NEUTRO.venue_name).toBe(NOME_PRODOTTO)
    expect(VENUE_NEUTRO.venue_name).toBe('Lime - SmartOrders')
    expect(VENUE_NEUTRO.venue_short_name).toBe('Lime')
    expect(JSON.stringify(VENUE_NEUTRO)).not.toMatch(/Tana/)
  })

  it('DEFAULT_SETTINGS parte con tutte le chiavi vuote', () => {
    expect(Object.keys(VENUE_VUOTO)).toEqual(CHIAVI_VENUE)
    expect(VENUE_VUOTO.venue_name).toBe('')
    expect(VENUE_VUOTO.venue_socials).toEqual([])
  })
})

// «Benvenuto alla Tana del Coniglio» deve restare quello che era: la
// preposizione non si ricava dal nome («da La Tana del Coniglio» non lo
// dice nessuno), quindi il locale la scrive, e senza si ripiega su «da».
describe('pressoIlLocale', () => {
  it('per la Tana è quello di sempre', () => {
    expect(pressoIlLocale(venuePredefinito())).toBe('alla Tana del Coniglio')
  })

  it('un locale che non l’ha scritta ripiega su «da <nome>»', () => {
    expect(pressoIlLocale({ venue_name: 'Bar Mario', venue_presso: '' })).toBe('da Bar Mario')
    expect(pressoIlLocale(venueDi({ venue_presso: 'al Bar Mario' }))).toBe('al Bar Mario')
  })
})

describe('intestazioneScontrino', () => {
  it('sono i quattro campi che printer.js stampa', () => {
    expect(intestazioneScontrino(venuePredefinito())).toEqual({
      businessName: 'La Tana del Coniglio',
      businessAddress: 'Corso Tommaso Vitale 87/89',
      businessCity: '80035 Nola - Italy',
      businessFooter: 'EFFEVI - SRLS',
    })
  })
})

describe('i social in Impostazioni, una riga per social', () => {
  it('da testo a elenco e ritorno', () => {
    const testo = 'instagram https://instagram.com/bar\nhttps://bar.example'
    expect(socialDaTesto(testo)).toEqual([
      { piattaforma: 'instagram', href: 'https://instagram.com/bar' },
      { piattaforma: 'link', href: 'https://bar.example' },
    ])
    expect(socialInTesto(socialDaTesto(testo))).toBe('instagram https://instagram.com/bar\nlink https://bar.example')
    expect(socialDaTesto('')).toEqual([])
  })
})

// I DATI DEL TITOLARE (REQ-FLOTTA-030): la regia li scrive dalla sua
// registrazione, dove sono vuoti; sulle fatture di cortesia ci vogliono
// partita IVA, codice fiscale e sede legale di chi emette.
describe('i dati fiscali del locale', () => {
  it('le chiavi nuove ci sono, vuote di suo', () => {
    for (const k of ['venue_phone', 'venue_vat_number', 'venue_tax_code', 'venue_legal_address']) {
      expect(CHIAVI_VENUE).toContain(k)
      expect(VENUE_VUOTO[k]).toBe('')
    }
  })

  it('sede legale in una riga, partita IVA e codice fiscale nell’altra', () => {
    expect(
      righeFiscali({ venue_vat_number: '01234567890', venue_tax_code: 'RSSMRA80A01F839X', venue_legal_address: 'Via Roma 1, 80035 Nola (NA)' })
    ).toEqual(['Sede legale: Via Roma 1, 80035 Nola (NA)', 'P.IVA 01234567890 · C.F. RSSMRA80A01F839X'])
  })

  it('il codice fiscale uguale alla partita IVA non si ripete; niente righe vuote', () => {
    expect(righeFiscali({ venue_vat_number: '01234567890', venue_tax_code: '01234567890' })).toEqual(['P.IVA 01234567890'])
    expect(righeFiscali({})).toEqual([])
  })
})
