'use strict'

// ── LE REGOLE CHE STANNO DUE VOLTE, NELL'APP E NELLE FUNCTIONS ─────────
//
// Le Functions non possono importare da src/, e alcune regole del menù dei
// clienti stanno quindi in due copie (lo dicono i commenti, «la stessa
// regola di…»):
//   · le righe di servizio della ricetta (lavorazione, ghiaccio, unità
//     generica), che non fanno sparire una voce (REQ-MENU-017);
//   · le righe della ricetta che una scelta del cliente sostituisce: le
//     scrive l'editor, e la Function le riallinea quando la ricetta cambia
//     (REQ-MENU-042).
// Se le due copie si separano, l'editor scrive una cosa e la Function la
// riscrive diversa, e il supplemento cambia senza che nessuno lo veda. Qui
// le si fa rispondere sugli stessi casi.

import { describe, it, expect } from 'vitest'
import { rigaDiServizio } from '../../src/lib/ingredientiCarta.js'
import { righeSostituite } from '../../src/lib/etichetteIngredienti.js'

const funzioni = await import('../../functions/lib/disponibilita.js')

describe('le copie delle regole dicono la stessa cosa', () => {
  it('le righe di servizio', () => {
    const righe = [
      { name: 'Lavorazione', qty: 1, unit: 'U' },
      { name: 'Ghiaccio cubetti', qty: 100, unit: 'g' },
      { name: 'Gin Tanqueray', qty: 40, unit: 'ml' },
      { name: 'Porzione di lime', qty: 1, unit: 'u' },
      { name: 'Tonica', qty: 1, unit: 'pz' },
      { name: 'Ghiacciaia', qty: 1, unit: 'pz' },
    ]
    for (const r of righe) expect(funzioni.rigaDiServizio(r), r.name).toBe(rigaDiServizio(r))
  })

  it('le righe che la scelta sostituisce', () => {
    const items = [
      { id: 'tanq', category_id: 'gin' },
      { id: 'bombay', category_id: 'gin' },
      { id: 'tonica', category_id: 'bibite' },
    ]
    const categoriaDi = new Map(items.map((i) => [i.id, i.category_id]))
    const ricette = [
      [{ inventory_item_id: 'tanq', qty: 40 }, { inventory_item_id: 'tonica', qty: 1 }],
      [{ inventory_item_id: 'tanq', qty: 20 }, { inventory_item_id: 'bombay', qty: 20 }],
      [{ name: 'Lavorazione', qty: 1 }],
      [],
    ]
    const etichette = [
      { tipo: 'categoria', id: 'gin' },
      { tipo: 'prodotto', id: 'tanq' },
      { tipo: 'prodotto', id: 'bombay' },
      { tipo: 'testo', id: null },
    ]
    for (const ricetta of ricette) {
      for (const e of etichette) {
        expect(funzioni.righeDellEtichetta(e, ricetta, categoriaDi), `${e.tipo}:${e.id}`).toEqual(
          righeSostituite(e, { recipe_items: ricetta }, items)
        )
      }
    }
  })
})
