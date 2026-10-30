'use strict'

// LE CHIAVI LOCALI CAMBIANO PREFISSO (REQ-VENUE-005), e i dispositivi della
// Tana non perdono carrello, stampante e preferenze: le chiavi vecchie si
// copiano sulle nuove al primo avvio, una volta sola, senza cancellare.

import { describe, it, expect } from 'vitest'
import { migraChiaviLocali } from '../../src/lib/migrazioneChiavi.js'

function storageFinto(iniziale = {}) {
  const m = new Map(Object.entries(iniziale))
  return {
    get length() {
      return m.size
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    tutto: () => Object.fromEntries(m),
  }
}

describe('migraChiaviLocali', () => {
  it('copia tana: e tana_ su drink: e drink_, e lascia le vecchie', () => {
    const s = storageFinto({ 'tana:zoom': '0.8', tana_printer_v2: '{"ip":"10.0.0.5"}', altro: 'x' })
    expect(migraChiaviLocali(s)).toBe(2)
    expect(s.tutto()).toEqual({
      'tana:zoom': '0.8',
      tana_printer_v2: '{"ip":"10.0.0.5"}',
      altro: 'x',
      'drink:zoom': '0.8',
      drink_printer_v2: '{"ip":"10.0.0.5"}',
    })
  })

  it('non sovrascrive una chiave nuova già scritta, e la seconda volta non fa niente', () => {
    const s = storageFinto({ 'tana:zoom': '0.8', 'drink:zoom': '1.2' })
    expect(migraChiaviLocali(s)).toBe(0)
    expect(s.getItem('drink:zoom')).toBe('1.2')
    expect(migraChiaviLocali(s)).toBe(0)
  })

  it('senza storage non si rompe', () => {
    expect(migraChiaviLocali(null)).toBe(0)
  })
})
