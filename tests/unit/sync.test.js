// @vitest-environment happy-dom
'use strict'

// LE SCRITTURE VANNO AL SERVER DA SOLE. L'app scrive in locale e la
// sincronizzazione la fa in sottofondo: è così che gli altri terminali del
// locale vedono l'ordine appena battuto senza che nessuno prema niente.
//
// Offline le scritture non falliscono: restano in coda dentro Firestore e
// partono appena c'è linea. Quelle RIFIUTATE — un errore vero, la rete che
// si chiude a metà — restavano invece lì finché qualcuno non apriva la
// campanella e premeva «riprova»: al banco non lo fa nessuno, e si scopre il
// giorno dopo che un incasso non è mai arrivato.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bgWrite, syncStatus, _azzeraSync } from '../../src/lib/sync.js'

const attendi = () => new Promise((r) => setTimeout(r, 0))

beforeEach(async () => {
  _azzeraSync()
  await attendi()
})

describe('la sincronizzazione in sottofondo', () => {
  it('una scrittura andata a buon fine non lascia niente indietro', async () => {
    bgWrite(() => Promise.resolve(), 'ordine')
    await attendi()
    expect(syncStatus().failedCount).toBe(0)
  })

  it('una rifiutata resta segnata, e si vede', async () => {
    bgWrite(() => Promise.reject(new Error('rete chiusa')), 'incasso')
    await attendi()
    expect(syncStatus().failedCount).toBe(1)
    expect(syncStatus().lastError).toContain('rete chiusa')
  })

  it('quando la rete torna si riprova da sola', async () => {
    let volte = 0
    bgWrite(() => {
      volte += 1
      return volte === 1 ? Promise.reject(new Error('rete chiusa')) : Promise.resolve()
    }, 'incasso')
    await attendi()
    expect(syncStatus().failedCount).toBe(1)

    window.dispatchEvent(new Event('online'))
    await attendi()
    expect(volte).toBe(2)
    expect(syncStatus().failedCount).toBe(0)
  })

  it('ma non all’infinito: dopo tre tentativi aspetta una persona', async () => {
    // Una scrittura rifiutata per un motivo che non cambia — permessi, dato
    // non valido — riproverebbe a ogni riconnessione per sempre.
    let volte = 0
    bgWrite(() => {
      volte += 1
      return Promise.reject(new Error('permessi'))
    }, 'roba')
    await attendi()
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new Event('online'))
      await attendi()
    }
    expect(volte).toBe(4) // il primo tentativo più tre riprove
    expect(syncStatus().failedCount).toBe(1) // resta lì, e la campanella lo dice
  })
})
