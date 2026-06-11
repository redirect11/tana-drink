'use strict'

// Unit test del parser dell'export CSV SumUp (src/lib/carteImport.js).

import { describe, it, expect } from 'vitest'
import { parseCsv, cleanText, parseCarteCsv, extractInventory, recipeLinkFor } from '../../src/lib/carteImport.js'

describe('parseCsv', () => {
  it('gestisce campi quotati con virgole e virgolette escapate', () => {
    const rows = parseCsv('a,"b,c","d""e"\n1,2,3')
    expect(rows).toEqual([['a', 'b,c', 'd"e'], ['1', '2', '3']])
  })

  it('gestisce campi multilinea quotati', () => {
    const rows = parseCsv('a,"riga1\nriga2",c\nx,y,z')
    expect(rows).toEqual([['a', 'riga1\nriga2', 'c'], ['x', 'y', 'z']])
  })

  it('salta righe vuote', () => {
    expect(parseCsv('a,b\n\n\nc,d\n')).toEqual([['a', 'b'], ['c', 'd']])
  })
})

describe('cleanText', () => {
  it("ripristina l'apostrofo tra lettere", () => {
    expect(cleanText('sott?olio')).toBe("sott'olio")
  })

  it('rimuove i ? orfani (emoji perse)', () => {
    expect(cleanText('BASILICONIGLIO ? ?')).toBe('BASILICONIGLIO')
    expect(cleanText('REGIN DI CUORI ??')).toBe('REGIN DI CUORI')
  })
})

const HEADER =
  'ProductId,SKU,CategoryName,CategoryColor,CategoryType,Name,Description,Type,Color,Price,Cost,Tax,Printer,Printer2,Barcode,Weight,UnitMeasure,Variable,Timed,,,'

describe('parseCarteCsv', () => {
  it('parsa prodotti con prezzo su due colonne (virgola decimale)', () => {
    const csv = [
      HEADER,
      '1,,BIBITE,#fff,PRODUCT,COCA,,,#000,2,50,0,0,22,0,Bar,,,FALSE,,FALSE,FALSE',
      '2,,BIBITE,#fff,PRODUCT,ACQUA,,,#000,1,0,0,0,22,0,Bar,,,FALSE,,FALSE,FALSE',
    ].join('\n')
    const { products, categories, skipped } = parseCarteCsv(csv)
    expect(products).toHaveLength(2)
    expect(products[0]).toMatchObject({ name: 'COCA', price: 2.5, category: 'BIBITE', sumup_product_id: '1' })
    expect(products[1].price).toBe(1)
    expect(categories).toEqual(['BIBITE'])
    expect(skipped).toBe(0)
  })

  it('salta righe con numero di campi errato', () => {
    const csv = [HEADER, 'riga,rotta', '1,,X,#fff,PRODUCT,OK,,,#000,3,0,0,0,22,0,Bar,,,FALSE,,FALSE,FALSE'].join('\n')
    const { products, skipped } = parseCarteCsv(csv)
    expect(products).toHaveLength(1)
    expect(skipped).toBe(1)
  })

  it('rifiuta file che non sono export SumUp', () => {
    expect(() => parseCarteCsv('colonna1,colonna2\na,b')).toThrow(/SumUp/)
  })

  it('categorie in ordine di prima apparizione', () => {
    const csv = [
      HEADER,
      '1,,BIRRE,#fff,PRODUCT,IPA,,,#000,4,0,0,0,22,0,Bar,,,FALSE,,FALSE,FALSE',
      '2,,BIBITE,#fff,PRODUCT,COLA,,,#000,2,0,0,0,22,0,Bar,,,FALSE,,FALSE,FALSE',
      '3,,BIRRE,#fff,PRODUCT,PILS,,,#000,4,0,0,0,22,0,Bar,,,FALSE,,FALSE,FALSE',
    ].join('\n')
    expect(parseCarteCsv(csv).categories).toEqual(['BIRRE', 'BIBITE'])
  })
})

describe('extractInventory', () => {
  const P = (category, name) => ({ category, name, price: 5 })

  it('include bottiglie e prodotti pronti, esclude fasce prezzo e preparazioni', () => {
    const { items } = extractInventory([
      P('DISTILLATI', 'JIM BEAM'),
      P('DISTILLATI', 'SHOT 3,50'),
      P('GIN & VODKA', 'HENDRIKS'),
      P('GIN & VODKA', 'GIN TONIC'),
      P('GIN & VODKA', 'LEMON 8'),
      P('COCKTAIL', 'NEGRONI'),
    ])
    expect(items.map((i) => i.name)).toEqual(['Jim Beam', 'Hendriks'])
  })

  it('assegna unità e categorie corrette', () => {
    const { items, categories } = extractInventory([
      P('BIRRE', 'CERES'),
      P('BIBITE', 'FEVER TREE'),
      P('BIBITE', 'RED BULL'),
      P('VINO', 'CALICE PROSECCO'),
    ])
    const byName = Object.fromEntries(items.map((i) => [i.name, i]))
    expect(byName['Ceres'].unit).toBe('pz')
    expect(byName['Fever Tree'].unit).toBe('ml')
    expect(byName['Red Bull'].unit).toBe('pz')
    expect(byName['Prosecco'].package_size).toBe(750)
    expect(categories.map((c) => c.key)).toContain('mixer')
  })

  it('deduplica per nome', () => {
    const { items } = extractInventory([
      P('VINO', 'CALICE PROSECCO'),
      P('VINO', 'PROSECCO BOTTIGLIA'),
    ])
    expect(items).toHaveLength(1)
  })
})

describe('recipeLinkFor', () => {
  it('collega distillati, birre e bibite con le quantità giuste', () => {
    expect(recipeLinkFor({ category: 'DISTILLATI', name: 'JIM BEAM', price: 5 }))
      .toEqual({ invName: 'Jim Beam', qty: 40, unit: 'ml' })
    expect(recipeLinkFor({ category: 'BIRRE', name: 'CERES', price: 4 }))
      .toEqual({ invName: 'Ceres', qty: 1, unit: 'pz' })
    expect(recipeLinkFor({ category: 'BIBITE', name: 'FEVER TREE', price: 3 }))
      .toEqual({ invName: 'Fever Tree', qty: 200, unit: 'ml' })
  })

  it('vino: calice vs bottiglia (per nome o prezzo)', () => {
    expect(recipeLinkFor({ category: 'VINO', name: 'CALICE PROSECCO', price: 5 }).qty).toBe(150)
    expect(recipeLinkFor({ category: 'VINO', name: 'PROSECCO BOTTIGLIA', price: 30 }).qty).toBe(750)
    expect(recipeLinkFor({ category: 'VINO', name: 'CALICE GRECO DI TUFO', price: 6 }))
      .toEqual({ invName: 'Greco Di Tufo', qty: 150, unit: 'ml' })
    expect(recipeLinkFor({ category: 'VINO', name: 'FALANGHINA', price: 20 }).qty).toBe(750)
  })

  it('non collega preparazioni e fasce prezzo', () => {
    expect(recipeLinkFor({ category: 'GIN & VODKA', name: 'GIN TONIC', price: 6 })).toBeNull()
    expect(recipeLinkFor({ category: 'DISTILLATI', name: 'SHOT 3,50', price: 3.5 })).toBeNull()
    expect(recipeLinkFor({ category: 'COCKTAIL', name: 'NEGRONI', price: 6 })).toBeNull()
  })
})
