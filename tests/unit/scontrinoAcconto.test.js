'use strict'

// ── QUANDO ESCE LO SCONTRINO D'ACCONTO (REQ-STAMPA-015) ──────────────
//
// «Lo scontrino esce ad ogni riscossione ma è configurabile. Va fatto
// così: una impostazione che attiva un terzo bottone, "riscuoti acconto
// con scontrino", e una ulteriore opzione che invece ad ogni riscossione
// stampa lo scontrino d'acconto. […] Quando la riscossione dello
// scontrino di acconto è attiva, disabilita l'opzione del terzo bottone»
// (l'utente, 21/08/2026).
//
// Qui si prova la REGOLA, senza schermata e senza stampante: due
// impostazioni, la loro mutua esclusione, e la domanda «per questa
// riscossione la carta esce?». Il conto dopo l'incasso è la parte che
// fa tornare i numeri sulla carta, e sta in pagamento.js.

import { describe, it, expect } from 'vitest'
import {
  CHIAVE_ACCONTO_SEMPRE,
  CHIAVE_TASTO_ACCONTO,
  accontoDaStampare,
  accontoSempre,
  tastoAcconto,
} from '../../src/lib/scontrinoAcconto.js'
import { contoDopoIncasso, orderDue, orderTotal, paidAmount } from '../../src/lib/pagamento.js'

const acceso = (chiave) => ({ [chiave]: true })

describe('chi non tocca niente non vede cambiare niente', () => {
  it('senza impostazioni non c’è né tasto né stampa automatica', () => {
    expect(tastoAcconto(undefined)).toBe(false)
    expect(accontoSempre(undefined)).toBe(false)
    expect(accontoSempre({})).toBe(false)
    expect(
      accontoDaStampare({ settings: {}, chiude: false, autoStampa: true })
    ).toBe(false)
  })
})

describe('la mutua esclusione delle due impostazioni', () => {
  // «Quando la riscossione dello scontrino di acconto è attiva, disabilita
  // l'opzione del terzo bottone». La regola sta in un posto solo, così il
  // pannello e la schermata di pagamento non possono pensarla diverso.
  it('con l’automatico acceso il terzo tasto non c’è, anche se resta scelto', () => {
    const s = { ...acceso(CHIAVE_TASTO_ACCONTO), ...acceso(CHIAVE_ACCONTO_SEMPRE) }
    expect(accontoSempre(s)).toBe(true)
    expect(tastoAcconto(s)).toBe(false)
  })

  // E la scelta non si perde: spegnendo l'automatico il tasto torna, senza
  // che nessuno debba riaccenderlo.
  it('spento l’automatico, il tasto torna com’era', () => {
    const s = { ...acceso(CHIAVE_TASTO_ACCONTO), [CHIAVE_ACCONTO_SEMPRE]: false }
    expect(tastoAcconto(s)).toBe(true)
  })
})

describe('per questa riscossione la carta esce?', () => {
  const conTasto = acceso(CHIAVE_TASTO_ACCONTO)
  const sempre = acceso(CHIAVE_ACCONTO_SEMPRE)

  // L'incasso salda il conto: quello che esce è lo SCONTRINO, non un
  // acconto (REQ-STAMPA-001). Due carte per lo stesso incasso sarebbero
  // due documenti che dicono cose diverse.
  it('mai quando l’incasso chiude il conto', () => {
    expect(accontoDaStampare({ settings: sempre, chiude: true, autoStampa: true })).toBe(false)
    expect(accontoDaStampare({ settings: conTasto, chiude: true, colTasto: true })).toBe(false)
  })

  // «Riscuoti (senza stampa)» dice che carta non se ne vuole: vale per
  // qualunque carta, acconto compreso.
  it('mai col gesto che dice di non stampare', () => {
    expect(
      accontoDaStampare({ settings: sempre, chiude: false, senzaStampa: true, autoStampa: true })
    ).toBe(false)
  })

  // Il terzo tasto è un GESTO ESPLICITO: stampa anche dove la stampa
  // automatica di questo terminale è spenta, come fa «Preconto».
  it('col terzo tasto esce anche senza stampa automatica', () => {
    expect(
      accontoDaStampare({ settings: conTasto, chiude: false, colTasto: true, autoStampa: false })
    ).toBe(true)
  })

  // L'automatico invece è carta che esce DA SOLA: segue l'interruttore
  // del terminale, se no il telefono della sala — che gli scontrini non li
  // stampa — comincerebbe a stampare acconti.
  it('l’automatico segue la stampa automatica del terminale', () => {
    expect(accontoDaStampare({ settings: sempre, chiude: false, autoStampa: true })).toBe(true)
    expect(accontoDaStampare({ settings: sempre, chiude: false, autoStampa: false })).toBe(false)
  })

  // Il tasto acceso da solo non fa uscire niente al gesto normale: la
  // differenza fra le due impostazioni è tutta qui.
  it('col solo terzo tasto acceso, «Riscuotere» non stampa', () => {
    expect(accontoDaStampare({ settings: conTasto, chiude: false, autoStampa: true })).toBe(false)
  })
})

