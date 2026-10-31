// ── LA SCELTA SUGLI AGGIORNAMENTI È DEL TITOLARE (REQ-FLOTTA-020) ────────
//
// La regia propone una versione; il titolare risponde «Aggiorna» o «Salta»
// scrivendo `aggiornamenti/scelta`, che la regia va a leggere. Sta fuori da
// settings/ apposta: lì scrive ogni bartender. Qui si prova che il gesto
// del titolare passa, e che nessun altro — né il titolare con campi in più
// o fuori forma — ci scrive.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { avviaAmbiente, CHI } from './ambiente.js'

let env

beforeAll(async () => {
  env = await avviaAmbiente('aggiornamenti')
})
afterAll(async () => {
  await env?.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
})

const scelta = (extra = {}) => ({
  tag: 'v1.11.0',
  scelta: 'aggiorna',
  il: serverTimestamp(),
  da: 'admin-1',
  ...extra,
})
const sceltaDi = (db) => doc(db, 'aggiornamenti/scelta')

describe('il titolare sceglie', () => {
  it('«Aggiorna» e «Salta», a suo nome, si scrivono e si rileggono', async () => {
    const db = CHI.admin(env)
    await assertSucceeds(setDoc(sceltaDi(db), scelta()))
    await assertSucceeds(setDoc(sceltaDi(db), scelta({ scelta: 'salta', tag: 'v1.12.0' })))
    await assertSucceeds(getDoc(sceltaDi(db)))
  })

  it('non si cancella: la scelta resta finché la regia non propone altro', async () => {
    const db = CHI.admin(env)
    await setDoc(sceltaDi(db), scelta())
    await assertFails(deleteDoc(sceltaDi(db)))
  })
})

describe('nessun altro', () => {
  it('bartender, sala, cliente e chi non ha fatto il login non la scrivono né la leggono', async () => {
    for (const [chi, uid] of [['banco', 'banco-1'], ['sala', 'sala-1'], ['cliente', 'cliente-1']]) {
      const db = CHI[chi](env)
      await assertFails(setDoc(sceltaDi(db), scelta({ da: uid })))
      await assertFails(getDoc(sceltaDi(db)))
    }
    await assertFails(setDoc(sceltaDi(CHI.anonimo(env)), scelta({ da: null })))
    await assertFails(getDoc(sceltaDi(CHI.anonimo(env))))
  })
})

describe('e solo nella forma giusta', () => {
  it('a nome di un altro, no', async () => {
    await assertFails(setDoc(sceltaDi(CHI.admin(env)), scelta({ da: 'admin-2' })))
  })

  it('un campo in più o uno in meno, no', async () => {
    const db = CHI.admin(env)
    await assertFails(setDoc(sceltaDi(db), scelta({ nota: 'ciao' })))
    const { da: _da, ...senzaDa } = scelta()
    await assertFails(setDoc(sceltaDi(db), senzaDa))
  })

  it('un tag che non è un rilascio, no', async () => {
    const db = CHI.admin(env)
    for (const tag of ['1.11.0', 'v1.11', 'v1.11.0-beta', 'latest', 11]) {
      await assertFails(setDoc(sceltaDi(db), scelta({ tag })))
    }
  })

  it('una scelta che non è una delle due, no', async () => {
    await assertFails(setDoc(sceltaDi(CHI.admin(env)), scelta({ scelta: 'forse' })))
  })

  it('un\'ora scelta dal telefono invece che dal server, no', async () => {
    await assertFails(setDoc(sceltaDi(CHI.admin(env)), scelta({ il: new Date('2026-11-01') })))
  })

  it('un altro documento della collezione, no', async () => {
    await assertFails(setDoc(doc(CHI.admin(env), 'aggiornamenti/altro'), scelta()))
  })
})
