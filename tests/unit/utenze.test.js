'use strict'

// Chi può nominare chi (functions/lib/staff-service.js). È il punto in cui
// si danno le chiavi del locale: qui si controlla che non le prenda nessuno
// per sbaglio, e che l'ultimo admin non possa essere tolto di mezzo.

import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { staffAdmin } = require('../../functions/lib/staff-service.js')

// Finto Admin SDK: tiene le utenze in memoria e registra le chiamate.
function fintoAuth(utenti) {
  const db = new Map(utenti.map((u) => [u.uid, { metadata: {}, ...u }]))
  return {
    db,
    async listUsers() {
      return { users: [...db.values()] }
    },
    async createUser({ email, password, displayName }) {
      const uid = `uid-${email}`
      db.set(uid, { uid, email, password, displayName, metadata: {} })
      return db.get(uid)
    },
    async setCustomUserClaims(uid, claims) {
      db.get(uid).customClaims = claims ?? undefined
    },
    async updateUser(uid, patch) {
      Object.assign(db.get(uid), patch)
    },
    async deleteUser(uid) {
      db.delete(uid)
    },
  }
}
const chiamante = (uid, role) => ({ uid, token: role ? { role } : {} })

describe('staffAdmin — permessi', () => {
  let adminAuth
  beforeEach(() => {
    adminAuth = fintoAuth([
      { uid: 'a1', email: 'capo@bar.it', customClaims: { role: 'admin' } },
      { uid: 'b1', email: 'banco@bar.it', customClaims: { role: 'bartender' } },
      { uid: 's1', email: 'sala@bar.it', customClaims: { role: 'staff' } },
      { uid: 'c1', email: 'tizio@gmail.com' },
    ])
  })

  it('un cliente registrato non può fare niente', async () => {
    await expect(
      staffAdmin(adminAuth, chiamante('c1', null), { action: 'list' })
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('il bartender vede la rubrica del personale, senza i clienti', async () => {
    const { users } = await staffAdmin(adminAuth, chiamante('b1', 'bartender'), { action: 'list' })
    expect(users.map((u) => u.uid).sort()).toEqual(['a1', 'b1', 's1'])
  })

  it("l'elenco completo (clienti compresi) è solo dell'admin", async () => {
    await expect(
      staffAdmin(adminAuth, chiamante('b1', 'bartender'), { action: 'list', tutti: true })
    ).rejects.toMatchObject({ code: 'permission-denied' })
    const { users } = await staffAdmin(adminAuth, chiamante('a1', 'admin'), {
      action: 'list',
      tutti: true,
    })
    expect(users).toHaveLength(4)
    expect(users.find((u) => u.uid === 'c1').role).toBe('cliente')
  })

  it('il bartender non nomina nessuno', async () => {
    for (const data of [
      { action: 'setRole', uid: 's1', role: 'bartender' },
      { action: 'create', email: 'x@y.it', password: 'segreta', role: 'staff' },
      { action: 'delete', uid: 's1' },
      { action: 'setDisabled', uid: 's1', disabled: true },
    ]) {
      await expect(
        staffAdmin(adminAuth, chiamante('b1', 'bartender'), data)
      ).rejects.toMatchObject({ code: 'permission-denied' })
    }
  })
})

describe('staffAdmin — nomine', () => {
  let adminAuth
  const admin = chiamante('a1', 'admin')
  beforeEach(() => {
    adminAuth = fintoAuth([
      { uid: 'a1', email: 'capo@bar.it', customClaims: { role: 'admin' } },
      { uid: 'a2', email: 'socio@bar.it', customClaims: { role: 'admin' } },
      { uid: 's1', email: 'sala@bar.it', customClaims: { role: 'staff' } },
      { uid: 'c1', email: 'tizio@gmail.com' },
    ])
  })

  it('promuove un cliente registrato a staff', async () => {
    await staffAdmin(adminAuth, admin, { action: 'setRole', uid: 'c1', role: 'staff' })
    expect(adminAuth.db.get('c1').customClaims).toEqual({ role: 'staff' })
  })

  it('declassare a cliente TOGLIE il claim, non ne scrive uno', async () => {
    await staffAdmin(adminAuth, admin, { action: 'setRole', uid: 's1', role: 'cliente' })
    expect(adminAuth.db.get('s1').customClaims).toBeUndefined()
  })

  it('nomina un altro admin', async () => {
    await staffAdmin(adminAuth, admin, { action: 'setRole', uid: 's1', role: 'admin' })
    expect(adminAuth.db.get('s1').customClaims).toEqual({ role: 'admin' })
  })

  it('rifiuta ruoli inventati', async () => {
    await expect(
      staffAdmin(adminAuth, admin, { action: 'setRole', uid: 's1', role: 'padrone' })
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('non ci si tocca da soli (ruolo, sospensione, eliminazione)', async () => {
    for (const data of [
      { action: 'setRole', uid: 'a1', role: 'staff' },
      { action: 'setDisabled', uid: 'a1', disabled: true },
      { action: 'delete', uid: 'a1' },
    ]) {
      await expect(staffAdmin(adminAuth, admin, data)).rejects.toMatchObject({
        code: 'failed-precondition',
      })
    }
  })

  it('crea un account col ruolo scelto', async () => {
    const res = await staffAdmin(adminAuth, admin, {
      action: 'create',
      email: 'nuova@bar.it',
      password: 'segreta',
      role: 'bartender',
      name: 'Giulia',
    })
    expect(res.role).toBe('bartender')
    expect(adminAuth.db.get('uid-nuova@bar.it').customClaims).toEqual({ role: 'bartender' })
  })

  it('password corta: niente account', async () => {
    await expect(
      staffAdmin(adminAuth, admin, { action: 'create', email: 'x@y.it', password: 'ciao', role: 'staff' })
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('sospende e riattiva', async () => {
    await staffAdmin(adminAuth, admin, { action: 'setDisabled', uid: 's1', disabled: true })
    expect(adminAuth.db.get('s1').disabled).toBe(true)
    await staffAdmin(adminAuth, admin, { action: 'setDisabled', uid: 's1', disabled: false })
    expect(adminAuth.db.get('s1').disabled).toBe(false)
  })
})

describe("staffAdmin — l'ultimo admin non si tocca", () => {
  let adminAuth
  const admin = chiamante('a2', 'admin')
  beforeEach(() => {
    // a1 è l'unico ALTRO admin: chi chiama è a2, che però lo sta per
    // declassare — e dopo resterebbe lui. Quindi qui a1 NON è l'ultimo.
    adminAuth = fintoAuth([
      { uid: 'a1', email: 'capo@bar.it', customClaims: { role: 'admin' } },
      { uid: 'a2', email: 'socio@bar.it', customClaims: { role: 'admin' } },
    ])
  })

  it('con due admin, declassarne uno si può', async () => {
    await staffAdmin(adminAuth, admin, { action: 'setRole', uid: 'a1', role: 'bartender' })
    expect(adminAuth.db.get('a1').customClaims).toEqual({ role: 'bartender' })
  })

  it("rimasto un solo admin, non lo si declassa né sospende né elimina", async () => {
    const solo = fintoAuth([
      { uid: 'a1', email: 'capo@bar.it', customClaims: { role: 'admin' } },
      { uid: 'x', email: 'x@bar.it', customClaims: { role: 'admin' } },
    ])
    // x si declassa via a1… no: a1 declassa x, poi resta solo a1.
    await staffAdmin(solo, chiamante('a1', 'admin'), { action: 'setRole', uid: 'x', role: 'staff' })
    // Ora a1 è l'unico admin: nessuno può togliergli il ruolo.
    for (const data of [
      { action: 'setRole', uid: 'a1', role: 'staff' },
      { action: 'setDisabled', uid: 'a1', disabled: true },
      { action: 'delete', uid: 'a1' },
    ]) {
      await expect(staffAdmin(solo, chiamante('x2', 'admin'), data)).rejects.toMatchObject({
        code: 'failed-precondition',
      })
    }
    expect(solo.db.get('a1').customClaims).toEqual({ role: 'admin' })
  })

  it('un admin sospeso non conta come admin superstite', async () => {
    const conSospeso = fintoAuth([
      { uid: 'a1', email: 'capo@bar.it', customClaims: { role: 'admin' } },
      { uid: 'a3', email: 'ferie@bar.it', customClaims: { role: 'admin' }, disabled: true },
    ])
    await expect(
      staffAdmin(conSospeso, chiamante('z', 'admin'), { action: 'delete', uid: 'a1' })
    ).rejects.toMatchObject({ code: 'failed-precondition' })
  })
})
