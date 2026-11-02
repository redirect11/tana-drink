'use strict'

// ── LA LICENZA IN VIGORE, ADESSO (REQ-LIC-009) ────────────────────────
//
// L'utente, 02/11/2026: «se non c'è nessuna licenza non dovrebbe partire
// proprio il prodotto, o licenza scaduta […] al massimo, se dalla regia è
// attiva l'opzione, dovrebbe diventare versione free ma senza far perdere i
// dati al cliente». La scadenza si guarda a ogni domanda con l'orologio del
// dispositivo: anche senza rete, anche con l'app aperta da ieri.

import { describe, it, expect } from 'vitest'
import { inVigore, licenzaDi, scadenzaDi, LIMITI_FREE, SCADUTA } from '../../src/lib/licenzaInVigore.js'
import { installazioneBloccata, moduloIncluso, statoLicenza } from '../../src/lib/licenza.js'
import { pianoFree, scontiConsentiti, maxProdotti } from '../../src/lib/limiti.js'

const OGGI = new Date('2026-11-02T12:00:00Z')
const COMPLETA = { piano: 'completo', stato: 'attiva', moduli: { magazzino: true, sumup: true }, regia_url: 'https://x' }

describe('senza licenza non c’è niente', () => {
  it('niente licenza nota: null, e nessuna ricaduta su una licenza scritta altrove', () => {
    expect(licenzaDi({}, OGGI)).toBeNull()
    expect(licenzaDi(null, OGGI)).toBeNull()
    expect(inVigore('tutto', OGGI)).toBeNull()
  })
})

describe('prima della scadenza, o senza scadenza', () => {
  it('vale quella scritta, così com’è', () => {
    expect(inVigore(COMPLETA, OGGI)).toBe(COMPLETA)
    const fino = { ...COMPLETA, valida_fino: '2026-11-30T04:00:00Z', alla_scadenza: 'ferma' }
    expect(inVigore(fino, OGGI)).toBe(fino)
  })

  it('una data che non si legge non ferma il locale', () => {
    const storta = { ...COMPLETA, valida_fino: 'fine mese', alla_scadenza: 'ferma' }
    expect(scadenzaDi(storta)).toBeNull()
    expect(inVigore(storta, OGGI)).toBe(storta)
  })
})

describe('passata la scadenza', () => {
  const scaduta = (alla) => ({ ...COMPLETA, valida_fino: '2026-11-01T04:00:00Z', alla_scadenza: alla })

  it('con «ferma» l’installazione è scaduta e si ferma, coi dati che restano', () => {
    const l = inVigore(scaduta('ferma'), OGGI)
    expect(l.stato).toBe(SCADUTA)
    expect(l.scaduta_il).toBe('2026-11-01T04:00:00Z')
  })

  it('senza dire cosa fare, si ferma: il Free va chiesto', () => {
    expect(inVigore(scaduta(undefined), OGGI).stato).toBe(SCADUTA)
  })

  it('con «free» si lavora col Free: nessun modulo, coi limiti del Free, e la regia resta', () => {
    const l = inVigore(scaduta('free'), OGGI)
    expect(l.piano).toBe('free')
    expect(l.moduli).toEqual({})
    expect(l.limiti).toEqual(LIMITI_FREE)
    expect(l.regia_url).toBe('https://x')
    expect(l.stato).toBe('attiva')
  })

  it('le domande delle schermate seguono la licenza in vigore', () => {
    // Le funzioni delle schermate guardano l'ora vera: la scadenza qui è
    // nel passato remoto, così vale qualunque giorno girino.
    const free = { licenza: { ...COMPLETA, valida_fino: '2020-01-01T04:00:00Z', alla_scadenza: 'free' } }
    expect(installazioneBloccata(free)).toBe(false)
    expect(pianoFree(free)).toBe(true)
    expect(moduloIncluso(free, 'magazzino')).toBe(false)
    expect(scontiConsentiti(free)).toBe(false)
    expect(maxProdotti(free)).toBe(10)

    const ferma = { licenza: { ...COMPLETA, valida_fino: '2020-01-01T04:00:00Z', alla_scadenza: 'ferma' } }
    expect(installazioneBloccata(ferma)).toBe(true)
    expect(statoLicenza(ferma)).toBe(SCADUTA)
  })
})
