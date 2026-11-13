'use strict'

// IL MAZZO DELLO STILE «CARTE» (REQ-MENU-029). Le macro categorie del menù
// sono i semi, nell'ordine dello schizzo di Flavio (06/11/2026): cuori ai
// cocktail, fiori ai distillati, quadri a birre, amari e vini, picche a
// bevande e cucina. Le macro categorie sono i gruppi della struttura del
// menù (REQ-MENU-030); ogni sezione è una carta del suo seme, col suo
// valore.

import { describe, it, expect } from 'vitest'
import { carteDelMazzo, misuraNome, segnoDi, SEMI } from '../../src/lib/mazzoCarte.js'

const sez = (id, gruppo = null) => ({ id, nome: id, vista: 'piena', gruppo, voci: [] })
const semi = (carte) => carte.map((c) => `${c.valore}${c.seme.simbolo}`)

describe('il mazzo dalle sezioni del menù', () => {
  it('lo schizzo di Flavio: un seme per gruppo, i valori in fila dentro il seme', () => {
    const carte = carteDelMazzo([
      sez('Signature', 'Cocktail'),
      sez('Suggeriti', 'Cocktail'),
      sez('Grandi classici', 'Cocktail'),
      sez('Gin', 'Distillati'),
      sez('Rum', 'Distillati'),
      sez('Birre', 'Da bere'),
      sez('Vini', 'Da bere'),
      sez('Bevande', 'Bevande e cucina'),
    ])
    expect(semi(carte)).toEqual(['A♥', '2♥', '3♥', 'A♣', '2♣', 'A♦', '2♦', 'A♠'])
  })

  it('il seme segue il gruppo anche se le sue sezioni non sono vicine', () => {
    const carte = carteDelMazzo([sez('Signature', 'Cocktail'), sez('Gin', 'Distillati'), sez('Moderni', 'Cocktail')])
    expect(semi(carte)).toEqual(['A♥', 'A♣', '2♥'])
  })

  // Un seme a caso legherebbe sezioni che il gestore non ha messo insieme.
  it('una sezione senza gruppo fa gruppo da sé', () => {
    expect(semi(carteDelMazzo([sez('Signature'), sez('Gin'), sez('Birre')]))).toEqual(['A♥', 'A♣', 'A♦'])
  })

  // Oltre i quattro gruppi i semi ricominciano, ma i valori continuano: due
  // carte uguali nello stesso mazzo non ci sono.
  it('dal quinto gruppo i semi ricominciano, senza ripetere una carta', () => {
    const carte = carteDelMazzo(['a', 'b', 'c', 'd', 'e'].map((g) => sez(g, g)))
    expect(semi(carte)).toEqual(['A♥', 'A♣', 'A♦', 'A♠', '2♥'])
  })

  it('tiene i dati della sezione: nome, voci, gruppo', () => {
    const [c] = carteDelMazzo([{ ...sez('Gin', 'Distillati'), voci: [{ id: 'x' }] }])
    expect(c).toMatchObject({ id: 'Gin', nome: 'Gin', gruppo: 'Distillati', voci: [{ id: 'x' }] })
  })

  it('un mazzo vuoto è vuoto', () => {
    expect(carteDelMazzo([])).toEqual([])
  })
})

// I nomi della cassa sono in maiuscolo («AMERICANI»), e alla misura piena
// andavano a capo a metà parola: la carta rimpicciolisce la scritta in
// base alla parola più lunga, e una maiuscola pesa più di una minuscola.
describe('la misura del nome sulla carta', () => {
  it('conta la parola più lunga, non il nome intero', () => {
    expect(misuraNome('Gin e tonica')).toBe(misuraNome('tonica'))
  })

  it('in maiuscolo la stessa parola è più larga', () => {
    expect(misuraNome('DISTILLATI')).toBeGreaterThan(misuraNome('Distillati'))
  })

  it('un nome vuoto non misura niente', () => {
    expect(misuraNome('')).toBe(0)
    expect(misuraNome(null)).toBe(0)
  })
})

// Senza il selettore di testo, su alcuni telefoni ♥ e ♠ diventano emoji
// colorate: il seme non sarebbe più quello della carta.
it('il seme si scrive come segno di stampa, non come emoji', () => {
  for (const s of SEMI) expect(segnoDi(s)).toBe(`${s.simbolo}︎`)
})
