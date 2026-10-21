import { describe, it, expect } from 'vitest'
import { riepilogoMovimenti, tipoDi } from '../../src/lib/movimentiProdotto.js'

// LA MOVIMENTAZIONE DI UN PRODOTTO (REQ-MAG-048). Flavio, 22/09/2026:
// «tutte le movimentazioni … suddivise in quelle da consegna di ordine a
// fornitore, carico diretto, modifica del contenuto reale, rimanenza reale
// durante la chiusura di un inventario». E le vendite di Tiller dal 2024.

// Un gin a bottiglie da 70 cl.
const GIN = { id: 'gin', unit: 'pz', package_size: 700, content_unit: 'ml' }
const mov = (reason, type, qty, unit, created_at) => ({ id: `${reason}${created_at}`, item_id: 'gin', reason, type, qty, unit, created_at })

describe('i tipi', () => {
  it('le vendite dell’app stanno insieme, un motivo sconosciuto fra le altre correzioni', () => {
    expect(tipoDi('ordine')).toBe('vendite')
    expect(tipoDi('modifica ordine')).toBe('vendite')
    expect(tipoDi('storno')).toBe('vendite')
    expect(tipoDi('ordine fornitore')).toBe('ordine fornitore')
    expect(tipoDi('boh')).toBe('altro')
  })
})

describe('il riepilogo del periodo', () => {
  const movimenti = [
    mov('ordine fornitore', 'load', 6, 'pz', '2026-09-02T10:00:00.000Z'),
    mov('carico', 'load', 1, 'pz', '2026-09-03T10:00:00.000Z'),
    mov('ordine', 'unload', 700, 'ml', '2026-09-20T21:00:00.000Z'),
    mov('storno', 'load', 350, 'ml', '2026-09-20T22:00:00.000Z'),
    mov('rettifica', 'unload', 0.5, 'pz', '2026-09-25T10:00:00.000Z'),
    mov('conta', 'load', 1, 'pz', '2026-09-30T10:00:00.000Z'),
  ]

  it('totali per tipo nell’unità della giacenza, col segno', () => {
    const r = riepilogoMovimenti(movimenti, GIN)
    expect(Object.fromEntries(r.tipi.map((t) => [t.id, t.q]))).toEqual({
      'ordine fornitore': 6,
      carico: 1,
      rettifica: -0.5,
      conta: 1,
      // 70 cl venduti, 35 tornati con uno storno: mezza bottiglia.
      vendite: -0.5,
    })
  })

  // Le vendite di Tiller non sono movimenti: arrivano per giornata.
  it('il venduto mese per mese mette accanto app e Tiller', () => {
    const r = riepilogoMovimenti(movimenti, GIN, { '2024-06-01': 1.5, '2024-06-02': 0.5, '2026-09-10': 0.25 })
    expect(r.mesi).toEqual([
      { mese: '2026-09', vendite: 0.5, tiller: 0.25 },
      { mese: '2024-06', vendite: 0, tiller: 2 },
    ])
    expect(r.tipi.find((t) => t.id === 'tiller').q).toBe(-2.25)
  })

  it('il periodo taglia movimenti e vendite di Tiller', () => {
    const r = riepilogoMovimenti(movimenti, GIN, { '2024-06-01': 1.5 }, { dal: '2026-09-20' })
    expect(r.tipi.map((t) => t.id)).toEqual(['rettifica', 'conta', 'vendite'])
    expect(r.righe).toHaveLength(4)
  })
})
