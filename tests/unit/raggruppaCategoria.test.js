'use strict'

// LA CATEGORIA DI UNA VOCE DEL MENÙ DEI CLIENTI, E LE SEZIONI CHE NE
// NASCONO (REQ-MENU-041, src/lib/strutturaMenu.js). Daniele, 13/11/2026: la
// categoria si sceglie o si scrive; senza, vale quella del prodotto della
// cassa. «Raggruppa per categoria» crea le sezioni che mancano e ci sposta
// le voci, in fondo, nell'ordine di prima; quelle senza categoria e quelle
// già a posto non si toccano.

import { describe, it, expect } from 'vitest'
import { categoriaScritta, categoriaDellaVoce, sezioneDellaCategoria, raggruppamentoPerCategoria } from '../../src/lib/strutturaMenu.js'

const CASSA = [{ id: 'k-gin', name: 'Gin' }, { id: 'k-birre', name: 'Birre' }]
const DRINKS = [
  { id: 'mare', name: 'Gin Mare', category_id: 'k-gin' },
  { id: 'tanq', name: 'Tanqueray', category_id: 'k-gin' },
  { id: 'ipa', name: 'IPA', category_id: 'k-birre' },
  { id: 'acqua', name: 'Acqua', category_id: null },
]

describe('la categoria di una voce', () => {
  it('la sua, se scritta; se no quella del prodotto; se no nessuna', () => {
    expect(categoriaDellaVoce({ categoria: { tipo: 'testo', nome: 'Signature' } }, DRINKS[0], CASSA)).toBe('Signature')
    expect(categoriaDellaVoce({}, DRINKS[0], CASSA)).toBe('Gin')
    expect(categoriaDellaVoce({}, DRINKS[3], CASSA)).toBeNull()
    // Un'etichetta di un tipo che non è una categoria non vale.
    expect(categoriaScritta({ tipo: 'prodotto', id: 'x', nome: 'Tanqueray' })).toBeNull()
  })

  it('la sezione con quel nome, senza badare a maiuscole e accenti', () => {
    const sezioni = [{ id: 's1', nome: 'GIN' }]
    expect(sezioneDellaCategoria(sezioni, 'gin')?.id).toBe('s1')
    expect(sezioneDellaCategoria(sezioni, 'Rum')).toBeNull()
  })
})

describe('raggruppa per categoria', () => {
  const CARTA = {
    sezioni: [
      { id: 's-tutto', nome: 'Da bere', ordine: 0 },
      { id: 's-gin', nome: 'Gin', ordine: 1 },
    ],
    voci: [
      { id: 'v1', sezione_id: 's-tutto', drink_id: 'mare', ordine: 0 },
      { id: 'v2', sezione_id: 's-tutto', drink_id: 'ipa', ordine: 1 },
      { id: 'v3', sezione_id: 's-tutto', drink_id: 'acqua', ordine: 2 },
      { id: 'v4', sezione_id: 's-gin', drink_id: 'tanq', ordine: 0 },
      { id: 'v5', sezione_id: 's-tutto', drink_id: 'mare', ordine: 3, categoria: { tipo: 'testo', nome: 'Signature' } },
    ],
  }

  it('crea le sezioni che mancano e sposta le voci in fondo alla loro', () => {
    const { nuove, spostamenti } = raggruppamentoPerCategoria(CARTA, DRINKS, CASSA)
    expect(nuove).toEqual([
      { chiave: 'categoria:Birre', nome: 'Birre', ordine: 2 },
      { chiave: 'categoria:Signature', nome: 'Signature', ordine: 3 },
    ])
    expect(spostamenti).toEqual([
      // In fondo alla sezione Gin, che ha già Tanqueray.
      { id: 'v1', sezione: 's-gin', ordine: 1 },
      { id: 'v2', sezione: 'categoria:Birre', ordine: 0 },
      { id: 'v5', sezione: 'categoria:Signature', ordine: 0 },
    ])
  })

  it('una carta già in ordine non cambia', () => {
    const carta = { sezioni: [{ id: 's-gin', nome: 'Gin', ordine: 0 }], voci: [{ id: 'v4', sezione_id: 's-gin', drink_id: 'tanq', ordine: 0 }] }
    expect(raggruppamentoPerCategoria(carta, DRINKS, CASSA)).toEqual({ nuove: [], spostamenti: [] })
  })
})
