// @vitest-environment happy-dom
'use strict'

// BACKUP DEL DATABASE. Un backup si scopre sbagliato il giorno in cui
// serve, quindi qui si controlla la parte che si può controllare senza
// Firestore: che un file venga rifiutato quando non va bene, che il
// riassunto dica il vero, e che l'import scriva davvero tutto — anche
// quando le righe sono più del limite di un lotto (500).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Finto Firestore: registra le scritture invece di farle.
const scritture = []
const lotti = []
// Le impostazioni che ci sono nel database: il ripristino le legge per
// tenere la licenza di adesso (BUG-126). Le prove la cambiano.
const IMPOSTAZIONI_DI_PARTENZA = { menu_only: false }
let impostazioniNelDatabase = { bar: IMPOSTAZIONI_DI_PARTENZA }
vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ nome }),
  getDocs: vi.fn(async ({ nome }) => ({
    docs:
      nome === 'orders'
        ? [{ id: 'o1', data: () => ({ total: 8 }) }]
        : nome === 'settings'
          ? Object.entries(impostazioniNelDatabase).map(([id, dati]) => ({ id, data: () => dati }))
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
  SOLO_COPIA,
  FUORI_DAL_BACKUP,
} from '../../src/lib/backup.js'

beforeEach(() => {
  scritture.length = 0
  lotti.length = 0
  impostazioniNelDatabase = { bar: IMPOSTAZIONI_DI_PARTENZA }
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
    expect(Object.keys(b.collezioni)).toEqual([...COLLEZIONI, ...SOLO_COPIA])
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

  // REQ-LIC-008: le regole rifiutano le scritture dei moduli che la licenza
  // non include, e un documento rifiutato fa fallire il suo blocco e ferma
  // il ripristino a metà. Quelle collezioni si saltano, e lo si dice.
  it('le collezioni di un modulo che la licenza non include si saltano, e lo si dice', async () => {
    const { ricordaImpostazioni } = await import('../../src/lib/impostazioniLocali.js')
    ricordaImpostazioni({ licenza: { piano: 'free', moduli: { magazzino: false } } })
    try {
      const { scritti, fuoriLicenza } = await importaDatabase({
        formato: 1,
        collezioni: {
          orders: { righe: [{ id: 'o1', dati: {} }] },
          inventory_items: { righe: [{ id: 'gin', dati: { stock: 3 } }] },
        },
      })
      expect(scritti).toBe(1)
      expect(fuoriLicenza).toEqual(['inventory_items'])
      expect(scritture.map((w) => w.nome)).toEqual(['orders'])
    } finally {
      localStorage.clear()
    }
  })
})

// BUG-129: undici collezioni nate dopo l'elenco del backup non finivano
// nel file, e nessuno se n'era accorto (fra queste il menù dei clienti e lo
// storico delle vendite). L'elenco non si può chiedere a Firestore dal
// client, quindi lo si confronta con le regole: ogni collezione che le
// regole conoscono deve stare in uno dei tre elenchi del backup, e ogni
// collezione degli elenchi deve esistere davvero.
describe('il backup conosce tutte le collezioni (BUG-129)', () => {
  const regole = readFileSync(join(__dirname, '../../firestore.rules'), 'utf8')
  const nelleRegole = [...regole.matchAll(/^ {4}match \/([a-z_]+)\/\{/gm)].map((m) => m[1])
  const negliElenchi = [...COLLEZIONI, ...SOLO_COPIA, ...FUORI_DAL_BACKUP]

  it('ogni collezione delle regole è nel backup, o fuori con la sua ragione', () => {
    expect(nelleRegole.length).toBeGreaterThan(30)
    expect(nelleRegole.filter((c) => !negliElenchi.includes(c))).toEqual([])
  })

  it('ogni collezione del backup esiste nelle regole', () => {
    expect(negliElenchi.filter((c) => !nelleRegole.includes(c))).toEqual([])
  })

  it('nessuna collezione sta in due elenchi', () => {
    expect(new Set(negliElenchi).size).toBe(negliElenchi.length)
  })

  // Lo storico degli script si salva ma non si rimette dall'app: le regole
  // lo rifiutano, e un documento rifiutato fermerebbe il ripristino a metà.
  it('lo storico degli script si salva, ma il ripristino dall’app lo salta e lo dice', async () => {
    const { scritti, soloScript } = await importaDatabase({
      formato: 1,
      collezioni: {
        orders: { righe: [{ id: 'o1', dati: {} }] },
        vendite_storiche: { righe: [{ id: '2025-01-03', dati: { totale: 900 } }] },
      },
    })
    expect(scritti).toBe(1)
    expect(soloScript).toEqual(['vendite_storiche'])
    expect(scritture.map((w) => w.nome)).toEqual(['orders'])
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

// ── IL RIPRISTINO NON RIMETTE LA LICENZA (BUG-126) ────────────────────
// Il backup è una fotografia di quando è stato fatto, licenza compresa:
// in settings/bar c'è ancora la copia che la regia scrive per le versioni
// vecchie dell'app. Rimetterla vorrebbe dire tornare a un piano vecchio o
// togliersi una sospensione; e con le regole nuove, che quel campo non lo
// fanno cambiare a nessuno, il lotto delle impostazioni verrebbe rifiutato
// e il ripristino si fermerebbe a metà. Il resto delle impostazioni invece
// si rimette com'era nel file: è quello che chi ripristina vuole.
describe('il ripristino tiene la licenza che c’è adesso', () => {
  const LICENZA_DI_ADESSO = { piano: 'base', stato: 'sospesa', moduli: { magazzino: false } }
  const LICENZA_DEL_BACKUP = { piano: 'completo', stato: 'attiva', moduli: { magazzino: true } }
  const conImpostazioni = (dati) => ({
    formato: 1,
    collezioni: { settings: { righe: [{ id: 'bar', dati }] } },
  })

  it('settings/bar si rimette dal file, ma con la licenza del database', async () => {
    impostazioniNelDatabase = { bar: { venue_name: 'Oggi', licenza: LICENZA_DI_ADESSO } }
    await importaDatabase(conImpostazioni({ venue_name: 'Ieri', theme: 'notte', licenza: LICENZA_DEL_BACKUP }))
    expect(scritture).toHaveLength(1)
    expect(scritture[0].dati).toEqual({ venue_name: 'Ieri', theme: 'notte', licenza: LICENZA_DI_ADESSO })
  })

  it('se adesso la licenza lì non c’è, quella del file non entra', async () => {
    impostazioniNelDatabase = { bar: { venue_name: 'Oggi' } }
    await importaDatabase(conImpostazioni({ venue_name: 'Ieri', licenza: LICENZA_DEL_BACKUP }))
    expect(scritture[0].dati).toEqual({ venue_name: 'Ieri' })
  })

  it('un backup senza licenza non toglie quella che c’è', async () => {
    impostazioniNelDatabase = { bar: { licenza: LICENZA_DI_ADESSO } }
    await importaDatabase(conImpostazioni({ venue_name: 'Ieri' }))
    expect(scritture[0].dati).toEqual({ venue_name: 'Ieri', licenza: LICENZA_DI_ADESSO })
  })

  it('le altre collezioni si rimettono come sono, senza leggere niente', async () => {
    const { getDocs } = await import('firebase/firestore')
    getDocs.mockClear()
    await importaDatabase(backupFinto([{ id: 'o1', dati: { total: 8, licenza: 'non è roba sua' } }]))
    expect(scritture[0].dati).toEqual({ total: 8, licenza: 'non è roba sua' })
    expect(getDocs).not.toHaveBeenCalled()
  })

  it('la collezione della licenza vera, se un file la porta, si salta', async () => {
    const { scritti, saltate } = await importaDatabase({
      formato: 1,
      collezioni: {
        orders: { righe: [{ id: 'o1', dati: {} }] },
        licenza: { righe: [{ id: 'attuale', dati: LICENZA_DEL_BACKUP }] },
      },
    })
    expect(scritti).toBe(1)
    expect(saltate).toEqual(['licenza'])
    expect(scritture.map((w) => w.nome)).toEqual(['orders'])
  })
})
