'use strict'

// GLI INGREDIENTI CHE LEGGE IL CLIENTE (REQ-MENU-019). L'utente, 29/10/2026:
// «negli special devono uscire anche gli ingredienti del drink, e anche nel
// menu». Le ricette del test, stampate com'erano, dicevano al cliente
// «Ghiaccio Hoshizaki · Tempo di Lavorazione» e «Lime Succo Homemade 1kg -
// 50cl»: i casi qui sotto vengono da lì.

import { describe, it, expect } from 'vitest'
import { ingredientiInCarta, nomeInCarta, ingredientiDalCampo } from '../../src/lib/ingredientiCarta.js'

const riga = (name, qty, unit) => ({ inventory_item_id: name, name, qty, unit })

describe('gli ingredienti in carta', () => {
  it('quello che il gestore scrive nella scheda si legge così com’è, e vince sulla ricetta', () => {
    const d = {
      ingredienti: 'Gin, basilico fresco · lime\nzucchero',
      recipe_items: [riga('Tanqueray', 50, 'ml'), riga('Schweppes Tonica 18cl', 1, 'pz')],
    }
    expect(ingredientiInCarta(d)).toEqual(['Gin', 'basilico fresco', 'lime', 'zucchero'])
  })

  it('scritto vale anche con un ingrediente solo', () => {
    expect(ingredientiInCarta({ ingredienti: 'Tè nero' })).toEqual(['Tè nero'])
  })

  it('dalla ricetta restano fuori il ghiaccio e la manodopera, anche quella ancora in grammi', () => {
    const d = {
      recipe_items: [
        riga('Jim Beam', 50, 'ml'),
        riga('Limone Succo Homemade 1kg - 50cl', 25, 'ml'),
        riga('Ghiaccio Hoshizaki', 320, 'g'),
        riga('Tempo di Lavorazione', 1.5, 'g'),
        riga('Tempo di Lavorazione', 3, 'U'),
      ],
    }
    expect(ingredientiInCarta(d)).toEqual(['Jim Beam', 'Limone Succo Homemade'])
  })

  it('dal nome si toglie il formato della confezione', () => {
    expect(nomeInCarta('Schweppes Tonica 18cl')).toBe('Schweppes Tonica')
    expect(nomeInCarta('Zucchero Sciroppo Homemade 1kg - 150cl')).toBe('Zucchero Sciroppo Homemade')
    expect(nomeInCarta('Gin Mare 70 cl')).toBe('Gin Mare')
    expect(nomeInCarta('Angostura Bitter')).toBe('Angostura Bitter')
    // Un numero che non è un formato resta: è parte del nome.
    expect(nomeInCarta('Matusalem 7 anni')).toBe('Matusalem 7 anni')
  })

  it('con le quantità, se il locale le mostra', () => {
    const d = { recipe_items: [riga('Rum', 50, 'ml'), riga('Lime', 1, 'pz')] }
    expect(ingredientiInCarta(d, { quantita: true })).toEqual(['Rum 50 ml', 'Lime 1 pz'])
  })

  it('dalla ricetta, con meno di due ingredienti veri non si elenca niente', () => {
    expect(ingredientiInCarta({ recipe_items: [riga('Coca Cola Vetro', 1, 'pz'), riga('Ghiaccio Hoshizaki', 160, 'g')] })).toBeNull()
    expect(ingredientiInCarta({})).toBeNull()
    expect(ingredientiInCarta({ ingredienti: '  ,  ' })).toBeNull()
  })

  it('lo stesso ingrediente due volte si legge una', () => {
    const d = { recipe_items: [riga('Lime Succo Homemade 1kg - 50cl', 20, 'ml'), riga('Lime Succo Homemade', 10, 'ml'), riga('Rum', 50, 'ml')] }
    expect(ingredientiInCarta(d)).toEqual(['Lime Succo Homemade', 'Rum'])
  })

  it('il campo si divide su virgole, puntini e a capo', () => {
    expect(ingredientiDalCampo('a, b · c\nd')).toEqual(['a', 'b', 'c', 'd'])
    expect(ingredientiDalCampo(null)).toEqual([])
  })
})
