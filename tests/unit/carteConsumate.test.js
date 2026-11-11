// LE CARTE CONSUMATE DELLO STILE «CARTE» (REQ-MENU-029). L'utente,
// 11/11/2026: «il retro delle carte dovrebbe essere disegnato in stile Lewis
// Carroll, un po' più rovinato… sia del retro che avanti», e poi «non
// rovinarle tutte uguali». Dorsi e facce sono immagini in
// public/stili/carte/, che il foglio di stile usa come fondi.
//
// Un fondo che punta a un file che non c'è non dà nessun errore: la carta
// resta semplicemente senza disegno, e nessuno se ne accorge finché non
// guarda. Qui si controlla che ogni immagine citata esista, che i disegni
// siano davvero più d'uno, e che a disegnarli non sia il telefono.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const radice = join(__dirname, '..', '..')
const css = readFileSync(join(radice, 'src', 'index.css'), 'utf8')
const citate = [...new Set([...css.matchAll(/url\('\/(stili\/carte\/[^']+)'\)/g)].map((m) => m[1]))]

describe('le immagini delle carte consumate', () => {
  it('ogni immagine citata dal foglio di stile esiste', () => {
    expect(citate.length).toBeGreaterThan(0)
    for (const f of citate) expect(existsSync(join(radice, 'public', f)), f).toBe(true)
  })

  it('e ogni immagine della cartella è usata: nessun file dimenticato', () => {
    const inCartella = readdirSync(join(radice, 'public', 'stili', 'carte')).map((f) => `stili/carte/${f}`)
    expect(inCartella.sort()).toEqual([...citate].sort())
  })

  // «Non rovinarle tutte uguali»: più dorsi e più facce, distribuiti con
  // passi diversi lungo il mazzo.
  it('non sono rovinate tutte uguali: più dorsi, più facce, e i segni solo ad alcune', () => {
    expect(citate.filter((f) => /dorso-/.test(f)).length).toBeGreaterThanOrEqual(4)
    expect(citate.filter((f) => /carta-[a-d]\./.test(f)).length).toBeGreaterThanOrEqual(4)
    const passi = [...css.matchAll(/\.stile-carte \.k-carta:nth-of-type\((\d+)n/g)].map((m) => Number(m[1]))
    expect(new Set(passi).size).toBeGreaterThanOrEqual(3)
  })

  // Con i filtri di rumore nel foglio il browser ricalcolava il disegno per
  // ogni carta, e il menù si muoveva a scatti (visto registrando la demo:
  // 19 fotogrammi dove ce n'erano 170).
  it('i filtri di rumore non stanno nel foglio di stile', () => {
    expect(css).not.toMatch(/feTurbulence/)
  })

  it('ogni immagine ha il suo disegno di partenza accanto allo strumento che la genera', () => {
    for (const f of citate) {
      const svg = f.replace('stili/carte/', '').replace('.webp', '.svg')
      expect(existsSync(join(radice, 'scripts', 'carte-consumate', svg)), svg).toBe(true)
    }
  })
})
