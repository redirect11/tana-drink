// @vitest-environment happy-dom
'use strict'

// LE IMPOSTAZIONI DELL'ULTIMA VOLTA. Arrivano da Firestore, e per un
// istante non ci sono: la schermata si disegna coi valori di partenza e
// poi si corregge. Quando l'impostazione decide un COLORE si vede —
// aprendo un conto le strisce comparivano colorate e sparivano un attimo
// dopo, in un locale che le aveva spente.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ricordaImpostazioni,
  impostazioniRicordate,
  corsieNascoste,
  ricordaCorsieNascoste,
  vistaCorsie,
  ricordaVistaCorsie,
  azioniContoRidotte,
  ricordaAzioniContoRidotte,
  prontoDiviso,
  ricordaProntoDiviso,
} from '../../src/lib/impostazioniLocali.js'

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

// LE PREFERENZE DEL DISPOSITIVO. Sono cinque coppie leggi/scrivi che
// facevano cinque volte lo stesso try/catch; adesso il try/catch è uno solo,
// e queste prove ci stanno attorno — perché la risposta a «la memoria non
// c'è» dev'essere la stessa per tutte, e non è più scritta cinque volte.
describe('le preferenze di questo terminale', () => {
  it('quando non si è mai scelto niente, ognuna dice il suo «non lo so»', () => {
    expect(corsieNascoste()).toBe(null)
    expect(vistaCorsie()).toBe(null)
    expect(azioniContoRidotte()).toBe(false)
    expect(prontoDiviso()).toBe(false)
  })

  it('quello che si sceglie si ritrova', () => {
    ricordaCorsieNascoste(['da-fare', 'da-fare', 'al-banco'])
    ricordaVistaCorsie('comande')
    ricordaAzioniContoRidotte(true)
    ricordaProntoDiviso(true)
    expect(corsieNascoste()).toEqual(['da-fare', 'al-banco'])
    expect(vistaCorsie()).toBe('comande')
    expect(azioniContoRidotte()).toBe(true)
    expect(prontoDiviso()).toBe(true)
  })

  it('tornando indietro la scelta si cancella davvero', () => {
    ricordaVistaCorsie('conti')
    ricordaAzioniContoRidotte(true)
    ricordaVistaCorsie(null)
    ricordaAzioniContoRidotte(false)
    expect(vistaCorsie()).toBe(null)
    expect(azioniContoRidotte()).toBe(false)
  })

  it('«unite» resta scritto: è una scelta, non un silenzio', () => {
    // Il pronto diviso è l'unica che scrive anche il «no»: serve a
    // distinguere chi ha deciso di tenerle unite da chi non ha deciso.
    ricordaProntoDiviso(false)
    expect(localStorage.getItem('tana:corsie:pronto-diviso')).toBe('0')
    expect(prontoDiviso()).toBe(false)
  })

  it('roba illeggibile non fa saltare niente: decide il default', () => {
    localStorage.setItem('tana:corsie:nascoste', '{rotto')
    localStorage.setItem('tana:corsie:vista', 'boh')
    expect(corsieNascoste()).toBe(null)
    expect(vistaCorsie()).toBe(null)
  })
})
