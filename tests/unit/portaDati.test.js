'use strict'

// ── LA PORTA DEI DATI: COSA OFFRE, E NIENTE DI PIÙ (REQ-FLOTTA-021) ───
//
// La porta è il confine fra l'app e il database: quello che offre è quello
// che un altro adattatore dovrà fare (docs/porte-e-adattatori.md). Se ci
// entra una funzione in più, il secondo adattatore ha un pezzo in più da
// scrivere: va deciso, non scivolato dentro. Il comportamento di ogni
// funzione lo provano i test di contratto, sull'emulatore
// (tests/contratto/dati.js, tests/regole/contrattoDati.test.js).

import { describe, it, expect, vi } from 'vitest'

// Il client diretto finto: ogni prova dice cosa risponde.
let lite = null
vi.mock('../../src/lib/firebaseClient.js', () => ({ db: 'IL-DATABASE', firestoreLite: () => lite() }))
vi.mock('firebase/firestore', () => ({
  Timestamp: { fromDate: (d) => ({ data: d }), fromMillis: (ms) => ({ ms }), now: () => 'ADESSO' },
}))

const porta = await import('../../src/porte/dati.js')
const adattatore = await import('../../src/adattatori/firebase/dati.js')

const CONTRATTO = [
  // riferimenti e ricerche
  'collection', 'doc', 'query', 'where', 'orderBy', 'limit', 'startAfter',
  // letture
  'getDoc', 'getDocs', 'getDocFromCache', 'getDocsFromCache', 'onSnapshot',
  // scritture
  'setDoc', 'updateDoc', 'addDoc', 'deleteDoc', 'writeBatch',
  // valori speciali e date
  'serverTimestamp', 'increment', 'arrayUnion', 'deleteField', 'Timestamp',
  // fuori dal giro di una serata, e il database
  'cercaDalServer', 'db',
]

describe('la porta dei dati', () => {
  it('offre il contratto, tutto e solo quello', () => {
    expect(Object.keys(porta).sort()).toEqual([...CONTRATTO].sort())
  })

  it('oggi ogni funzione è quella dell’adattatore Firebase', () => {
    for (const nome of CONTRATTO.filter((n) => !['cercaDalServer', 'db'].includes(n))) {
      expect(porta[nome], nome).toBe(adattatore[nome])
    }
    expect(porta.db).toBe('IL-DATABASE')
  })

  it('le date passano dalla classe di Firestore solo al momento della chiamata', () => {
    const d = new Date('2026-10-31T21:00:00Z')
    expect(porta.Timestamp.fromDate(d)).toEqual({ data: d })
    expect(porta.Timestamp.fromMillis(5)).toEqual({ ms: 5 })
    expect(porta.Timestamp.now()).toBe('ADESSO')
  })
})

describe('cercaDalServer', () => {
  it('traduce la ricerca per il client diretto, che va al server senza cache', async () => {
    const chiamate = []
    const sdk = {
      collection: (db, nome) => ({ db, nome }),
      where: (...a) => ['where', ...a],
      orderBy: (...a) => ['orderBy', ...a],
      query: (col, ...vincoli) => ({ col, vincoli }),
      getDocs: async (q) => {
        chiamate.push(q)
        return { docs: ['m1', 'm2'] }
      },
    }
    lite = async () => ({ db: 'DIRETTO', sdk })
    const da = new Date('2026-10-01T00:00:00Z')
    const docs = await porta.cercaDalServer('stock_movements', {
      dove: [['item_id', '==', 'gin'], ['created_at', '>=', da]],
      ordina: [['created_at', 'desc']],
    })
    expect(docs).toEqual(['m1', 'm2'])
    expect(chiamate).toEqual([
      {
        col: { db: 'DIRETTO', nome: 'stock_movements' },
        vincoli: [['where', 'item_id', '==', 'gin'], ['where', 'created_at', '>=', da], ['orderBy', 'created_at', 'desc']],
      },
    ])
  })

  it('senza client diretto (rete, demo) fallisce: chi chiama ripiega', async () => {
    lite = async () => {
      throw new Error('Nella demo il database non si raggiunge.')
    }
    await expect(porta.cercaDalServer('stock_movements')).rejects.toThrow(/demo/)
  })
})
