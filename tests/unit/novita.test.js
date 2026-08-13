'use strict'

// LE NOVITÀ DI UNA VERSIONE. L'app si aggiorna da sé mentre la si usa, e chi
// lavora se ne accorge solo perché qualcosa "è cambiato di posto". Le note
// vanno portate davanti una volta, e poi mai più.

import { describe, it, expect } from 'vitest'
import { cosaFareAllAvvio, sezioneChangelog } from '../../src/lib/novita.js'

describe('cosaFareAllAvvio', () => {
  it('ha toccato «aggiorna»: le note gli si mettono davanti', () => {
    expect(cosaFareAllAvvio({ build: 'b2', vista: 'b1', attese: true })).toBe('box')
  })

  it('l’aggiornamento è arrivato da sé: resta un avviso in campanella', () => {
    expect(cosaFareAllAvvio({ build: 'b2', vista: 'b1', attese: false })).toBe('notifica')
  })

  it('stessa build di prima: non succede niente', () => {
    expect(cosaFareAllAvvio({ build: 'b2', vista: 'b2', attese: true })).toBe('niente')
    expect(cosaFareAllAvvio({ build: 'b2', vista: 'b2', attese: false })).toBe('niente')
  })

  // Un box di benvenuto con le note di rilascio non lo vuole nessuno: alla
  // prima apertura su un dispositivo nuovo si registra e basta.
  it('prima volta su questo dispositivo: silenzio', () => {
    expect(cosaFareAllAvvio({ build: 'b2', vista: null, attese: false })).toBe('niente')
  })

  it('senza id di build (sviluppo) non si inventa niente', () => {
    expect(cosaFareAllAvvio({ build: '', vista: null, attese: true })).toBe('niente')
  })
})

describe('sezioneChangelog', () => {
  const md = `# Cosa è cambiato

Le note di ogni versione.

---

## 1.4.0 — 13 agosto 2026

### Al banco

- La cosa nuova.

---

## 1.3.0 — 12 agosto 2026

- La cosa vecchia.
`

  it('prende il pezzo della versione chiesta, e solo quello', () => {
    const s = sezioneChangelog(md, 'v1.4.0')
    expect(s).toMatch(/1\.4\.0/)
    expect(s).toMatch(/La cosa nuova/)
    expect(s).not.toMatch(/La cosa vecchia/)
  })

  it('il numero si riconosce anche senza la v davanti', () => {
    expect(sezioneChangelog(md, '1.3.0')).toMatch(/La cosa vecchia/)
  })

  // Meglio le note di ieri che una finestra vuota.
  it('versione non trovata: torna la più recente', () => {
    expect(sezioneChangelog(md, 'v9.9.9')).toMatch(/La cosa nuova/)
  })

  it('senza changelog non esplode', () => {
    expect(sezioneChangelog('', 'v1.4.0')).toBe('')
    expect(sezioneChangelog(null, 'v1.4.0')).toBe('')
    expect(sezioneChangelog('nessun titolo qui', 'v1.4.0')).toBe('')
  })
})
