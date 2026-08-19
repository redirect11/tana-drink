// @vitest-environment happy-dom
'use strict'

// UNO SCONTRINO PER CONTO, MA SOLO SE È USCITO DAVVERO.
//
// La guardia serve: la chiusura di un conto passa da più strade (la
// schermata del pagamento, la coda, l'incasso di gruppo) e senza di lei lo
// stesso scontrino uscirebbe due volte. Ma segnava il conto PRIMA di
// stampare e non lo liberava più — e se la carta non usciva (stampante
// spenta, wifi che non passa) quel conto non stampava più lo scontrino
// automatico nemmeno riaperto e richiuso.
//
// È il difetto raccontato dal locale il 19/08: «non l'ha stampato perché ho
// fatto lo sconto, dopo lo riapro, non gli applico lo sconto, lo chiudo,
// neanche lo stampa». Non era lo sconto a ricordarsene: era questo elenco.

import { describe, it, expect, beforeEach } from 'vitest'
import { claimReceiptPrint, releaseReceiptPrint } from '../../src/lib/printer.js'

beforeEach(() => {
  localStorage.clear()
})

describe('la prenotazione dello scontrino automatico', () => {
  it('la prima chiusura stampa, la seconda no: una copia sola per conto', () => {
    expect(claimReceiptPrint('ord-1')).toBe(true)
    expect(claimReceiptPrint('ord-1')).toBe(false)
  })

  it('conti diversi non si tolgono il posto', () => {
    expect(claimReceiptPrint('ord-1')).toBe(true)
    expect(claimReceiptPrint('ord-2')).toBe(true)
  })

  it('se la stampa non riesce, la prenotazione torna libera e si ristampa', () => {
    expect(claimReceiptPrint('ord-1')).toBe(true)
    releaseReceiptPrint('ord-1') // la carta non è uscita
    expect(claimReceiptPrint('ord-1')).toBe(true)
  })

  // Il conto riaperto è un conto da richiudere: alla chiusura lo scontrino
  // deve poter uscire di nuovo, se no si riapre per stamparlo e non stampa.
  it('un conto riaperto ristampa alla chiusura successiva', () => {
    claimReceiptPrint('ord-1')
    releaseReceiptPrint('ord-1') // riapertura del conto
    expect(claimReceiptPrint('ord-1')).toBe(true)
  })

  it('liberare un conto non tocca gli altri', () => {
    claimReceiptPrint('ord-1')
    claimReceiptPrint('ord-2')
    releaseReceiptPrint('ord-1')
    expect(claimReceiptPrint('ord-2')).toBe(false)
    expect(claimReceiptPrint('ord-1')).toBe(true)
  })

  it('senza id non prenota e non libera niente', () => {
    expect(claimReceiptPrint(null)).toBe(true)
    expect(() => releaseReceiptPrint(null)).not.toThrow()
  })
})
