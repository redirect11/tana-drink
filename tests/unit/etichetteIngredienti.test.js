'use strict'

// GLI INGREDIENTI DI UNA VOCE DEL MENÙ, A ETICHETTE (REQ-MENU-040,
// src/lib/etichetteIngredienti.js). Daniele, 13/11/2026: si scrivono a mano,
// ognuno diventa un'etichetta, e i suggerimenti vengono prima dalla ricetta
// del prodotto collegato. La ricetta propone e non decide (Flavio,
// 04/11/2026: «non li devi prendere dalla ricetta»): al cliente arrivano le
// etichette scelte, o il testo di prima finché non ce ne sono.

import { describe, it, expect } from 'vitest'
import {
  etichettaPulita,
  etichetteDellaVoce,
  ingredientiDellaVoce,
  propostaDallaRicetta,
  suggerimenti,
  etichetteDaTesto,
} from '../../src/lib/etichetteIngredienti.js'
import { voceInSezione } from '../../src/lib/strutturaMenu.js'

const ITEMS = [
  { id: 'gin', name: 'Gin Tanqueray 70 cl', category_id: 'cgin' },
  { id: 'tonica', name: 'Tonica Fever-Tree', category_id: 'cbib' },
  { id: 'ghiaccio', name: 'Ghiaccio', category_id: null },
  { id: 'mare', name: 'Gin Mare', category_id: 'cgin' },
]
const CAT_MAG = [{ id: 'cgin', name: 'Gin' }, { id: 'cbib', name: 'Bibite' }]
const CAT_CASSA = [{ id: 'k1', name: 'Gin Tonic' }]
const GIN_TONIC = {
  id: 'd1',
  name: 'Gin Tonic',
  ingredienti: 'Gin, tonica',
  recipe_items: [
    { inventory_item_id: 'gin', name: 'Gin Tanqueray 70 cl', qty: 40, unit: 'ml' },
    { inventory_item_id: 'tonica', name: 'Tonica Fever-Tree', qty: 1, unit: 'pz' },
    { inventory_item_id: 'ghiaccio', name: 'Ghiaccio', qty: 100, unit: 'g' },
  ],
}

describe('un’etichetta', () => {
  it('ha un tipo noto e un nome; il testo libero non ha id', () => {
    expect(etichettaPulita({ tipo: 'prodotto', id: 'gin', nome: ' Gin Tanqueray ' })).toEqual({ tipo: 'prodotto', id: 'gin', nome: 'Gin Tanqueray' })
    expect(etichettaPulita({ tipo: 'testo', id: 'x', nome: 'lime' })).toEqual({ tipo: 'testo', id: null, nome: 'lime' })
    expect(etichettaPulita({ tipo: 'altro', nome: 'x' })).toBeNull()
    expect(etichettaPulita({ tipo: 'testo', nome: '  ' })).toBeNull()
  })

  it('una voce senza etichette ne ha null, non un elenco vuoto', () => {
    expect(etichetteDellaVoce(undefined)).toBeNull()
    expect(etichetteDellaVoce([])).toEqual([])
    expect(etichetteDellaVoce([{ tipo: 'testo', nome: 'lime' }, { nome: 'senza tipo' }])).toEqual([{ tipo: 'testo', id: null, nome: 'lime' }])
  })
})

describe('quello che legge il cliente', () => {
  it('le etichette, se ci sono; se no il testo di prima; nascosti, niente', () => {
    const voce = { etichette: [{ tipo: 'categoria', id: 'cgin', nome: 'Gin' }, { tipo: 'testo', nome: 'tonica' }] }
    expect(ingredientiDellaVoce(voce, GIN_TONIC)).toBe('Gin, tonica')
    expect(ingredientiDellaVoce({}, GIN_TONIC)).toBe('Gin, tonica')
    expect(ingredientiDellaVoce({ ingredienti: 'solo gin' }, GIN_TONIC)).toBe('solo gin')
    expect(ingredientiDellaVoce({ ...voce, ingredienti_nascosti: true }, GIN_TONIC)).toBe('')
    // Una voce con le etichette tolte tutte non torna al testo di prima.
    expect(ingredientiDellaVoce({ etichette: [] }, GIN_TONIC)).toBe('')
  })

  it('la voce al tavolo li porta così', () => {
    const v = voceInSezione({ id: 'v1', etichette: [{ tipo: 'testo', nome: 'Gin' }] }, GIN_TONIC)
    expect(v.ingredienti).toBe('Gin')
    expect(voceInSezione({ id: 'v1', etichette: [{ tipo: 'testo', nome: 'Gin' }] }, GIN_TONIC, 'snella').ingredienti).toBe('')
  })
})

describe('la proposta dalla ricetta', () => {
  it('i prodotti della ricetta, senza ghiaccio e senza il formato nel nome', () => {
    expect(propostaDallaRicetta(GIN_TONIC, ITEMS)).toEqual([
      { tipo: 'prodotto', id: 'gin', nome: 'Gin Tanqueray' },
      { tipo: 'prodotto', id: 'tonica', nome: 'Tonica Fever-Tree' },
    ])
    expect(propostaDallaRicetta(null, ITEMS)).toEqual([])
  })
})

