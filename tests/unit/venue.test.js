'use strict'

// IL LOCALE È UN DATO (REQ-VENUE-001, REQ-VENUE-003). Due strati e una
// riserva: le impostazioni vincono sulla build, la build sulla riserva
// neutra; una chiave vuota non cancella quella sotto. Nei test la build è
// quella della Tana (vitest.config.mjs), come in produzione.

import { describe, it, expect } from 'vitest'
import {
  venueDi,
  venuePredefinito,
  intestazioneScontrino,
  socialDaTesto,
  socialInTesto,
  VENUE_VUOTO,
  CHIAVI_VENUE,
  CLIENTE,
  pressoIlLocale,
} from '../../src/lib/venue.js'

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
