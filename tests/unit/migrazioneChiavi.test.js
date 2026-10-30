'use strict'

// LE CHIAVI LOCALI CAMBIANO PREFISSO (REQ-VENUE-005), e i dispositivi della
// Tana non perdono carrello, stampante e preferenze: le chiavi vecchie si
// copiano sulle nuove al primo avvio, una volta sola, senza cancellare.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
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

// LA COPIA AVVIENE PRIMA DI OGNI LETTURA. progressivi.js legge i numeri
// assegnati e la cassa aperta già quando si carica, e gli import di
// main.jsx girano prima del suo codice: con la chiamata nel corpo di
// main.jsx, la prima sera dopo l'aggiornamento li avrebbe letti vuoti, la
// finestra dei due ordini #5 (BUG-074). Trovato nella revisione del
// 30/10/2026, prima di ogni rilascio.
describe('il passaggio delle chiavi all’avvio', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('è il primo import di main.jsx', () => {
    const main = readFileSync(new URL('../../src/main.jsx', import.meta.url), 'utf8')
    const primo = main.split(/\r?\n/).find((r) => r.startsWith('import '))
    expect(primo).toBe("import './lib/migrazioneAvvio.js'")
    expect(main).not.toMatch(/migraChiaviLocali\(/)
  })

  it('copia le chiavi già quando il modulo si carica', async () => {
    const s = storageFinto({ 'tana:progressivi': '{"a":5}', 'tana:cassa-aperta': '{"id":"c1"}' })
    vi.stubGlobal('localStorage', s)
    await import('../../src/lib/migrazioneAvvio.js')
    expect(s.getItem('drink:progressivi')).toBe('{"a":5}')
    expect(s.getItem('drink:cassa-aperta')).toBe('{"id":"c1"}')
  })
})
