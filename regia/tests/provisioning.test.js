'use strict'

// L'ATTIVAZIONE DI UN'ISTANZA (REQ-FLOTTA-006): dalla richiesta al lancio
// del workflow, e dall'esito ai documenti. Logica pura delle Functions.

import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { dispatchPayload, daLanciare, esitoValido, documentoIstanza, bearerValido } = require('../functions/lib/provisioning.js')

const richiesta = { uid: 'u1', slug: 'bar-mario', nome_locale: 'Bar Mario', piano: 'base', moduli: ['staff', 'magazzino'], stato: 'in coda' }

describe('dispatchPayload', () => {
  it('è il corpo del workflow_dispatch, con gli input come stringhe', () => {
    expect(dispatchPayload(richiesta, { ref: 'develop' })).toEqual({
      ref: 'develop',
      inputs: { slug: 'bar-mario', nome_locale: 'Bar Mario', piano: 'base', moduli: 'staff,magazzino', uid: 'u1' },
    })
  })

  it('senza uno slug valido non parte niente', () => {
    expect(() => dispatchPayload({ slug: 'X' })).toThrow(/slug/)
  })
})

describe('daLanciare', () => {
  it('una richiesta nuova in coda parte; in corso o attiva no', () => {
    expect(daLanciare(null, richiesta)).toBe(true)
    expect(daLanciare(null, { ...richiesta, stato: 'in corso' })).toBe(false)
  })

  it('un rilancio dell’admin parte; un altro aggiornamento no', () => {
    const inErrore = { ...richiesta, stato: 'errore' }
    expect(daLanciare(inErrore, { ...richiesta, rilanciata_il: 'x' })).toBe(true)
    const inCoda = { ...richiesta, rilanciata_il: 'x' }
    expect(daLanciare(inCoda, { ...inCoda, nota: 'ritoccata' })).toBe(false)
    expect(daLanciare(inCoda, { ...inCoda, rilanciata_il: 'y' })).toBe(true)
  })
})

describe('esitoValido e documentoIstanza', () => {
  it('accetta solo slug e stati noti, e riempie il documento senza perdere quello che c’era', () => {
    expect(esitoValido({ slug: 'bar-mario', stato: 'boh' })).toBeNull()
    expect(esitoValido(null)).toBeNull()
    const esito = esitoValido({ slug: 'bar-mario', stato: 'attiva', url: 'https://bar-mario.drink.app', versione: 'v1.10.0' })
    const doc = documentoIstanza(esito, { uid: 'u1', progetto: 'drinkpos-bar-mario' }, new Date('2026-10-22T10:00:00Z'))
    expect(doc).toEqual({
      uid: 'u1',
      slug: 'bar-mario',
      stato: 'attiva',
      url: 'https://bar-mario.drink.app',
      progetto: 'drinkpos-bar-mario',
      versione: 'v1.10.0',
      errore: null,
      aggiornata_il: '2026-10-22T10:00:00.000Z',
    })
  })

  it('un errore porta il suo messaggio, o uno di riserva', () => {
    expect(esitoValido({ slug: 'bar-mario', stato: 'errore' }).errore).toBe('Attivazione fallita')
    expect(esitoValido({ slug: 'bar-mario', stato: 'errore', errore: 'quota' }).errore).toBe('quota')
  })
})

describe('bearerValido', () => {
  it('vuole esattamente il segreto', () => {
    expect(bearerValido('Bearer abc', 'abc')).toBe(true)
    expect(bearerValido('Bearer abd', 'abc')).toBe(false)
    expect(bearerValido('abc', 'abc')).toBe(false)
    expect(bearerValido('Bearer abc', '')).toBe(false)
  })
})