// ── I NUMERI CHE FINISCONO SULLA CARTA ───────────────────────────────
//
// La riscossione parte in sottofondo: nell'istante in cui si stampa,
// l'ordine è ancora quello di PRIMA. `contoDopoIncasso` compone il dopo —
// ed è il posto dove si sbaglia lo sconto, perché quello che il pagamento
// si porta via deve sparire dal documento.
describe('il conto com’è rimasto dopo la riscossione', () => {
  const CONTO = { total: 46, payments: [], discount: { type: 'euro', value: 3 }, discount_amount: 3, discount_items: [{ drink_id: 'negroni', qty: 2 }] }
  const INCASSO = {
    amount: 13,
    method: 'contanti',
    items: [{ drink_id: 'negroni', qty: 2, name: 'Negroni', unit_price: 8 }],
    sconto: { type: 'euro', value: 3, amount: 3, items: [{ drink_id: 'negroni', qty: 2 }] },
  }

  it('l’incasso si aggiunge e lo sconto se ne va dal documento', () => {
    const dopo = contoDopoIncasso(CONTO, INCASSO)
    expect(dopo.payments).toHaveLength(1)
    expect(dopo.payments[0]).toMatchObject({ amount: 13, method: 'contanti' })
    expect(dopo.payments[0].sconto.amount).toBe(3)
    expect(dopo.discount_amount).toBe(0)
    expect(dopo.discount).toBe(null)
  })

  // LO SCONTO CONTATO DUE VOLTE è il difetto che questa funzione esiste
  // per evitare: 46 − 3 = 43 di conto, 13 versati, 30 che restano. Se lo
  // sconto restasse anche sul documento il resto stampato sarebbe 27, e
  // al saldo il cliente pagherebbe tre euro in meno di quello che deve.
  it('totale, versato e resto tornano', () => {
    const dopo = contoDopoIncasso(CONTO, INCASSO)
    expect(orderTotal(dopo)).toBe(43)
    expect(paidAmount(dopo)).toBe(13)
    expect(orderDue(dopo)).toBe(30)
  })

  // Un acconto battuto a mano non si porta via lo sconto (resta preparato
  // per il saldo, vedi PaymentScreen): il documento non si tocca.
  it('senza sconto nel pagamento, quello preparato resta dov’è', () => {
    const dopo = contoDopoIncasso(CONTO, { amount: 20, method: 'carta' })
    expect(dopo.discount_amount).toBe(3)
    expect(dopo.payments[0].sconto).toBeUndefined()
    expect(orderDue(dopo)).toBe(23) // 46 − 3 di sconto − 20 versati
  })

  // Il secondo acconto si accoda al primo senza toccarlo: gli sconti già
  // consumati sono storia (REQ-PAG-013).
  it('il secondo acconto non tocca il primo', () => {
    const dopo = contoDopoIncasso(contoDopoIncasso(CONTO, INCASSO), {
      amount: 12,
      method: 'carta',
      sconto: { type: 'percent', value: 15, amount: 2.1, items: [{ drink_id: 'spritz', qty: 2 }] },
    })
    expect(dopo.payments.map((p) => p.amount)).toEqual([13, 12])
    expect(orderTotal(dopo)).toBe(40.9)
    expect(orderDue(dopo)).toBe(15.9)
  })
})
