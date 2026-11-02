'use strict'

// A RETE SPENTA LA DEMO NON ASPETTA UNA CONFERMA CHE NON ARRIVA
// (REQ-FLOTTA-019). L'utente, 30/10/2026: «il punto da controllare per
// primo è che, con la rete del database spenta, l'app non resti ferma ad
// aspettare la conferma di una scrittura».
//
// Qui Firestore è finto COME A RETE SPENTA: ogni scrittura resta appesa per
// sempre (la conferma del server non arriva mai), ma intanto finisce nella
// «cache», che è quello che succede davvero. Nella demo le scritture devono
// risolversi subito; nella build della Tana devono restare quelle di
// Firestore, identiche.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { accendiDemo, spegniDemo } from '../helpers/demo.js'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const MAI = () => new Promise(() => {})
const cache = new Map()
let ordine = []
let prossimoId = 0

vi.mock('firebase/firestore', () => ({
  doc: (padre, id) => ({ path: id ? `${padre.path}/${id}` : `${padre.path}/auto${++prossimoId}`, id: id || `auto${prossimoId}` }),
  setDoc: (ref, dati) => {
    ordine.push(`set ${ref.path}`)
    cache.set(ref.path, dati)
    return MAI()
  },
  updateDoc: (ref, patch) => {
    ordine.push(`update ${ref.path}`)
    cache.set(ref.path, { ...(cache.get(ref.path) || {}), ...patch })
    return MAI()
  },
  deleteDoc: (ref) => {
    ordine.push(`delete ${ref.path}`)
    cache.delete(ref.path)
    return MAI()
  },
  addDoc: (col, dati) => {
    const ref = { path: `${col.path}/auto${++prossimoId}`, id: `auto${prossimoId}` }
    cache.set(ref.path, dati)
    return MAI()
  },
  writeBatch: () => {
    const fatti = []
    return {
      set: (ref, dati) => fatti.push(() => cache.set(ref.path, dati)),
      commit: () => {
        fatti.forEach((f) => f())
        ordine.push('commit')
        return MAI()
      },
    }
  },
}))

// Risolta entro un giro: se la scrittura aspettasse il server, scadrebbe.
const entroPoco = (p) =>
  Promise.race([p.then((v) => ({ fatto: true, v })), new Promise((r) => setTimeout(() => r({ fatto: false }), 50))])

async function carica(demo) {
  vi.resetModules()
  accendiDemo(demo)
  // Le scritture stanno nell'adattatore Firebase della porta dei dati
  // (REQ-FLOTTA-021): è lì che la demo le conferma dalla cache.
  return import('../../src/adattatori/firebase/dati.js')
}

beforeEach(() => {
  cache.clear()
  ordine = []
  prossimoId = 0
})
afterEach(() => {
  spegniDemo()
})

describe('nella demo le scritture si confermano dalla cache', () => {
  it('setDoc, updateDoc e deleteDoc si risolvono subito, e la scrittura è nella cache', async () => {
    const w = await carica(true)
    const ref = { path: 'drinks/d1', id: 'd1' }
    expect((await entroPoco(w.setDoc(ref, { name: 'Spritz' }))).fatto).toBe(true)
    expect((await entroPoco(w.updateDoc(ref, { price: 6 }))).fatto).toBe(true)
    expect(cache.get('drinks/d1')).toEqual({ name: 'Spritz', price: 6 })
    expect((await entroPoco(w.deleteDoc(ref))).fatto).toBe(true)
    expect(cache.has('drinks/d1')).toBe(false)
  })

  it('addDoc sceglie l’id in locale e restituisce subito il riferimento', async () => {
    const w = await carica(true)
    const esito = await entroPoco(w.addDoc({ path: 'suppliers' }, { name: 'Fornitore' }))
    expect(esito.fatto).toBe(true)
    expect(esito.v.path).toMatch(/^suppliers\/auto\d+$/)
    expect(cache.get(esito.v.path)).toEqual({ name: 'Fornitore' })
  })

  it('il commit di un lotto si risolve subito', async () => {
    const w = await carica(true)
    const lotto = w.writeBatch({})
    lotto.set({ path: 'categories/c1' }, { name: 'Aperitivi' })
    expect((await entroPoco(lotto.commit())).fatto).toBe(true)
    expect(cache.get('categories/c1')).toEqual({ name: 'Aperitivi' })
  })

  it('le scritture partono nell’ordine in cui sono chieste', async () => {
    const w = await carica(true)
    const a = { path: 'orders/o1' }
    await w.setDoc(a, { status: 'ricevuto' })
    await w.updateDoc(a, { status: 'pronto' })
    expect(ordine).toEqual(['set orders/o1', 'update orders/o1'])
    expect(cache.get('orders/o1').status).toBe('pronto')
  })
})

describe('nella build di un locale vero le scritture sono quelle di Firestore', () => {
  it('aspettano la conferma del server, come sempre', async () => {
    const w = await carica(false)
    expect((await entroPoco(w.setDoc({ path: 'drinks/d1' }, {}))).fatto).toBe(false)
    expect((await entroPoco(w.updateDoc({ path: 'drinks/d1' }, {}))).fatto).toBe(false)
  })
})

describe('nessun modulo scrive (o legge un documento) scavalcando l’adattatore dei dati', () => {
  const SRC = join(__dirname, '..', '..', 'src')
  const file = []
  const giro = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) giro(p)
      else if (/\.(js|jsx)$/.test(f)) file.push(p)
    }
  }
  giro(SRC)
  // Gli strumenti di sviluppo scrivono sull'emulatore e non entrano nella
  // demo; l'adattatore Firebase è il punto di passaggio.
  const ESENTI = ['adattatori/firebase/', 'dev/']
  it.each(file.map((p) => relative(SRC, p).replace(/\\/g, '/')).filter((r) => !ESENTI.some((e) => r.startsWith(e))))(
    '%s',
    (rel) => {
      const testo = readFileSync(join(SRC, rel), 'utf8')
      const m = testo.match(/import\s*\{([^}]*)\}\s*from\s*'firebase\/firestore'/g) || []
      const nomi = m.flatMap((x) => x.replace(/^import\s*\{|\}\s*from.*$/g, '').split(',').map((n) => n.trim().split(/\s+as\s+/)[0]))
      // Anche getDoc: a rete spenta, su un documento che non c'è, va in
      // errore invece di dire «non c'è» — passa dall'adattatore.
      const scritture = nomi.filter((n) => ['setDoc', 'updateDoc', 'addDoc', 'deleteDoc', 'writeBatch', 'runTransaction', 'getDoc'].includes(n))
      expect(scritture, `${rel} importa ${scritture.join(', ')} da firebase/firestore`).toEqual([])
    }
  )
})
