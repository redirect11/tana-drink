'use strict'

// IL COLORE DI CHI LAVORA (REQ-ORD-023). Richiesta dell'08/11/2026: «se
// caricato da FLAVIO appare la F nel quadrato rosa e se caricato da ALEX
// appare A nel quadrato azzurro». Il colore viene dal nome, così è lo
// stesso su ogni terminale senza che nessuno lo configuri.

import { describe, it, expect } from 'vitest'
import { colorePersona, TINTE_PERSONE } from '../../src/lib/colorePersona.js'

describe('il colore di una persona', () => {
  it('Flavio è rosa e Alex azzurro, come nella richiesta', () => {
    expect(colorePersona({ name: 'Flavio', role: 'admin' })).toBe('#d6457a')
    expect(colorePersona({ name: 'Alex', role: 'staff' })).toBe('#2f7fc8')
  })

  it('è lo stesso per il nome scritto in qualunque modo, da una firma o dalla legenda', () => {
    expect(colorePersona('  FLAVIO ')).toBe(colorePersona({ name: 'flavio' }))
    // Senza nome conta la parte dell'email prima della @, come per l'iniziale.
    expect(colorePersona({ email: 'flavio@tana.it' })).toBe(colorePersona('Flavio'))
  })

  it('i nomi di una squadra si spargono sulle tinte, non finiscono tutti su una', () => {
    const squadra = ['Flavio', 'Alex', 'Ciro', 'Daniele', 'Marco', 'Luca', 'Giulia', 'Sara', 'Antonio', 'Peppe']
    expect(new Set(squadra.map(colorePersona)).size).toBeGreaterThanOrEqual(6)
    for (const n of squadra) expect(TINTE_PERSONE).toContain(colorePersona(n))
  })

  it('senza nome non c’è colore', () => {
    expect(colorePersona(null)).toBeNull()
    expect(colorePersona({})).toBeNull()
  })
})
