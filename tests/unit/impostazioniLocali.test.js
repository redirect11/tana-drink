// @vitest-environment happy-dom
'use strict'

// LE IMPOSTAZIONI DELL'ULTIMA VOLTA. Arrivano da Firestore, e per un
// istante non ci sono: la schermata si disegna coi valori di partenza e
// poi si corregge. Quando l'impostazione decide un COLORE si vede —
// aprendo un conto le strisce comparivano colorate e sparivano un attimo
// dopo, in un locale che le aveva spente.

import { describe, it, expect, beforeEach } from 'vitest'
import { ricordaImpostazioni, impostazioniRicordate } from '../../src/lib/impostazioniLocali.js'

const DEFAULTS = { stripe_pos: 'prodotto', queue_view: 'griglia' }

beforeEach(() => localStorage.clear())

describe('le impostazioni ricordate', () => {
  it('la prima volta in assoluto sono i default', () => {
    expect(impostazioniRicordate(DEFAULTS)).toEqual(DEFAULTS)
  })

  it('dopo una risposta del server si riparte da quella', () => {
    ricordaImpostazioni({ stripe_pos: 'spenta' })
    expect(impostazioniRicordate(DEFAULTS).stripe_pos).toBe('spenta')
  })

  it('quello che il server non dice resta al default', () => {
    // Il documento delle impostazioni contiene solo ciò che è stato
    // cambiato: il resto non deve sparire.
    ricordaImpostazioni({ stripe_pos: 'spenta' })
    expect(impostazioniRicordate(DEFAULTS).queue_view).toBe('griglia')
  })

  it('roba illeggibile non fa saltare la schermata', () => {
    localStorage.setItem('tana:impostazioni', '{rotto')
    expect(impostazioniRicordate(DEFAULTS)).toEqual(DEFAULTS)
  })

  it('non si ricorda quello che non è un documento', () => {
    ricordaImpostazioni({ stripe_pos: 'spenta' })
    ricordaImpostazioni(null)
    ricordaImpostazioni('boh')
    expect(impostazioniRicordate(DEFAULTS).stripe_pos).toBe('spenta')
  })

  it('senza default torna comunque un oggetto', () => {
    expect(impostazioniRicordate()).toEqual({})
  })
})
