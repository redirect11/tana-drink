'use strict'

// LE FRASI DI UNO STILE (REQ-MENU-027). L'utente, 05/11/2026, per lo stile
// alla Lewis Carroll: «titoli e frasi, tasti chiari». Le frasi cambiano i
// titoli e se ne aggiungono, ma chi ordina deve sempre leggere che cosa
// tocca e a che punto è: gli stati non si riscrivono, e il classico parla
// come ha sempre parlato.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { TESTI_STILE, testoStile } from '../../src/lib/testiStile.js'
import { ORDER_STATUSES } from '../../src/lib/orderStatus.js'
import { STILI_MENU } from '../../src/lib/stileMenu.js'

const SRC = join(__dirname, '../../src')
const sorgenti = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return sorgenti(p)
    return /\.(jsx?|mjs)$/.test(f) ? [readFileSync(p, 'utf8')] : []
  })
const codice = sorgenti(SRC).join('\n')

describe('le frasi dello stile', () => {
  it('senza stile, o con uno stile che non le scrive, restano quelle di sempre', () => {
    expect(testoStile(null, 'home.chi-siamo', 'Chi siamo')).toBe('Chi siamo')
    expect(testoStile('classico', 'home.chi-siamo', 'Chi siamo')).toBe('Chi siamo')
    expect(testoStile('lavagna', 'stato.numero', 'Il tuo numero')).toBe('Il tuo numero')
  })

  it('una frase in più, senza lo stile, non c’è', () => {
    expect(testoStile('classico', 'home.benvenuto')).toBeNull()
    expect(testoStile('meraviglie', 'home.benvenuto')).toMatch(/Meraviglie/)
  })

  it('«Meraviglie» ha una frase per ogni passo dell’ordine; l’annullato no', () => {
    // Un ordine annullato è un guaio di chi aspettava il suo drink: lì una
    // battuta sul tè non ci va, resta la frase di sempre.
    for (const s of Object.values(ORDER_STATUSES)) {
      const frase = testoStile('meraviglie', `stato.frase.${s}`)
      if (s === ORDER_STATUSES.ANNULLATO) expect(frase, s).toBeNull()
      else expect(frase, s).toBeTruthy()
    }
  })

  it('le frasi sono solo degli stili che esistono', () => {
    for (const id of Object.keys(TESTI_STILE)) expect(STILI_MENU.some((s) => s.id === id), id).toBe(true)
  })

  // Ogni chiave chiesta da una schermata c'è, e ogni frase scritta si
  // mostra da qualche parte: una chiave sbagliata in una pagina farebbe
  // tornare in silenzio la frase di sempre, e nessuno se ne accorgerebbe.
  it('le chiavi che le pagine chiedono e quelle scritte sono le stesse', () => {
    const chieste = new Set([
      ...[...codice.matchAll(/testo\('([a-z-]+\.[a-z.-]+)'/g)].map((m) => m[1]),
      ...[...codice.matchAll(/testoStile\(stile, '([a-z.-]+)'/g)].map((m) => m[1]),
    ])
    const scritte = Object.keys(TESTI_STILE.meraviglie)
    for (const k of chieste) expect(scritte, k).toContain(k)
    for (const k of scritte) {
      const usata = k.startsWith('stato.frase.') ? codice.includes('`stato.frase.${') : chieste.has(k)
      expect(usata, k).toBe(true)
    }
  })
})
