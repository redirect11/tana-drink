// ── IL PROFILO DI CHI LAVORA: SUO E BASTA (REQ-UI-039) ──────────────────
//
// Daniele, 17/11/2026: «chiunque può scegliere la lingua nel gestionale,
// qualsiasi ruolo. La lingua è legata al profilo». Il profilo sta su
// profili_staff/{uid}: ogni ruolo dello staff scrive il SUO, nessuno quello
// degli altri, il cliente nessuno; e dentro solo la lingua, fra quelle
// che l'app conosce.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { avviaAmbiente, azzera, CHI } from './ambiente.js'

let env

beforeAll(async () => {
  env = await avviaAmbiente('profili-staff')
})
afterAll(async () => {
  await env?.cleanup()
})
beforeEach(async () => {
  await azzera(env)
})

const lingua = (l = 'en') => ({ lingua: l, aggiornato: serverTimestamp() })

describe('la lingua sul profilo di chi lavora', () => {
  it('ogni ruolo dello staff scrive e rilegge il suo', async () => {
    for (const [chi, uid] of [
      ['sala', 'sala-1'],
      ['banco', 'banco-1'],
      ['admin', 'admin-1'],
    ]) {
      const db = CHI[chi](env)
      await assertSucceeds(setDoc(doc(db, `profili_staff/${uid}`), lingua()))
      await assertSucceeds(getDoc(doc(db, `profili_staff/${uid}`)))
    }
  })

  it('quello di un altro no, nemmeno l’admin', async () => {
    await assertFails(setDoc(doc(CHI.admin(env), 'profili_staff/sala-1'), lingua()))
    await assertFails(getDoc(doc(CHI.admin(env), 'profili_staff/sala-1')))
    await assertFails(setDoc(doc(CHI.sala(env), 'profili_staff/banco-1'), lingua()))
  })

  it('il cliente e chi non ha fatto il login no', async () => {
    await assertFails(setDoc(doc(CHI.cliente(env), 'profili_staff/cliente-1'), lingua()))
    await assertFails(setDoc(doc(CHI.anonimo(env), 'profili_staff/sala-1'), lingua()))
  })

  it('dentro solo la lingua, e solo una che l’app conosce', async () => {
    const db = CHI.sala(env)
    await assertFails(setDoc(doc(db, 'profili_staff/sala-1'), lingua('xx')))
    await assertFails(setDoc(doc(db, 'profili_staff/sala-1'), { ...lingua(), role: 'admin' }))
    await assertSucceeds(setDoc(doc(db, 'profili_staff/sala-1'), lingua('it')))
  })
})
