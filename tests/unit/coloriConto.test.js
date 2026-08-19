'use strict'

// IL COLORE DEL CONTO (REQ-UI-020).
//
// Nasce da una serata vera: un conto battuto in tre volte finisce in tre
// comande, le tre comande finiscono in tre colonne diverse della lavagna, e
// da due metri nessuno vede più che sono lo stesso tavolo. Il colore è il
// segno che li tiene insieme.
//
// Quello che si prova qui è la regola, non il disegno:
//   · il colore si CALCOLA una volta e si SCRIVE sul conto — non si
//     ricalcola dall'id a ogni disegno, o basterebbe cambiare tavolozza
//     (o aggiornare un terminale e non l'altro) per vedere lo stesso conto
//     di due colori diversi su due schermi;
//   · due conti battuti di fila non sono mai dello stesso colore: è
//     proprio quando i numeri sono vicini che serve distinguerli;
//   · un colore che arriva da fuori tavolozza non finisce sul documento.

import { describe, it, expect } from 'vitest'
import {
  COLORI_CONTO,
  coloreAutomatico,
  coloreDelConto,
  coloreValido,
} from '../../src/lib/coloriConto.js'

describe('la tavolozza dei conti', () => {
  it('è quella delle categorie: una sola, non due da tenere in pari', async () => {
    const { CATEGORY_PALETTE } = await import('../../src/lib/categoryColors.js')
    expect(COLORI_CONTO).toEqual(CATEGORY_PALETTE)
    expect(COLORI_CONTO.length).toBeGreaterThanOrEqual(8)
  })
})

describe('il colore automatico, alla nascita del conto', () => {
  it('conti battuti di fila prendono colori diversi', () => {
    const visti = new Set()
    for (let n = 1; n <= COLORI_CONTO.length; n++) visti.add(coloreAutomatico(n))
    // Un giro intero di tavolozza senza ripetizioni: due conti si
    // ripetono il colore solo dopo dodici altri conti in mezzo.
    expect(visti.size).toBe(COLORI_CONTO.length)
    for (let n = 1; n < 40; n++) {
      expect(coloreAutomatico(n)).not.toBe(coloreAutomatico(n + 1))
    }
  })

  it('è sempre uno della tavolozza, e lo stesso per lo stesso numero', () => {
    for (const n of [1, 7, 12, 13, 41, 199]) {
      expect(COLORI_CONTO).toContain(coloreAutomatico(n))
      expect(coloreAutomatico(n)).toBe(coloreAutomatico(n))
    }
  })

  it('senza numero non inventa niente', () => {
    // Il progressivo c'è sempre, ma se un giorno mancasse è meglio una
    // card senza pallino di una card con un colore preso a caso.
    expect(coloreAutomatico(null)).toBe(null)
    expect(coloreAutomatico(undefined)).toBe(null)
    expect(coloreAutomatico('boh')).toBe(null)
  })
})

describe('il colore di un conto che si ha in mano', () => {
  it('è quello SCRITTO sopra, mai ricalcolato dall’id o dal numero', () => {
    expect(coloreDelConto({ id: 'o41', daily_number: 41, colore: '#2ecc71' })).toBe('#2ecc71')
    // Un conto nato coi colori spenti resta senza: se qui si tornasse a
    // calcolarlo, tutta la coda si colorerebbe da sola il giorno in cui
    // qualcuno accende l'impostazione — anche i conti già aperti, che
    // sugli altri terminali erano ancora bianchi.
    expect(coloreDelConto({ id: 'o41', daily_number: 41 })).toBe(null)
    expect(coloreDelConto({ id: 'o41', colore: null })).toBe(null)
    expect(coloreDelConto(null)).toBe(null)
  })
})

describe('cosa si accetta di scrivere sul conto', () => {
  it('solo tinte della tavolozza, oppure niente', () => {
    expect(coloreValido(COLORI_CONTO[0])).toBe(true)
    expect(coloreValido(COLORI_CONTO[0].toUpperCase())).toBe(true)
    expect(coloreValido(null)).toBe(true)
    expect(coloreValido('')).toBe(true)
    // Una stringa arrivata da chissà dove finirebbe dentro uno `style`.
    expect(coloreValido('red; background:url(x)')).toBe(false)
    expect(coloreValido('#123456')).toBe(false)
  })
})
