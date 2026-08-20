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
  coloreCardConto,
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

// ── COSA DICE LA STRISCIA A SINISTRA DELLA CARD (REQ-UI-020) ─────────
//
// La striscia da 4px dice lo STATO — a che punto sta il lavoro, com'è
// messo il pagamento — ed è stata l'unica risposta possibile finché
// l'utente non ha chiesto l'altra (20/08/2026): dove un conto si spezza in
// tante comande sparse, riconoscere il tavolo vale più del passo di
// lavoro. Adesso lo sceglie chi manda avanti il locale.
//
// LA DECISIONE STA QUI, in una funzione sola, e non in tre ternari sparsi
// nel JSX delle quattro viste della coda: è esattamente così che era nata
// la striscia ambra del BUG-064, applicata a mano e mangiata dal CSS senza
// che nessuno se ne accorgesse.
describe('cosa dice la striscia a sinistra della card', () => {
  const conto = { id: 'o41', daily_number: 41, colore: '#9b59b6' }

  it('di suo la striscia resta quella dello stato: il colore prende solo il fondo', () => {
    // È il default, e chi non tocca niente non deve vedere cambiare niente:
    // la coda di stasera è la stessa di ieri sera.
    const c = coloreCardConto(conto)
    expect(c.className).toBe('conto-colorato')
    expect(c.className).not.toContain('bordo-conto')
    expect(c.style).toEqual({ '--conto-colore': '#9b59b6' })
  })

  it('accesa l’impostazione, la striscia porta il colore del conto', () => {
    const c = coloreCardConto(conto, true)
    // Il fondo NON si perde: sono due segni, e quello da lontano è il fondo.
    expect(c.className).toContain('conto-colorato')
    expect(c.className).toContain('bordo-conto')
    expect(c.style).toEqual({ '--conto-colore': '#9b59b6' })
  })

  it('un conto SENZA colore tiene la striscia dello stato, accesa o no', () => {
    // Se qui si mettesse la classe lo stesso, `var(--conto-colore)` non
    // sarebbe definita e la striscia diventerebbe trasparente: una card
    // senza bordo, che non dice più né una cosa né l'altra.
    expect(coloreCardConto({ id: 'o42', daily_number: 42 }, true)).toBe(null)
    expect(coloreCardConto({ id: 'o42', colore: null }, true)).toBe(null)
    expect(coloreCardConto(null, true)).toBe(null)
  })

  it('un conto ANNULLATO tiene il grigio, impostazione o no', () => {
    // Lavoro buttato. Una striscia accesa lo rimetterebbe in mezzo ai vivi,
    // e nella colonna degli annullati sarebbe la card più vistosa di tutte.
    // L'annullamento arriva in due campi diversi a seconda della vista.
    const perStatus = { ...conto, status: 'annullato' }
    const perWorkflow = { ...conto, workflow_status: 'annullato' }
    expect(coloreCardConto(perStatus, true).className).toBe('conto-colorato')
    expect(coloreCardConto(perWorkflow, true).className).toBe('conto-colorato')
    // Il fondo però resta colorato anche lì: è il conto, non il suo stato.
    expect(coloreCardConto(perStatus, true).style).toEqual({ '--conto-colore': '#9b59b6' })
  })

  it('pagato-ma-da-servire: con l’impostazione accesa vince il colore del conto', () => {
    // L'ambra dice «pagato, ancora da consegnare» e a striscia libera resta
    // sua (BUG-064). Accesa l'impostazione, la striscia è del conto: che sia
    // già pagato lo dicono il 💳 accanto al nome e, nelle corsie, il filo
    // ambra dentro la card. Il posto nella cascata CSS è sorvegliato da
    // tests/unit/css.test.js.
    const c = coloreCardConto({ ...conto, payment_status: 'pagato' }, true)
    expect(c.className).toContain('bordo-conto')
  })

  it('l’impostazione si accende solo se è vera, non se «sembra» vera', () => {
    // Le impostazioni arrivano da Firestore e un campo mai scritto è
    // `undefined`: qui dentro non deve diventare «forse».
    for (const forse of [undefined, null, false, 0, '', 'no']) {
      expect(coloreCardConto(conto, forse).className).toBe('conto-colorato')
    }
  })
})
