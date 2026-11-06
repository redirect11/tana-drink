// @vitest-environment happy-dom
'use strict'

// LA STRUTTURA DEL MENÙ COME ARRIVA DA FIRESTORE (REQ-MENU-025, REQ-MENU-030).
//
// `subscribeCarta` copia i campi di ogni sezione uno per uno: un campo nuovo
// che non ci passa, al menù non arriva mai, anche se l'editor lo scrive. È
// successo col gruppo delle sezioni: la logica delle pagine era provata, la
// casella dell'editor scriveva, ma sulla demo il menù per gruppi si divideva
// per sezioni — il gruppo si perdeva qui, nella lettura.

import { describe, it, expect, vi } from 'vitest'

const ascolti = new Map()
const docFinto = (id, data) => ({ id, data: () => data })

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: null },
  functions: {},
  storage: {},
}))

vi.mock('firebase/firestore', async (originale) => ({
  ...(await originale()),
  collection: (_db, nome) => ({ nome }),
  doc: (_col, ...percorso) => ({ percorso }),
  onSnapshot: (col, cb) => {
    ascolti.set(col.nome, cb)
    return () => {}
  },
}))

const { subscribeCarta } = await import('../../src/lib/api.js')

describe('la struttura letta', () => {
  it('ogni sezione arriva col suo gruppo; senza, null', () => {
    let carta = null
    subscribeCarta((c) => {
      carta = c
    })
    ascolti.get('carta_sezioni')({
      docs: [
        docFinto('s-sig', { nome: 'Signature', ordine: 0, vista: 'dettagliata', gruppo: 'Cocktail' }),
        docFinto('s-birre', { nome: 'Birre', ordine: 1, vista: 'snella' }),
      ],
    })
    ascolti.get('carta_voci')({ docs: [] })
    expect(carta.sezioni.map((s) => [s.id, s.gruppo])).toEqual([
      ['s-sig', 'Cocktail'],
      ['s-birre', null],
    ])
  })
})
