// ── LA SCELTA SUGLI AGGIORNAMENTI NON STA NEL DATABASE (REQ-FLOTTA-020) ──
//
// Fino al 31/10/2026 il titolare rispondeva «Aggiorna» o «Salta» scrivendo
// `aggiornamenti/scelta`, che la regia passava a leggere ogni dieci minuti.
// Ora la scelta è una chiamata alla regia (tests/component/
// PropostaAggiornamento.test.jsx), e il documento non ha più regole. Qui si
// prova che è chiuso davvero: nemmeno il titolare lo legge o lo scrive,
// perché un documento rimasto aperto è un posto dove qualcuno può
// continuare a scrivere scelte che nessuno legge più.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertFails } from '@firebase/rules-unit-testing'
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

const scelta = (da) => ({ tag: 'v1.11.0', scelta: 'aggiorna', il: serverTimestamp(), da })
const sceltaDi = (db) => doc(db, 'aggiornamenti/scelta')

describe('aggiornamenti/scelta non c’è più', () => {
  it('nemmeno il titolare lo scrive, lo legge o lo cancella', async () => {
    const db = CHI.admin(env)
    await assertFails(setDoc(sceltaDi(db), scelta('admin-1')))
    await assertFails(getDoc(sceltaDi(db)))
    await assertFails(deleteDoc(sceltaDi(db)))
  })

  it('e nessun altro: bartender, sala, cliente, chi non ha fatto il login', async () => {
    for (const [chi, uid] of [['banco', 'banco-1'], ['sala', 'sala-1'], ['cliente', 'cliente-1'], ['anonimo', null]]) {
      const db = CHI[chi](env)
      await assertFails(setDoc(sceltaDi(db), scelta(uid)))
      await assertFails(getDoc(sceltaDi(db)))
    }
  })
})
