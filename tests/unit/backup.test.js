'use strict'

// BACKUP DEL DATABASE. Un backup si scopre sbagliato il giorno in cui
// serve, quindi qui si controlla la parte che si può controllare senza
// Firestore: che un file venga rifiutato quando non va bene, che il
// riassunto dica il vero, e che l'import scriva davvero tutto — anche
// quando le righe sono più del limite di un lotto (500).

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Finto Firestore: registra le scritture invece di farle.
const scritture = []
const lotti = []
vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ nome }),
  getDocs: vi.fn(async ({ nome }) => ({
    docs:
      nome === 'orders'
        ? [{ id: 'o1', data: () => ({ total: 8 }) }]
        : nome === 'settings'
          ? [{ id: 'bar', data: () => ({ menu_only: false }) }]
          : [],
  })),
  doc: (_db, nome, id) => ({ nome, id }),
  writeBatch: () => {
    const ops = []
    return {
      set: (ref, dati) => ops.push({ ...ref, dati }),
      commit: async () => {
        lotti.push(ops.length)
        scritture.push(...ops)
      },
    }
  },
}))
vi.mock('../../src/lib/firebaseClient.js', () => ({ db: {} }))

import {
  esportaDatabase,
  importaDatabase,
  validaBackup,
  riassunto,
  totaleRighe,
  nomeFile,
  COLLEZIONI,
} from '../../src/lib/backup.js'

beforeEach(() => {
  scritture.length = 0
  lotti.length = 0
})

const backupFinto = (righe) => ({
  formato: 1,
  creato_il: '2026-08-11T09:00:00.000Z',
  progetto: 'tana-drink-test',
  collezioni: { orders: { righe } },
})

describe('esportazione', () => {
  it('gira su tutte le collezioni e conta i documenti', async () => {
    const b = await esportaDatabase()
    expect(Object.keys(b.collezioni)).toEqual(COLLEZIONI)
    expect(b.documenti).toBe(2) // un ordine + settings/bar
    expect(b.collezioni.orders.righe[0]).toEqual({ id: 'o1', dati: { total: 8 } })
  })

  it('il nome del file porta progetto e data: tre backup non si chiamano uguale', () => {
    expect(nomeFile(backupFinto([]))).toBe('tana-drink-test-2026-08-11-09-00.json')
  })
})

describe('un file che non va bene si rifiuta PRIMA di scrivere', () => {
  it.each([
    [null, /non contiene un backup/i],
    [{ ciao: 1 }, /collezioni/i],
    [{ collezioni: { orders: { righe: [] } } }, /vuoto/i],
    [{ formato: 99, collezioni: { orders: { righe: [{ id: 'a', dati: {} }] } } }, /formato/i],
  ])('caso %#', (file, atteso) => {
    expect(validaBackup(file)).toMatch(atteso)
  })

  it('un backup buono passa', () => {
    expect(validaBackup(backupFinto([{ id: 'o1', dati: {} }]))).toBeNull()
  })

  it("importare un file invalido non scrive niente", async () => {
    await expect(importaDatabase({ ciao: 1 })).rejects.toThrow()
    expect(scritture).toHaveLength(0)
  })
})

describe('importazione', () => {
  it('riscrive i documenti del file', async () => {
    const { scritti } = await importaDatabase(
      backupFinto([
        { id: 'o1', dati: { total: 8 } },
        { id: 'o2', dati: { total: 5 } },
      ])
    )
    expect(scritti).toBe(2)
    expect(scritture.map((s) => s.id)).toEqual(['o1', 'o2'])
    expect(scritture[0].nome).toBe('orders')
  })

  it('oltre il limite di un lotto spezza, e non perde righe', async () => {
    const righe = Array.from({ length: 950 }, (_, i) => ({ id: `o${i}`, dati: { n: i } }))
    const { scritti } = await importaDatabase(backupFinto(righe))
    expect(scritti).toBe(950)
    expect(scritture).toHaveLength(950)
    expect(lotti).toEqual([400, 400, 150]) // tre commit, nessuno oltre il limite
  })

  it('una collezione che questa versione non conosce si salta, non si inventa', async () => {
    const { scritti, saltate } = await importaDatabase({
      formato: 1,
      collezioni: {
        orders: { righe: [{ id: 'o1', dati: {} }] },
        roba_futura: { righe: [{ id: 'x', dati: {} }] },
      },
    })
    expect(scritti).toBe(1)
    expect(saltate).toEqual(['roba_futura'])
  })
})

describe('riassunto per l’anteprima', () => {
  it('conta solo le collezioni con qualcosa dentro', () => {
    const b = {
      collezioni: {
        orders: { righe: [{ id: 'a' }, { id: 'b' }] },
        drinks: { righe: [] },
        suppliers: { righe: [{ id: 'c' }] },
      },
    }
    expect(riassunto(b)).toEqual([
      { nome: 'orders', righe: 2 },
      { nome: 'suppliers', righe: 1 },
    ])
    expect(totaleRighe(b)).toBe(3)
  })
})
