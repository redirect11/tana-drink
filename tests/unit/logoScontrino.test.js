// @vitest-environment happy-dom
'use strict'

// IL LOGO DELLO SCONTRINO SI TENTA UNA VOLTA SOLA (BUG-032).
//
// La cache usava `null` per dire due cose diverse — «mai provato» e
// «provato, non c'è» — quindi se `logo.png` manca, o non è nella cache del
// service worker, ogni scontrino rifaceva il caricamento e aspettava
// l'errore prima di stampare. La carta usciva dopo, ogni volta: al banco,
// col cliente davanti, è un'attesa che si vede.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Quante volte si è provato a caricare l'immagine, e come va a finire.
const prove = { tentativi: 0, esito: 'errore' }
const ImmagineVera = globalThis.Image

class ImmagineFinta {
  constructor() {
    prove.tentativi += 1
    this.width = 400
    this.height = 200
  }
  set src(_v) {
    // Il caricamento è asincrono anche quando fallisce: l'errore arriva
    // dopo, ed è esattamente l'attesa che il difetto ripeteva.
    queueMicrotask(() => (prove.esito === 'ok' ? this.onload?.() : this.onerror?.(new Error('404'))))
  }
}

// happy-dom non disegna: il canvas c'è ma non ha un contesto 2D. Qui
// serve solo che le chiamate non esplodano — cosa ci finisce sopra lo
// decide la testina, e quello non si prova a schermo.
const contestoVero = globalThis.HTMLCanvasElement?.prototype.getContext
const contestoFinto = () => ({ fillStyle: '', fillRect: () => {}, drawImage: () => {} })

beforeEach(() => {
  prove.tentativi = 0
  prove.esito = 'errore'
  globalThis.Image = ImmagineFinta
  globalThis.HTMLCanvasElement.prototype.getContext = contestoFinto
  // Lo stato del logo vive nel modulo: ogni prova riparte da zero.
  vi.resetModules()
})

afterEach(() => {
  globalThis.Image = ImmagineVera
  globalThis.HTMLCanvasElement.prototype.getContext = contestoVero
})

const carica = async () => (await import('../../src/lib/printer.js')).logoPerStampa

describe('il logo che non c’è', () => {
  it('si prova una volta sola, non a ogni scontrino', async () => {
    const logoPerStampa = await carica()
    expect(await logoPerStampa()).toBeNull()
    expect(await logoPerStampa()).toBeNull()
    expect(await logoPerStampa()).toBeNull()
    // Prima erano tre: tre caricamenti e tre attese dell'errore.
    expect(prove.tentativi).toBe(1)
  })
})

describe('il logo che c’è', () => {
  it('si carica una volta e resta pronto', async () => {
    prove.esito = 'ok'
    const logoPerStampa = await carica()
    const primo = await logoPerStampa()
    expect(primo).toBeTruthy()
    expect(primo.larghezza).toBe(220) // stretto: una testina termica sgrana
    // Stesso disegno, non uno nuovo: è lo stesso pezzo di carta.
    expect(await logoPerStampa()).toBe(primo)
    expect(prove.tentativi).toBe(1)
  })
})
