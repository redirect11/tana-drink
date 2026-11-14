'use strict'

// IN QUANTE RICETTE, E LO SWITCH PRODOTTO (REQ-MAG-056, REQ-MENU-043).
// Flavio, 14/11/2026: il fornitore gli ha cambiato il Carpano Dry con un
// Noilly Prat, e il Carpano stava in tutte le ricette dei Martini. Lo
// switch lo sostituisce ovunque «lasciando invariata la quantità», in un
// verso solo («Bombay resta Bombay»), e con lui le etichette del menù dei
// clienti (Daniele: «si devono ovviamente aggiornare anche le etichette»).

import { describe, it, expect } from 'vitest'
import { ricetteDelProdotto, pianoSwitch, etichetteDopoSwitch } from '../../src/lib/switchProdotto.js'

const CARPANO = { id: 'carpano', name: 'Carpano Dry 1L', unit: 'pz', package_size: 1000, content_unit: 'ml' }
const NOILLY = { id: 'noilly', name: 'Noilly Prat 75cl', unit: 'pz', package_size: 750, content_unit: 'ml' }
const LIME = { id: 'lime', name: 'Lime', unit: 'pz' }
const riga = (item, qty, unit = 'ml') => ({ inventory_item_id: item.id, name: item.name, unit, qty })

const DRY_MARTINI = { id: 'dry', name: 'Dry Martini', recipe_items: [riga({ id: 'gin', name: 'Tanqueray' }, 60), riga(CARPANO, 10)] }
const MANHATTAN = { id: 'man', name: 'Manhattan', recipe_items: [riga({ id: 'rye', name: 'Bulleit Rye' }, 50), riga(CARPANO, 20)] }
// Ha già il Noilly e niente Carpano: non si tocca.
const SOLO_NOILLY = { id: 'chambery', name: 'Chambéry', recipe_items: [riga(NOILLY, 40)] }
// Li ha tutti e due: resteranno due righe di Noilly (Daniele: «lasciale così»).
const TUTTI_E_DUE = { id: 'perfect', name: 'Perfect Martini', recipe_items: [riga(CARPANO, 15), riga(NOILLY, 15)] }
const DRINKS = [MANHATTAN, SOLO_NOILLY, DRY_MARTINI, TUTTI_E_DUE]

describe('in quante ricette è presente un prodotto', () => {
  it('le ricette che lo usano, per nome', () => {
    expect(ricetteDelProdotto(DRINKS, 'carpano').map((d) => d.name)).toEqual(['Dry Martini', 'Manhattan', 'Perfect Martini'])
    expect(ricetteDelProdotto(DRINKS, 'nessuno')).toEqual([])
    expect(ricetteDelProdotto(DRINKS, null)).toEqual([])
  })
})

