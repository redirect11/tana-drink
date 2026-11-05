'use strict'

// ── IL TITOLARE DEL LOCALE: LO STESSO ACCOUNT DELLA REGIA (REQ-FLOTTA-029) ──
//
// M7, 02/11/2026: quando la regia attivava un locale, il workflow riceveva
// l'uid del titolare e non lo usava; nel locale il titolare non aveva un
// account con quell'uid e l'avvio si chiudeva a mano. Ora la regia crea
// l'account con lo stesso uid e la stessa email, admin, senza password. Per
// i locali esistenti (la Tana) lo fa a mano scripts/titolare-locale.mjs con
// questa regola, copia di quella della regia (functions/lib/titolare.js di
// drink-regia): i casi qui sotto sono gli stessi dei suoi test.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { emailTitolare, uidTitolare, segnaposto, pianoTitolare, daRest } from '../../scripts/lib-titolare.js'

const EMAIL = 'mario@example.it'
const usato = (uid, extra = {}) => ({ uid, email: EMAIL, customClaims: { role: 'admin' }, providerData: [{ providerId: 'password' }], metadata: { lastSignInTime: 'ieri' }, ...extra })
const vuoto = (uid, extra = {}) => ({ uid, email: EMAIL, customClaims: { role: 'admin' }, providerData: [], metadata: {}, ...extra })

describe('email e uid del titolare', () => {
  it('l’email pulita e minuscola; vuota se manca; null se non è un’email', () => {
    expect(emailTitolare(' Mario@Example.IT ')).toBe(EMAIL)
    expect(emailTitolare('')).toBe('')
    expect(emailTitolare('mario')).toBeNull()
  })

  it('l’uid: lettere e cifre fino a 128; vuoto se manca; null se no', () => {
    expect(uidTitolare(' AbC123 ')).toBe('AbC123')
    expect(uidTitolare(undefined)).toBe('')
    expect(uidTitolare('a/b')).toBeNull()
    expect(uidTitolare('x'.repeat(129))).toBeNull()
  })
})

describe('il piano per il titolare', () => {
  it('nessun account: si crea con lo STESSO uid della regia, admin, col link per la password', () => {
    expect(pianoTitolare({ uid: 'U1', email: EMAIL })).toEqual({
      azione: 'crea',
      uid: 'U1',
      ruolo: { role: 'admin' },
      link: true,
      avvisi: [],
      daCancellare: null,
      emailVerificata: true,
      verifica: false,
    })
  })

  it('rilanciato su un titolare già entrato non cambia niente', () => {
    const u = usato('U1', { emailVerified: true })
    expect(pianoTitolare({ uid: 'U1', email: EMAIL, perUid: u, perEmail: u })).toEqual({
      azione: 'tieni',
      uid: 'U1',
      ruolo: null,
      link: false,
      avvisi: [],
      daCancellare: null,
      emailVerificata: true,
      verifica: false,
    })
  })

  it('un segnaposto mai usato con un altro uid si ricrea con quello della regia', () => {
    expect(pianoTitolare({ uid: 'U1', email: EMAIL, perEmail: vuoto('VECCHIO') })).toMatchObject({ azione: 'ricrea', uid: 'U1', daCancellare: 'VECCHIO' })
  })

  it('la Tana: l’account di Flavio, usato e con un altro uid, resta com’è; si dà solo il ruolo, con un avviso', () => {
    const p = pianoTitolare({ uid: 'U1', email: EMAIL, perEmail: usato('FLAVIO', { customClaims: {} }) })
    expect(p).toMatchObject({ azione: 'tieni', uid: 'FLAVIO', ruolo: { role: 'admin' }, daCancellare: null })
    expect(p.avvisi[0]).toMatch(/altro uid/)
  })

  it('l’account della regia con un’altra email resta lui; il link no, andrebbe a un altro account', () => {
    const p = pianoTitolare({ uid: 'U1', email: EMAIL, perUid: vuoto('U1', { email: 'vecchia@example.it' }), perEmail: vuoto('ALTRO') })
    expect(p).toMatchObject({ azione: 'tieni', uid: 'U1', link: false, daCancellare: null })
    expect(p.avvisi).toHaveLength(2)
  })

  it('senza uid lavora per email; i claim che ci sono restano', () => {
    expect(pianoTitolare({ email: EMAIL })).toMatchObject({ azione: 'crea', uid: null })
    expect(pianoTitolare({ email: EMAIL, perEmail: usato('X', { customClaims: { altro: 1 } }) }).ruolo).toEqual({ altro: 1, role: 'admin' })
  })

  it('segnaposto solo se senza password, mai entrato, senza altri accessi, con al più il ruolo admin', () => {
    expect(segnaposto(vuoto('A'))).toBe(true)
    expect(segnaposto(vuoto('A', { passwordHash: 'x' }))).toBe(false)
    expect(segnaposto(vuoto('A', { metadata: { lastSignInTime: 'ieri' } }))).toBe(false)
    expect(segnaposto(vuoto('A', { providerData: [{ providerId: 'google.com' }] }))).toBe(false)
    expect(segnaposto(vuoto('A', { customClaims: { role: 'bartender' } }))).toBe(false)
    // L'emulatore segna un accesso alla creazione (provato il 02/11/2026).
    expect(segnaposto(vuoto('A', { metadata: { creationTime: '1', lastSignInTime: '1' } }))).toBe(true)
    expect(segnaposto(vuoto('A', { metadata: { creationTime: '1', lastSignInTime: '1', lastRefreshTime: 'x' } }))).toBe(false)
  })
})

