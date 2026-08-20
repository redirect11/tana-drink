import { describe, it, expect } from 'vitest'
import {
  groupCategoriesByMacro,
  categoryToMacro,
  macroOfItem,
  indiceMacro,
  macroDiCategoria,
} from '../../src/lib/macros.js'

const macros = [
  { id: 'm2', name: 'Vino', sort_order: 1 },
  { id: 'm1', name: 'Distillati', sort_order: 0 },
]
const cats = [
  { id: 'c1', name: 'Gin', macro_id: 'm1' },
  { id: 'c2', name: 'Rum', macro_id: 'm1' },
  { id: 'c3', name: 'Rossi', macro_id: 'm2' },
  { id: 'c4', name: 'Snack' }, // senza macro
  { id: 'c5', name: 'Vecchia', macro_id: 'zz' }, // macro non più esistente
]

describe('groupCategoriesByMacro', () => {
  it('raggruppa le categorie sotto le macro, nell’ordine delle macro', () => {
    const { groups } = groupCategoriesByMacro(macros, cats)
    expect(groups.map((g) => g.name)).toEqual(['Distillati', 'Vino']) // per sort_order
    expect(groups[0].categories.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(groups[1].categories.map((c) => c.id)).toEqual(['c3'])
  })

  it('mette tra le non assegnate le categorie senza macro o con macro sparita', () => {
    const { unassigned } = groupCategoriesByMacro(macros, cats)
    expect(unassigned.map((c) => c.id).sort()).toEqual(['c4', 'c5'])
  })

  it('regge input vuoti', () => {
    expect(groupCategoriesByMacro([], []).groups).toEqual([])
    expect(groupCategoriesByMacro(null, null).unassigned).toEqual([])
  })
})

describe('categoryToMacro / macroOfItem', () => {
  it('risale dall’item alla macro tramite la categoria', () => {
    const map = categoryToMacro(cats)
    expect(macroOfItem({ category_id: 'c1' }, map)).toBe('m1')
    expect(macroOfItem({ category_id: 'c3' }, map)).toBe('m2')
    expect(macroOfItem({ category_id: 'c4' }, map)).toBeNull() // categoria senza macro
    expect(macroOfItem({ category_id: 'ignota' }, map)).toBeNull()
    expect(macroOfItem({}, map)).toBeNull() // item senza categoria
  })
})

// ── DI CHE MACRO È QUESTA CATEGORIA (REQ-UI-022) ─────────────────────
// Serve agli ELENCHI delle categorie — magazzino e menù — che sono l'altro
// posto dove uno le guarda e dove la macro non si vedeva affatto: si
// usciva da lì convinti di aver sistemato tutto, e intanto una categoria
// era rimasta fuori.
describe('la macro di una categoria', () => {
  const indice = indiceMacro([
    { id: 'm1', name: 'Alcolici' },
    { id: 'm2', name: 'Birre e bibite' },
  ])

  it('torna la macro, col suo nome', () => {
    expect(macroDiCategoria({ id: 'c1', macro_id: 'm2' }, indice).name).toBe('Birre e bibite')
  })

  it('senza macro torna niente — e non è un errore', () => {
    // ALTRO (magazzino) e BOTTIGLIE (menù) stanno fuori APPOSTA.
    expect(macroDiCategoria({ id: 'c2' }, indice)).toBeNull()
    expect(macroDiCategoria({ id: 'c2', macro_id: null }, indice)).toBeNull()
    expect(macroDiCategoria(null, indice)).toBeNull()
  })

  // Stessa regola di groupCategoriesByMacro: il dato è rimasto attaccato
  // alla categoria, ma il gruppo non esiste più. Dire il contrario sarebbe
  // peggio del vuoto — si andrebbe a cercare una macro che non c'è.
  it('una macro cancellata vale come nessuna macro', () => {
    expect(macroDiCategoria({ id: 'c3', macro_id: 'sparita' }, indice)).toBeNull()
  })

  it('senza macro in giro non si rompe niente', () => {
    expect(macroDiCategoria({ macro_id: 'm1' }, indiceMacro(null))).toBeNull()
    expect(macroDiCategoria({ macro_id: 'm1' }, undefined)).toBeNull()
  })
})
