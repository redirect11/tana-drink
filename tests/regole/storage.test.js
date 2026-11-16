// ── LE FOTO DEL MENÙ LE METTE IL BANCO, NON CHIUNQUE ABBIA UN ACCOUNT (BUG-160)
//
// Fino al 16/11/2026 la cartella `drinks/` di Storage chiedeva solo di aver
// fatto l'accesso. I clienti si registrano (src/lib/customerAuth.js), e un
// cliente registrato poteva caricare file da 5 MB senza limite — a spese del
// locale, REQ-DEV-026 — e cancellare le foto dei prodotti. Trovato nel
// controllo dei costi chiesto dalla regia.
//
// Gira contro l'EMULATORE Storage (porta 9199 di firebase.collaudo.json),
// con le regole vere di storage.rules. Come le altre prove delle regole:
// l'abuso va bloccato, e il gesto buono — il banco che mette la foto, il
// cliente che la vede nel menù — deve passare.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'

const REGOLE = readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8')
const HOST = process.env.STORAGE_EMULATOR_HOST_ONLY || '127.0.0.1'
const PORT = Number(process.env.STORAGE_EMULATOR_PORT || 9199)

// Un'immagine finta: alle regole interessano tipo e dimensione, non i pixel.
const FOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
const JPEG = { contentType: 'image/jpeg' }

let env

const chi = {
  anonimo: () => env.unauthenticatedContext().storage(),
  cliente: () => env.authenticatedContext('cliente-1').storage(),
  sala: () => env.authenticatedContext('sala-1', { role: 'staff' }).storage(),
  banco: () => env.authenticatedContext('banco-1', { role: 'bartender' }).storage(),
  admin: () => env.authenticatedContext('admin-1', { role: 'admin' }).storage(),
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'regole-storage',
    storage: { host: HOST, port: PORT, rules: REGOLE },
  })
})
afterAll(async () => {
  await env?.cleanup()
})
beforeEach(async () => {
  await env.clearStorage()
  await env.withSecurityRulesDisabled((ctx) => ctx.storage().ref('drinks/negroni.jpg').put(FOTO, JPEG))
})

describe('caricare una foto del menù', () => {
  it('il banco e l’admin la caricano', async () => {
    await assertSucceeds(chi.banco().ref('drinks/spritz.jpg').put(FOTO, JPEG))
    await assertSucceeds(chi.admin().ref('drinks/mojito.jpg').put(FOTO, JPEG))
  })

  it('un cliente registrato no: i file li pagherebbe il locale', async () => {
    await assertFails(chi.cliente().ref('drinks/mio.jpg').put(FOTO, JPEG))
  })

  it('né la sala né chi non ha fatto l’accesso', async () => {
    await assertFails(chi.sala().ref('drinks/sala.jpg').put(FOTO, JPEG))
    await assertFails(chi.anonimo().ref('drinks/anonimo.jpg').put(FOTO, JPEG))
  })

  it('anche al banco, solo immagini', async () => {
    await assertFails(chi.banco().ref('drinks/listino.pdf').put(FOTO, { contentType: 'application/pdf' }))
  })
})

describe('cancellare una foto del menù', () => {
  it('il banco la cancella', async () => {
    await assertSucceeds(chi.banco().ref('drinks/negroni.jpg').delete())
  })

  it('un cliente registrato no', async () => {
    await assertFails(chi.cliente().ref('drinks/negroni.jpg').delete())
  })
})

describe('vedere la foto', () => {
  it('la vede chiunque: il menù del cliente la mostra senza account', async () => {
    await assertSucceeds(chi.anonimo().ref('drinks/negroni.jpg').getMetadata())
  })
})
