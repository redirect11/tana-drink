// @vitest-environment happy-dom
'use strict'

// L'ACCESSO FINTO DELLA DEMO (REQ-FLOTTA-019). Niente Firebase Auth: si
// sceglie il ruolo. Si prova con le VERE onAuthStateChanged e signOut di
// Firebase, che passano la domanda all'oggetto che ricevono: è su questo
// che conta tutta l'app (venticinque punti leggono `auth.currentUser`).

import { describe, it, expect, beforeEach } from 'vitest'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { creaAuthDemo, utenteDemo, RUOLI_DEMO } from '../../src/demo/accesso.js'
import { nomeSessione, prossimaSessione, cacheDaButtare, giornataDemo } from '../../src/demo/sessione.js'

beforeEach(() => localStorage.clear())
const prossimo = () => new Promise((r) => setTimeout(r, 0))

describe('l’accesso finto', () => {
  it('i quattro ruoli da scegliere', () => {
    expect(RUOLI_DEMO.map((r) => r.id)).toEqual(['admin', 'bartender', 'staff', 'cliente'])
  })

  it('il ruolo sta nei claim, come nel token vero; il cliente è anonimo', async () => {
    expect((await utenteDemo('bartender').getIdTokenResult()).claims).toEqual({ role: 'bartender' })
    expect(utenteDemo('cliente')).toBeNull()
    expect(utenteDemo('inventato')).toBeNull()
  })

  it('funziona con onAuthStateChanged e signOut di Firebase', async () => {
    const auth = creaAuthDemo()
    const visti = []
    const smetti = onAuthStateChanged(auth, (u) => visti.push(u?.uid ?? null))
    await prossimo()
    expect(visti).toEqual([null])
    auth.scegliRuolo('admin')
    expect(auth.currentUser.uid).toBe('demo-admin')
    expect(visti).toEqual([null, 'demo-admin'])
    await signOut(auth)
    expect(auth.currentUser).toBeNull()
    expect(auth.ruoloScelto()).toBeNull()
    expect(visti).toEqual([null, 'demo-admin', null])
    smetti()
    auth.scegliRuolo('staff')
    expect(visti).toHaveLength(3)
  })

  it('il ruolo scelto si ricorda in questo browser', () => {
    creaAuthDemo().scegliRuolo('staff')
    const di_nuovo = creaAuthDemo()
    expect(di_nuovo.ruoloScelto()).toBe('staff')
    expect(di_nuovo.currentUser.displayName).toBe('Sala (demo)')
  })
})

describe('la sessione della demo', () => {
  const VEN = new Date('2026-10-30T21:00:00+01:00')
  const SAB = new Date('2026-10-31T21:00:00+01:00')

  it('una cache per giornata; «Ricomincia da capo» passa alla successiva', () => {
    expect(nomeSessione(VEN)).toBe('demo-2026-10-30-1')
    expect(nomeSessione(VEN)).toBe('demo-2026-10-30-1')
    expect(prossimaSessione(VEN)).toBe('demo-2026-10-30-2')
    expect(nomeSessione(VEN)).toBe('demo-2026-10-30-2')
    // Un giorno nuovo riparte da capo, coi dati di quel giorno.
    expect(nomeSessione(SAB)).toBe('demo-2026-10-31-1')
  })

  it('la giornata è quella commerciale: le 2 di notte sono ancora la sera prima', () => {
    expect(giornataDemo(new Date('2026-10-31T02:00:00+01:00'))).toBe('2026-10-30')
  })

  it('si buttano solo le cache delle altre sessioni demo', () => {
    const nomi = [
      'firestore/demo-2026-10-29-1/progetto/main',
      'firestore/demo-2026-10-30-1/progetto/main',
      'firestore/demo-2026-10-30-2/progetto/main',
      'firestore/[DEFAULT]/progetto/main',
      'altro-database',
    ]
    expect(cacheDaButtare(nomi, 'demo-2026-10-30-2')).toEqual([
      'firestore/demo-2026-10-29-1/progetto/main',
      'firestore/demo-2026-10-30-1/progetto/main',
    ])
  })
})
