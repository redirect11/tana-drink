// IL RICARICO SI SCRIVE ANCHE COME DRINK COST (REQ-MENU-033).
//
// Flavio, 09/11/2026: «io non penso a quanto moltiplicare il costo dei miei
// prodotti ma adesso si ragiona a quanto deve essere il drink cost», «vuoi
// fare il P3 allora il 33%, vuoi fare il P5 allora il 20%». Si salva solo
// il ricarico: il drink cost è il suo inverso, e scriverlo da una parte o
// dall'altra deve dare lo stesso prezzo consigliato.

import { describe, it, expect } from 'vitest'
import { drinkCostDi, ricaricoDaDrinkCost, suggestedPrice } from '../../src/lib/pricing.js'

describe('dal ricarico al drink cost', () => {
  it('×3 è il 33,3%, ×5 il 20%, ×4 il 25%', () => {
    expect(drinkCostDi(3)).toBe(33.3)
    expect(drinkCostDi(5)).toBe(20)
    expect(drinkCostDi(4)).toBe(25)
  })

  it('un ricarico che non c’è non diventa un drink cost', () => {
    expect(drinkCostDi(0)).toBeNull()
    expect(drinkCostDi(undefined)).toBeNull()
  })
})

describe('dal drink cost al ricarico', () => {
  it('20% è ×5, 25% è ×4, 33,3% torna ×3', () => {
    expect(ricaricoDaDrinkCost(20)).toBe(5)
    expect(ricaricoDaDrinkCost(25)).toBe(4)
    expect(ricaricoDaDrinkCost(33.3)).toBe(3)
  })

  it('un drink cost a zero o vuoto non dà un ricarico', () => {
    expect(ricaricoDaDrinkCost(0)).toBeNull()
    expect(ricaricoDaDrinkCost('')).toBeNull()
  })

  it('il prezzo consigliato è lo stesso, scritto in un modo o nell’altro', () => {
    const costo = 2.4
    expect(suggestedPrice(costo, { markup: ricaricoDaDrinkCost(20) })).toBe(suggestedPrice(costo, { markup: 5 }))
    expect(suggestedPrice(costo, { markup: ricaricoDaDrinkCost(drinkCostDi(3)) })).toBe(suggestedPrice(costo, { markup: 3 }))
  })
})
