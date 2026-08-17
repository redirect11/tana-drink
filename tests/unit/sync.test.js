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
import {
  bgWrite,
  syncStatus,
  _azzeraSync,
  definitivo,
  spiegaErrore,
  scartaFalliteDefinitive,
} from '../../src/lib/sync.js'

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

// CI SONO ERRORI CHE NON PASSANO RIPROVANDO. «Il documento non esiste più»
// o «non hai i permessi» non cambiano al secondo tentativo: succede quando
// qualcuno cancella un prodotto mentre tu ne stavi scalando la scorta, o
// quando il database locale viene rifatto da zero e in coda restano
// modifiche che parlano di roba che non c'è più. Riprovarle all'infinito è
// tempo perso, e lasciarle lì tiene la campanella rossa per sempre.
describe('le modifiche che non passeranno mai', () => {
  const NON_TROVATO =
    'NOT_FOUND: no entity to update: app: "dev~demo-tana-drink" path { type: "inventory_items" name: "sy0mia7" }'

  it('si riconoscono', () => {
    expect(definitivo(NON_TROVATO)).toBe(true)
    expect(definitivo('Missing or insufficient permissions')).toBe(true)
    expect(definitivo('rete chiusa')).toBe(false)
  })

  it('si spiegano a parole', () => {
    expect(spiegaErrore(NON_TROVATO)).toBe('una scheda del magazzino non esiste più')
    expect(spiegaErrore('rete chiusa')).toBe('rete chiusa')
  })

  it('al ritorno della rete non si riprovano', async () => {
    let volte = 0
    bgWrite(() => {
      volte += 1
      return Promise.reject(new Error(NON_TROVATO))
    }, 'scorta')
    await attendi()
    window.dispatchEvent(new Event('online'))
    await attendi()
    expect(volte).toBe(1)
    expect(syncStatus().definitiveCount).toBe(1)
  })

  it('e si possono scartare, che è l’unico modo di spegnere l’avviso', async () => {
    bgWrite(() => Promise.reject(new Error(NON_TROVATO)), 'scorta')
    bgWrite(() => Promise.reject(new Error('rete chiusa')), 'incasso')
    await attendi()
    expect(syncStatus().failedCount).toBe(2)
    expect(scartaFalliteDefinitive()).toBe(1)
    // Quella recuperabile resta: quella si riprova.
    expect(syncStatus().failedCount).toBe(1)
  })
})
