'use strict'

// USCENDO SI SPENGONO GLI AVVISI DI QUEL DISPOSITIVO. Il token push è del
// browser, non della persona: dopo il logout restava valido e chi si era
// scollegato continuava a sentire suonare gli ordini del locale sul
// telefono di casa. Al prossimo accesso il dispositivo si registra da sé,
// quindi non si perde niente.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/api.js', () => ({
  clockOut: vi.fn(() => Promise.resolve()),
  rimuoviStaffToken: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/dispositivo.js', () => ({ idDispositivo: () => 'tablet-banco' }))
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: { currentUser: { uid: 'u1' } } }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/lib/push.js', () => ({ spegniPush: vi.fn(() => Promise.resolve(true)) }))

import { logoutStaff } from '../../src/lib/logout.js'
import { clockOut, rimuoviStaffToken } from '../../src/lib/api.js'
import { signOut } from 'firebase/auth'
import { spegniPush } from '../../src/lib/push.js'

beforeEach(() => vi.clearAllMocks())

describe('uscire dal gestionale', () => {
  it('toglie questo dispositivo dai destinatari degli avvisi', async () => {
    await logoutStaff()
    expect(rimuoviStaffToken).toHaveBeenCalledWith('u1', 'tablet-banco')
  })

  it('e si esce comunque, anche se non ci riesce', async () => {
    // Offline, o regole che non lo permettono: restare dentro sarebbe
    // peggio. Il token scade da sé.
    rimuoviStaffToken.mockRejectedValueOnce(new Error('offline'))
    await expect(logoutStaff()).resolves.not.toThrow()
    expect(signOut).toHaveBeenCalled()
  })

  it('prima timbra l’uscita, poi disconnette', async () => {
    await logoutStaff()
    expect(clockOut).toHaveBeenCalledWith({ uid: 'u1' })
    expect(signOut).toHaveBeenCalled()
  })
})

// ── IL TOKEN È DEL BROWSER, NON DELLA RUBRICA ────────────────────────
// Togliere la riga da `staff_tokens` spegne solo gli avvisi dello STAFF.
// Quelli del cliente («il tuo drink è pronto») hanno il token scritto
// sull'ORDINE: continuavano ad arrivare a chi si era scollegato. Si spegne
// il token, e allora non suona più niente da nessun mittente.
describe('uscendo, il browser non è più raggiungibile', () => {
  it('spegne il token push di questo dispositivo', async () => {
    await logoutStaff()
    expect(spegniPush).toHaveBeenCalled()
  })

  it('e si esce comunque se non ci riesce', async () => {
    spegniPush.mockRejectedValueOnce(new Error('niente token'))
    await expect(logoutStaff()).resolves.not.toThrow()
    expect(signOut).toHaveBeenCalled()
  })
})

// NIENTE PUÒ TENERE DENTRO CHI VUOLE USCIRE. Timbratura e rubrica sono
// scritture su Firestore, e una scrittura offline non torna mai: senza la
// scadenza, «Esci» restava a girare a vuoto col locale pieno e il telefono
// senza campo.
describe('uscire mentre la rete non c’è', () => {
  it('non resta appeso a una scrittura che non torna mai', async () => {
    vi.useFakeTimers()
    clockOut.mockReturnValueOnce(new Promise(() => {})) // non si risolve mai
    const uscita = logoutStaff()
    await vi.advanceTimersByTimeAsync(3000)
    await uscita
    expect(signOut).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
