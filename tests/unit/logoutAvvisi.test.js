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

import { logoutStaff } from '../../src/lib/logout.js'
import { clockOut, rimuoviStaffToken } from '../../src/lib/api.js'
import { signOut } from 'firebase/auth'

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
