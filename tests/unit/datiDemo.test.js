'use strict'

// I DATI DI PROVA DELLA DEMO (REQ-FLOTTA-019): un locale inventato,
// completo, sempre uguale per lo stesso giorno, con le date relative a oggi
// e NESSUNA traccia della Tana — la demo è una pagina pubblica.

import { describe, it, expect } from 'vitest'
import { datiDemo, catalogo, impostazioniDemo, generatore } from '../../src/demo/dati.js'
import { MODULI_PREMIUM } from '../../src/lib/licenza.js'
import { businessDayKey } from '../../src/lib/businessDay.js'

// Un venerdì sera d'autunno, a Roma.
const ADESSO = new Date('2026-10-30T21:15:00+01:00')
const docs = datiDemo({ adesso: ADESSO })
const di = (prefisso) => docs.filter((d) => d.percorso.startsWith(prefisso))
const uno = (percorso) => docs.find((d) => d.percorso === percorso)?.dati

describe('i dati di prova', () => {
  it('sono sempre gli stessi per lo stesso istante', () => {
    expect(JSON.stringify(datiDemo({ adesso: ADESSO }))).toBe(JSON.stringify(docs))
  })

  it('il generatore col seme dà sempre la stessa serie', () => {
    const a = generatore(7)
    const b = generatore(7)
    expect([a.caso(), a.caso(), a.intero(1, 9)]).toEqual([b.caso(), b.caso(), b.intero(1, 9)])
  })

  it('ogni documento ha un percorso solo', () => {
    const percorsi = docs.map((d) => d.percorso)
    expect(new Set(percorsi).size).toBe(percorsi.length)
  })

  it('non c’è niente della Tana: nomi, utenze, password', () => {
    const testo = JSON.stringify(docs)
    expect(testo).not.toMatch(/\btana\b|coniglio|rabbit|\bnola\b|flavio|tana\.local|collaudo123/i)
    expect(testo).not.toMatch(/image_url":"\/drinks\//)
  })

  it('il menù: ricette che puntano ad articoli veri, i disegni, e gli Special', () => {
    const { articoli, drink } = catalogo()
    const idArticoli = new Set(articoli.map((a) => a.id))
    for (const d of drink) {
      for (const r of d.recipe_items) expect(idArticoli.has(r.inventory_item_id), `${d.name}: ${r.name}`).toBe(true)
      expect(d.illustrazione).toMatchObject({ bicchiere: expect.any(String), colore: expect.any(String) })
    }
    expect(drink.filter((d) => d.speciale).map((d) => d.name)).toEqual(['Casa Spritz', 'Sour della Casa', 'Velluto Bianco'])
    expect(di('drinks/').length).toBe(drink.length)
    expect(di('inventory_items/').length).toBe(articoli.length)
  })

  it('le impostazioni: tutti i moduli, licenza attiva, senza account clienti', () => {
    const s = impostazioniDemo()
    expect(s.licenza.stato).toBe('attiva')
    expect(Object.keys(s.licenza.moduli).sort()).toEqual(Object.keys(MODULI_PREMIUM).sort())
    expect(Object.values(s.licenza.moduli).every((v) => v === true)).toBe(true)
    expect(s.customer_accounts_enabled).toBe(false)
    expect(uno('settings/bar')).toEqual(s)
  })

  it('lo storico: quattro settimane di serate chiuse, dal mercoledì alla domenica, con la loro cassa', () => {
    const casse = di('cash_sessions/').map((d) => d.dati)
    const chiuse = casse.filter((c) => c.status === 'closed')
    const oggi = businessDayKey(ADESSO)
    expect(chiuse.length).toBeGreaterThanOrEqual(18)
    for (const c of chiuse) {
      expect(c.business_day < oggi).toBe(true)
      const dow = new Date(`${c.business_day}T12:00:00Z`).getUTCDay()
      expect([1, 2]).not.toContain(dow)
    }
    // Il contante contato a volte non torna: le schermate devono saperlo dire.
    expect(chiuse.some((c) => c.difference !== 0)).toBe(true)
  })

  it('le serate passate sono incassate: ogni conto pagato ha la sua riga di pagamento', () => {
    const storici = di('orders/storico-').map((d) => d.dati)
    expect(storici.length).toBeGreaterThan(300)
    for (const o of storici.filter((x) => x.status === 'pagato')) {
      expect(o.payments).toHaveLength(1)
      expect(o.payments[0].amount).toBe(o.total)
    }
    expect(storici.some((o) => o.status === 'annullato')).toBe(true)
  })

  it('stasera: cassa aperta, conti già pagati e conti in coda in ogni punto del lavoro', () => {
    const oggi = businessDayKey(ADESSO)
    const cassa = uno(`cash_sessions/cassa-${oggi}`)
    expect(cassa.status).toBe('open')
    expect(uno('counters/_active_cash')).toEqual({ session_id: `cassa-${oggi}` })
    const aperti = di('orders/aperto-').map((d) => d.dati)
    expect(aperti).toHaveLength(7)
    const stati = new Set(aperti.flatMap((o) => o.comande.map((c) => c.status)))
    expect([...stati].sort()).toEqual(['in_preparazione', 'pronto', 'ricevuto', 'ritirato'])
    for (const o of aperti) {
      // L'aggregato delle comande c'è, e torna col totale.
      const somma = o.items.reduce((s, r) => s + r.qty * r.unit_price, 0)
      expect(o.total).toBeCloseTo(somma, 2)
      expect(new Set(o.items.map((r) => r.drink_id)).size).toBe(o.items.length)
      expect(o.order_date).toBe(oggi)
    }
    expect(uno(`counters/cash-cassa-${oggi}`).last).toBe(9 + 7)
  })

  it('i documenti che l’app legge uno per uno e che non ci sono, scritti come inesistenti', () => {
    for (const p of ['vendite_storiche/_indice', 'settings/printer', 'pos_prefs/global']) {
      const d = docs.find((x) => x.percorso === p)
      expect(d, p).toBeTruthy()
      expect(d.dati).toBeNull()
    }
  })

  it('le date seguono il giorno in cui si apre la demo', () => {
    const domani = new Date(ADESSO.getTime() + 24 * 3600 * 1000)
    const altri = datiDemo({ adesso: domani })
    const cassaAperta = altri.find((d) => d.percorso.startsWith('cash_sessions/') && d.dati?.status === 'open').dati
    expect(cassaAperta.business_day).toBe(businessDayKey(domani))
  })
})
