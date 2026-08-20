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

// ── IL LOGO CHE NON ARRIVA MAI NON FERMA LA CODA (BUG-053) ───────────
//
// Da quando la stampa è una coda (BUG-052), un lavoro che non finisce
// blocca tutti quelli dopo. `logoPerStampa` aspettava il caricamento
// dell'immagine SENZA tempo massimo: un logo che non arriva mai — rete
// che pende, service worker in stallo — teneva ferma la stampante tutta
// la sera. Tre secondi e si stampa senza logo, una volta sola: il
// fallimento finisce in cache come «provato e non c'è».
describe('il logo ha un tempo massimo', () => {
  it('un caricamento che pende per sempre si arrende da solo', async () => {
    // Un'immagine che non chiama mai né onload né onerror: il caso che
    // prima bloccava la coda per sempre.
    globalThis.Image = class {
      set src(_v) {
        /* nessun evento, mai */
      }
    }
    vi.useFakeTimers()
    try {
      const logoPerStampa = await carica()
      const p = logoPerStampa()
      await vi.advanceTimersByTimeAsync(3100)
      expect(await p).toBeNull() // niente logo, ma la promessa SI CHIUDE
      // E non si riprova alla stampa dopo: «provato e non c'è» è ricordato.
      expect(await logoPerStampa()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

// ── CAMBIARE IL LOGO LO CAMBIA DAVVERO (REQ-STAMPA-011) ──────────────
//
// Da quando l'immagine si carica dalle impostazioni, «si tenta una volta
// sola» non basta più: vale per QUELL'immagine. Senza, il locale caricava
// il logo nuovo e la stampante continuava a fare uscire il vecchio
// finché qualcuno non riavviava l'app.
describe('il logo che cambia', () => {
  it('un’immagine diversa si carica davvero, la stessa no', async () => {
    prove.esito = 'ok'
    const logoPerStampa = await carica()
    const primo = await logoPerStampa()
    expect(prove.tentativi).toBe(1)

    // Il locale ne carica una sua: si va a prenderla.
    const suo = await logoPerStampa('data:image/png;base64,AAAA')
    expect(prove.tentativi).toBe(2)
    expect(suo).not.toBe(primo)

    // Richiesta di nuovo, resta quella pronta: la carta non aspetta.
    expect(await logoPerStampa('data:image/png;base64,AAAA')).toBe(suo)
    expect(prove.tentativi).toBe(2)
  })
})