// REQ-FLOTTA-030: il passaggio fra regia e app accetta solo un account con
// la stessa email del titolare, VERIFICATA, e ruolo admin. L'account di
// Flavio alla Tana c'era prima della regia, e la sua email forse non lo è:
// il piano lo dice, e la si può segnare solo se è proprio quella del
// titolare — verificare l'email di un altro account darebbe il passaggio a
// lui.
describe('l’email verificata del titolare (REQ-FLOTTA-030)', () => {
  it('la Tana: l’account di Flavio con l’email non verificata si può segnare', () => {
    const p = pianoTitolare({ uid: 'U1', email: EMAIL, perEmail: usato('FLAVIO') })
    expect(p).toMatchObject({ azione: 'tieni', uid: 'FLAVIO', emailVerificata: false, verifica: true })
  })

  it('già verificata: niente da fare', () => {
    const p = pianoTitolare({ email: EMAIL, perEmail: usato('FLAVIO', { emailVerified: true }) })
    expect(p).toMatchObject({ emailVerificata: true, verifica: false })
  })

  it('l’account della regia con un’altra email: non si verifica', () => {
    const p = pianoTitolare({ uid: 'U1', email: EMAIL, perUid: usato('U1', { email: 'vecchia@example.it' }) })
    expect(p).toMatchObject({ uid: 'U1', emailVerificata: false, verifica: false })
  })

  it('lo script la segna solo con --verifica-email, e dopo il controllo di --applica', () => {
    const script = readFileSync('scripts/titolare-locale.mjs', 'utf8')
    expect(script).toContain("const VERIFICA_EMAIL = flag('verifica-email')")
    expect(script).toContain('const verificaOra = VERIFICA_EMAIL && cosa.verifica')
    expect(script.indexOf('if (!APPLICA)')).toBeLessThan(script.indexOf("chiama('accounts:update', { localId: uid, emailVerified: true })"))
  })
})

describe('dall’API REST di Identity Toolkit', () => {
  it('un utente di accounts:lookup diventa la forma dello UserRecord', () => {
    expect(daRest({ localId: 'U1', email: EMAIL, emailVerified: true, customAttributes: '{"role":"admin"}', providerUserInfo: [{ providerId: 'password' }], createdAt: '1', lastLoginAt: '2' })).toEqual({
      uid: 'U1',
      email: EMAIL,
      emailVerified: true,
      customClaims: { role: 'admin' },
      passwordHash: null,
      providerData: [{ providerId: 'password' }],
      metadata: { creationTime: '1', lastSignInTime: '2', lastRefreshTime: null },
    })
    expect(daRest(null)).toBeNull()
    expect(daRest({ localId: 'U1', customAttributes: 'rotto' }).customClaims).toEqual({})
  })
})

describe('lo script', () => {
  const script = readFileSync('scripts/titolare-locale.mjs', 'utf8')
  it('senza --applica non scrive niente, e la produzione si nomina a mano', () => {
    expect(script).toContain("const APPLICA = flag('applica')")
    expect(script.indexOf('if (!APPLICA)')).toBeLessThan(script.indexOf("chiama('accounts:delete'"))
    expect(script).toContain("arg('project') || (EMULATOR ? 'demo-tana-drink' : null)")
  })

  it('nessuna password: la imposta il titolare dal link di Firebase', () => {
    expect(script).toContain("requestType: 'PASSWORD_RESET'")
    // In italiano: la lingua va nell'intestazione, nel corpo non conta.
    expect(script).toContain("'X-Firebase-Locale': 'it'")
    // Nessun `password:` passato a Firebase in un oggetto (i commenti la nominano).
    expect(script).not.toMatch(/[{,]\s*password:/)
  })
})
