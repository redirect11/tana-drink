// @vitest-environment happy-dom
'use strict'

// LE FRASI DELL'ACCESSO CON GOOGLE (REQ-FLOTTA-030), una volta sola per il
// banco e per i clienti. Erano finite solo nella lista del banco: un cliente
// col browser che blocca la finestra di Google leggeva «Errore di
// autenticazione», senza sapere che bastava consentirla.

import { describe, it, expect, vi } from 'vitest'

vi.mock('firebase/auth', () => ({}))
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: {} }))
vi.mock('../../src/porte/dati.js', () => ({}))
vi.mock('../../src/lib/api.js', () => ({}))
vi.mock('../../src/lib/push.js', () => ({}))
vi.mock('../../src/lib/notifyStore.js', () => ({}))

import { authError } from '../../src/lib/customerAuth.js'
import { ERRORI_GOOGLE } from '../../src/lib/erroriAccesso.js'

describe('le frasi dell’accesso con Google', () => {
  it('il cliente legge le stesse del banco', () => {
    for (const [codice, frase] of Object.entries(ERRORI_GOOGLE)) expect(authError(codice)).toBe(frase)
  })

  it('la finestra bloccata dice cosa fare, non un errore generico', () => {
    expect(authError('auth/popup-blocked')).toMatch(/va consentita/)
  })

  it('le frasi di sempre restano', () => {
    expect(authError('auth/invalid-credential')).toBe('Email o password non corretti.')
    expect(authError('codice-sconosciuto')).toBe('Errore di autenticazione. Riprova.')
  })
})
