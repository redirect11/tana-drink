'use strict'

// IL BUNDLE DEI DATI DI PROVA SI CARICA NEL VERO FIRESTORE, A RETE SPENTA
// (REQ-FLOTTA-019). Non si prova il mock: si apre l'SDK vero, con la cache
// in memoria, si spegne la rete PRIMA di tutto, si carica il bundle e lo si
// rilegge dalla cache. Se il formato fosse sbagliato di un byte, loadBundle
// lo rifiuterebbe.

import { describe, it, expect, afterAll } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import {
  initializeFirestore,
  memoryLocalCache,
  disableNetwork,
  loadBundle,
  doc,
  collection,
  getDocFromCache,
  getDocsFromCache,
  getDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { creaBundle, valore } from '../../src/demo/bundle.js'
import { letturaDallaCache } from '../../src/lib/letture.js'

const app = initializeApp({ apiKey: 'demo', projectId: 'demo-bundle', appId: 'demo' }, 'bundle-demo')
const db = initializeFirestore(app, { localCache: memoryLocalCache() })
afterAll(() => deleteApp(app))

describe('i valori nel formato di Firestore', () => {
  it('numeri interi e decimali, testi, date, liste e oggetti', () => {
    expect(valore(3)).toEqual({ integerValue: '3' })
    expect(valore(6.5)).toEqual({ doubleValue: 6.5 })
    expect(valore('Spritz')).toEqual({ stringValue: 'Spritz' })
    expect(valore(null)).toEqual({ nullValue: null })
    expect(valore(true)).toEqual({ booleanValue: true })
    expect(valore(new Date('2026-10-30T20:00:00Z'))).toEqual({ timestampValue: '2026-10-30T20:00:00.000Z' })
    expect(valore([1, 'a'])).toEqual({ arrayValue: { values: [{ integerValue: '1' }, { stringValue: 'a' }] } })
    expect(valore({ a: { b: 1 } })).toEqual({ mapValue: { fields: { a: { mapValue: { fields: { b: { integerValue: '1' } } } } } } })
  })
})

describe('il bundle nel vero Firestore, a rete spenta', () => {
  it('si carica, e i documenti si leggono dalla cache con le query di sempre', async () => {
    await disableNetwork(db)
    const creato = new Date('2026-10-30T12:00:00Z')
    const bundle = creaBundle({
      progetto: 'demo-bundle',
      id: 'prova-1',
      creato,
      documenti: [
        { percorso: 'drinks/d1', dati: { name: 'Spritz', price: 6, available: true, recipe_items: [{ name: 'Aperol', qty: 40 }] } },
        { percorso: 'drinks/d2', dati: { name: 'Négroni «classico»', price: 8.5, available: false } },
        { percorso: 'orders/o1', dati: { status: 'pagato', created_at: new Date('2026-10-29T21:30:00Z'), total: 14.5 } },
        { percorso: 'vendite_storiche/_indice', dati: null },
      ],
    })
    const esito = await loadBundle(db, bundle)
    expect(esito.taskState).toBe('Success')
    expect(esito.documentsLoaded).toBe(4)

    const d1 = await getDocFromCache(doc(db, 'drinks', 'd1'))
    expect(d1.data()).toEqual({ name: 'Spritz', price: 6, available: true, recipe_items: [{ name: 'Aperol', qty: 40 }] })
    const disponibili = await getDocsFromCache(query(collection(db, 'drinks'), where('available', '==', true)))
    expect(disponibili.docs.map((x) => x.id)).toEqual(['d1'])
    // Le lettere accentate e le virgolette contano nei byte, non nei caratteri.
    expect((await getDocFromCache(doc(db, 'drinks', 'd2'))).data().name).toBe('Négroni «classico»')
    const o1 = (await getDocFromCache(doc(db, 'orders', 'o1'))).data()
    expect(o1.created_at).toBeInstanceOf(Timestamp)
    expect(o1.created_at.toDate().toISOString()).toBe('2026-10-29T21:30:00.000Z')
  })

  // `getDoc` a rete spenta va in errore su un documento che non c'è, anche
  // se la cache lo sa: è il motivo di letture.js. La lettura della demo
  // risponde dalla cache, per i documenti del bundle e per quelli mai visti.
  it('getDoc a rete spenta va in errore; la lettura della demo dice «non c’è»', async () => {
    await expect(getDoc(doc(db, 'vendite_storiche', '_indice'))).rejects.toThrow(/offline/)
    expect((await letturaDallaCache(doc(db, 'vendite_storiche', '_indice'))).exists()).toBe(false)
    expect((await letturaDallaCache(doc(db, 'mai', 'visto'))).exists()).toBe(false)
    expect((await letturaDallaCache(doc(db, 'drinks', 'd1'))).data().name).toBe('Spritz')
  })
})