describe('lo switch prodotto', () => {
  const piano = () => pianoSwitch({ drinks: DRINKS, uscita: CARPANO, ingresso: NOILLY })

  it('sostituisce il prodotto in uscita in tutte le sue ricette, con la stessa quantità e unità', () => {
    const p = piano()
    expect(p.ricette.map((r) => r.id)).toEqual(['dry', 'man', 'perfect'])
    const dry = p.ricette.find((r) => r.id === 'dry')
    expect(dry.recipe_items).toEqual([riga({ id: 'gin', name: 'Tanqueray' }, 60), riga(NOILLY, 10)])
    expect(p.incompatibili).toEqual([])
  })

  it('in un verso solo: la ricetta che ha solo il prodotto in ingresso non cambia', () => {
    expect(piano().ricette.map((r) => r.id)).not.toContain('chambery')
  })

  it('la ricetta che li ha tutti e due resta con due righe, ed è segnalata', () => {
    const perfect = piano().ricette.find((r) => r.id === 'perfect')
    expect(perfect.conIngresso).toBe(true)
    expect(perfect.recipe_items).toEqual([riga(NOILLY, 15), riga(NOILLY, 15)])
    expect(piano().ricette.find((r) => r.id === 'dry').conIngresso).toBe(false)
  })

  // «4 cl» non deve diventare 4 pezzi: un prodotto che non si dosa in ml
  // non può prendere il posto di uno dosato in ml.
  it('un prodotto in ingresso che non si dosa allo stesso modo blocca lo switch', () => {
    const p = pianoSwitch({ drinks: DRINKS, uscita: CARPANO, ingresso: LIME })
    expect(p.incompatibili.map((i) => [i.nome, i.unita])).toEqual([
      ['Dry Martini', ['ml']],
      ['Manhattan', ['ml']],
      ['Perfect Martini', ['ml']],
    ])
  })

  // Dalla revisione: le ricette vecchie hanno righe in «cl» (scritte prima
  // che la scheda salvasse l'unità base). Si dosano in ml: lo switch non si
  // deve fermare per quelle.
  it('una riga in cl, di una ricetta vecchia, non ferma lo switch', () => {
    const vecchia = { id: 'vecchio', name: 'Martini di una volta', recipe_items: [{ ...riga(CARPANO, 4), unit: 'cl' }] }
    const p = pianoSwitch({ drinks: [vecchia], uscita: CARPANO, ingresso: NOILLY })
    expect(p.incompatibili).toEqual([])
    expect(p.ricette[0].recipe_items).toEqual([{ ...riga(NOILLY, 4), unit: 'cl' }])
  })

  it('lo stesso prodotto, o uno solo, non è uno switch', () => {
    expect(pianoSwitch({ drinks: DRINKS, uscita: CARPANO, ingresso: CARPANO })).toBeNull()
    expect(pianoSwitch({ drinks: DRINKS, uscita: CARPANO, ingresso: null })).toBeNull()
  })
})

describe('le etichette del menù dei clienti', () => {
  const eti = (item) => ({ tipo: 'prodotto', id: item.id, nome: item.name })

  it('l’etichetta del prodotto in uscita passa a quello in ingresso, col nome da menù', () => {
    const dopo = etichetteDopoSwitch([eti({ id: 'gin', name: 'Tanqueray' }), eti(CARPANO)], CARPANO, NOILLY)
    // Il formato («75cl») non va nel menù: è il nome che l'editor dà alle etichette.
    expect(dopo).toEqual([eti({ id: 'gin', name: 'Tanqueray' }), { tipo: 'prodotto', id: 'noilly', nome: 'Noilly Prat' }])
  })

  it('se la voce ha già l’etichetta del prodotto in ingresso, quella in uscita sparisce', () => {
    expect(etichetteDopoSwitch([eti(CARPANO), eti(NOILLY)], CARPANO, NOILLY)).toEqual([eti(NOILLY)])
  })

  it('le scelte del cliente che offrono o sostituiscono il prodotto lo seguono', () => {
    const conScelta = {
      tipo: 'categoria',
      id: 'vermouth',
      nome: 'Vermouth',
      scelta: { offerti: [{ id: 'carpano', nome: 'Carpano Dry', supplemento: 1 }], sostituisce: ['carpano'] },
    }
    const [dopo] = etichetteDopoSwitch([conScelta], CARPANO, NOILLY)
    expect(dopo.scelta).toEqual({ offerti: [{ id: 'noilly', nome: 'Noilly Prat', supplemento: 1 }], sostituisce: ['noilly'] })
  })

  it('una voce che non nomina il prodotto non cambia, e il testo libero nemmeno', () => {
    expect(etichetteDopoSwitch([{ tipo: 'testo', id: null, nome: 'Carpano Dry' }], CARPANO, NOILLY)).toBeNull()
    expect(etichetteDopoSwitch(null, CARPANO, NOILLY)).toBeNull()
  })

  it('il piano porta le voci che cambiano, col nome del drink se la voce non ne ha uno suo', () => {
    const voci = [
      { id: 'v1', drink_id: 'dry', nome: '', etichette: [eti(CARPANO)] },
      { id: 'v2', drink_id: 'man', nome: 'Manhattan della casa', etichette: [eti({ id: 'rye', name: 'Bulleit' })] },
    ]
    const p = pianoSwitch({ drinks: DRINKS, voci, uscita: CARPANO, ingresso: NOILLY })
    expect(p.voci.map((v) => [v.id, v.nome])).toEqual([['v1', 'Dry Martini']])
  })
})
