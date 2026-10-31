// ── LA SALA CHIAMA IL BANCONE, E NIENT'ALTRO (REQ-STAFF-019) ─────────────
//
// Flavio, 30/10/2026: lo staff «può solo ricevere una chiamata dal bancone
// ma non può effettuarla». Le regole lasciavano creare una chiamata solo al
// bancone (admin e bartender). Adesso la sala ne può creare UNA sorta: al
// bancone (`to_role: 'admin'`), senza destinatario personale, firmata da
// sé, ancora da rispondere. Qui si prova il gesto buono e, con la stessa
// cura, che gli abusi restino chiusi.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { avviaAmbiente, CHI } from './ambiente.js'

let env

beforeAll(async () => {
  env = await avviaAmbiente('staff-calls')
})
afterAll(async () => {
  await env?.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
})

const alBancone = (from_uid = 'sala-1') => ({
  to_uid: null,
  to_email: null,
  to_role: 'admin',
  from_uid,
  from_email: null,
  from_name: 'Ciro',
  message: null,
  status: 'pending',
  acked_at: null,
})

describe('la sala chiama il bancone', () => {
  it('a suo nome, si può', async () => {
    await assertSucceeds(setDoc(doc(CHI.sala(env), 'staff_calls/c1'), alBancone()))
  })

  it('a nome di un altro, no', async () => {
    await assertFails(setDoc(doc(CHI.sala(env), 'staff_calls/c1'), alBancone('sala-2')))
  })

  it('una persona precisa, no: quello resta del bancone', async () => {
    await assertFails(setDoc(doc(CHI.sala(env), 'staff_calls/c1'), { ...alBancone(), to_uid: 'sala-2', to_role: null }))
    await assertFails(setDoc(doc(CHI.sala(env), 'staff_calls/c1'), { ...alBancone(), to_uid: 'admin-1' }))
  })

  it('una chiamata già «risposta», no', async () => {
    await assertFails(setDoc(doc(CHI.sala(env), 'staff_calls/c1'), { ...alBancone(), status: 'acked' }))
  })

  it('il cliente e chi non ha fatto il login non chiamano nessuno', async () => {
    await assertFails(setDoc(doc(CHI.cliente(env), 'staff_calls/c1'), alBancone('cliente-1')))
    await assertFails(setDoc(doc(CHI.anonimo(env), 'staff_calls/c1'), alBancone()))
  })

  it('il bancone chiama ancora chi vuole', async () => {
    await assertSucceeds(
      setDoc(doc(CHI.banco(env), 'staff_calls/c2'), { to_uid: 'sala-1', to_email: null, status: 'pending', message: 'Vieni' })
    )
  })
})
