// @vitest-environment happy-dom
'use strict'

// LO SCONTRINO ESCE A OGNI INCASSO, NON UNA VOLTA PER CONTO.
//
// La guardia contro le doppie copie (claimReceiptPrint) era per CONTO: la
// prima chiusura stampava, e da lì in poi quel conto non stampava mai più.
// Ma un conto si riapre — si corregge una riga, si toglie o si mette uno
// sconto — e si riscuote di nuovo: lo scontrino nuovo, con le cifre nuove,
// deve uscire. Parole dell'utente (19/08): «se riapro il conto e cambio
// qualcosa e riscuoto di nuovo, deve ristampare il nuovo conto. Non ha
// senso che stampi solo una volta».
//
// Le tre pretese, e cosa vogliono dire:
//   claim    — una copia sola per questa chiusura (da qualunque schermata)
//   release  — il conto è tornato aperto: la copia era della chiusura vecchia
//   reclaim  — sto incassando ADESSO: la mia copia esce comunque

import { describe, it, expect, beforeEach } from 'vitest'
import {
  claimReceiptPrint,
  releaseReceiptPrint,
  reclaimReceiptPrint,
} from '../../src/lib/printer.js'

beforeEach(() => localStorage.clear())

describe('una copia per chiusura', () => {
  it('la prima pretesa passa, la seconda no: è la guardia sulle doppie copie', () => {
    expect(claimReceiptPrint('o1')).toBe(true)
    expect(claimReceiptPrint('o1')).toBe(false)
  })

  it('conti diversi non si pestano', () => {
    expect(claimReceiptPrint('o1')).toBe(true)
    expect(claimReceiptPrint('o2')).toBe(true)
  })
})

describe('il conto riaperto ristampa', () => {
  it('dopo il release la pretesa passa di nuovo', () => {
    claimReceiptPrint('o1')
    releaseReceiptPrint('o1') // il conto è tornato aperto
    expect(claimReceiptPrint('o1')).toBe(true)
  })

  it('il release di un conto mai stampato non fa danni', () => {
    releaseReceiptPrint('o9')
    expect(claimReceiptPrint('o9')).toBe(true)
  })
})

describe('l’incasso stampa comunque', () => {
  it('reclaim passa anche se la copia vecchia c’era: sto incassando adesso', () => {
    claimReceiptPrint('o1') // la chiusura di prima
    expect(reclaimReceiptPrint('o1')).toBe(true)
  })

  it('e dopo il reclaim la coda non fa la seconda copia', () => {
    // È il giro vero: la schermata di pagamento stampa col reclaim, poi lo
    // snapshot della coda vede il conto pagato e tenta la sua — che deve
    // trovare la pretesa già presa.
    reclaimReceiptPrint('o1')
    expect(claimReceiptPrint('o1')).toBe(false)
  })
})

describe('la serata intera di un conto corretto', () => {
  it('chiude → stampa · riapre → niente · richiude → ristampa, una volta', () => {
    // Prima chiusura: la schermata di pagamento incassa.
    expect(reclaimReceiptPrint('o1')).toBe(true) // stampa
    expect(claimReceiptPrint('o1')).toBe(false) // la coda non duplica

    // Il conto si riapre per correggere una riga: la coda lo vede aperto.
    releaseReceiptPrint('o1')

    // Seconda chiusura: lo scontrino NUOVO esce, e una volta sola.
    expect(reclaimReceiptPrint('o1')).toBe(true) // ristampa
    expect(claimReceiptPrint('o1')).toBe(false) // e la coda ancora non duplica
  })
})