describe('i suggerimenti', () => {
  const ctx = { drink: GIN_TONIC, items: ITEMS, categorieMagazzino: CAT_MAG, categorieCassa: CAT_CASSA }

  it('prima la ricetta, poi le sue categorie, poi il resto del magazzino e la cassa', () => {
    expect(suggerimenti('gin', ctx).map((s) => [s.gruppo, s.nome])).toEqual([
      ['ricetta', 'Gin Tanqueray'],
      ['ricetta-categoria', 'Gin'],
      ['prodotto', 'Gin Mare'],
      ['cassa', 'Gin Tonic'],
    ])
  })

  it('senza quelli già scelti, e niente per un campo vuoto', () => {
    expect(suggerimenti('gin', { ...ctx, scelte: [{ tipo: 'categoria', id: 'cgin', nome: 'Gin' }] }).map((s) => s.nome)).not.toContain('Gin')
    expect(suggerimenti('  ', ctx)).toEqual([])
  })

  it('più parole: tutte devono esserci', () => {
    expect(suggerimenti('gin ma', ctx).map((s) => s.nome)).toEqual(['Gin Mare'])
  })
})

it('il testo di prima diventa etichette libere', () => {
  expect(etichetteDaTesto('Gin, tonica · lime')).toEqual([
    { tipo: 'testo', id: null, nome: 'Gin' },
    { tipo: 'testo', id: null, nome: 'tonica' },
    { tipo: 'testo', id: null, nome: 'lime' },
  ])
})

// LA SCELTA DEL CLIENTE SU UN'ETICHETTA (REQ-MENU-042). Solo su un prodotto o
// una categoria di magazzino; le alternative sono i prodotti di quella
// categoria con «Il cliente può sceglierlo dal menù»; supplementi in euro,
// mai negativi.
describe('la scelta del cliente su un’etichetta', () => {
  const SCELTI = [
    { id: 'tanq', name: 'Gin Tanqueray 70 cl', category_id: 'cgin', scelta_cliente: true },
    { id: 'hend', name: 'Hendrick’s', category_id: 'cgin', scelta_cliente: true },
    { id: 'beef', name: 'Beefeater', category_id: 'cgin', scelta_cliente: false },
    { id: 'tonica', name: 'Tonica', category_id: 'cbib', scelta_cliente: true },
  ]

  it('le alternative: la categoria dell’etichetta, solo quelli col permesso', async () => {
    const { alternativeDi } = await import('../../src/lib/etichetteIngredienti.js')
    expect(alternativeDi({ tipo: 'categoria', id: 'cgin', nome: 'Gin' }, SCELTI)).toEqual([
      { id: 'tanq', nome: 'Gin Tanqueray' },
      { id: 'hend', nome: 'Hendrick’s' },
    ])
    // Da un prodotto si risale alla sua categoria.
    expect(alternativeDi({ tipo: 'prodotto', id: 'tanq', nome: 'Tanqueray' }, SCELTI).map((a) => a.id)).toEqual(['tanq', 'hend'])
    expect(alternativeDi({ tipo: 'testo', nome: 'lime' }, SCELTI)).toEqual([])
  })

  it('la scelta si tiene solo dove ha senso, coi supplementi puliti', async () => {
    const { etichettaPulita, etichetteConScelta } = await import('../../src/lib/etichetteIngredienti.js')
    const conScelta = etichettaPulita({
      tipo: 'categoria',
      id: 'cgin',
      nome: 'Gin',
      scelta: { offerti: [{ id: 'hend', nome: 'Hendrick’s', supplemento: '1,5' }, { id: 'hend', nome: 'doppio' }, { id: 'x', nome: 'Y', supplemento: -2 }] },
    })
    expect(conScelta.scelta).toEqual({
      offerti: [{ id: 'hend', nome: 'Hendrick’s', supplemento: 1.5 }, { id: 'x', nome: 'Y', supplemento: 0 }],
      sostituisce: [],
    })
    expect(etichettaPulita({ tipo: 'testo', nome: 'lime', scelta: { offerti: [{ id: 'a', nome: 'b' }] } }).scelta).toBeUndefined()
    expect(etichetteConScelta([conScelta, { tipo: 'categoria', id: 'c', nome: 'C', scelta: { offerti: [] } }])).toEqual([conScelta])
  })

  // Al telefono il magazzino non arriva: quale riga della ricetta è «il gin»
  // lo calcola l'editor e lo scrive sulla scelta.
  it('le righe della ricetta che la scelta sostituisce', async () => {
    const { righeSostituite, etichettaPulita } = await import('../../src/lib/etichetteIngredienti.js')
    const drink = {
      recipe_items: [
        { inventory_item_id: 'tanq', name: 'Tanqueray', qty: 40, unit: 'ml' },
        { inventory_item_id: 'tonica', name: 'Tonica', qty: 1, unit: 'pz' },
        { name: 'Lavorazione', qty: 1, unit: 'U' },
      ],
    }
    expect(righeSostituite({ tipo: 'categoria', id: 'cgin' }, drink, SCELTI)).toEqual(['tanq'])
    expect(righeSostituite({ tipo: 'prodotto', id: 'tanq' }, drink, SCELTI)).toEqual(['tanq'])
    // Un prodotto che la ricetta non ha: niente da sostituire.
    expect(righeSostituite({ tipo: 'prodotto', id: 'hend' }, drink, SCELTI)).toEqual([])
    expect(righeSostituite({ tipo: 'categoria', id: 'cgin' }, null, SCELTI)).toEqual([])
    expect(
      etichettaPulita({ tipo: 'categoria', id: 'cgin', nome: 'Gin', scelta: { offerti: [], sostituisce: ['tanq', 'tanq', null] } }).scelta
    ).toEqual({ offerti: [], sostituisce: ['tanq'] })
  })
})
