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
//
// E LO STORAGE SEGUE LA LICENZA (REQ-SIC-006, Daniele 17/11/2026): le regole
// leggono `licenza/attuale` da Firestore, quindi qui girano insieme gli
// emulatori di Storage e di Firestore. Le foto non sul Free; gli allegati
// delle fatture col loro modulo.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { LICENZA_VALIDA } from './ambiente.js'

const REGOLE = readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8')
const REGOLE_FIRESTORE = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')
const PORTA_FIRESTORE = Number(process.env.FIRESTORE_EMULATOR_PORT || 8081)
const HOST = process.env.STORAGE_EMULATOR_HOST_ONLY || '127.0.0.1'
const PORT = Number(process.env.STORAGE_EMULATOR_PORT || 9199)

// Un'immagine finta: alle regole interessano tipo e dimensione, non i pixel.
const FOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
const JPEG = { contentType: 'image/jpeg' }

// L'EMULATORE STORAGE C'È? In locale si accende con gli altri (vedi
// tests/regole/ambiente.js). Il job delle regole della CI accende ancora
// solo Firestore: Daniele ha detto sì ad accendere anche lo Storage
// (17/11/2026), la modifica al workflow la fa lui (REQ-SIC-006). Finché
// manca, lì le prove si saltano dicendolo, invece di far cadere tutto il
// giro.
const STORAGE_ACCESO = await fetch(`http://${HOST}:${PORT}/`, { signal: AbortSignal.timeout(2000) }).then(
  () => true,
  () => false
)
if (!STORAGE_ACCESO) console.warn(`[regole] emulatore Storage spento su ${HOST}:${PORT}: le prove di storage.rules si saltano`)

let env

const chi = {
  anonimo: () => env.unauthenticatedContext().storage(),
  cliente: () => env.authenticatedContext('cliente-1').storage(),
  sala: () => env.authenticatedContext('sala-1', { role: 'staff' }).storage(),
  banco: () => env.authenticatedContext('banco-1', { role: 'bartender' }).storage(),
  admin: () => env.authenticatedContext('admin-1', { role: 'admin' }).storage(),
}

describe.skipIf(!STORAGE_ACCESO)('storage.rules (emulatore Storage)', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      // IL PROGETTO DEGLI EMULATORI, non uno suo come le altre prove: l'emulatore
      // di Storage legge Firestore (`firestore.get` nelle regole) nel progetto
      // con cui è stato acceso, e con un id diverso la licenza non la trova
      // mai. I file delle regole girano in fila, quindi non si pestano i piedi.
      projectId: 'demo-tana-drink',
      storage: { host: HOST, port: PORT, rules: REGOLE },
      firestore: { host: HOST, port: PORTA_FIRESTORE, rules: REGOLE_FIRESTORE },
    })
  })
  afterAll(async () => {
    await env?.cleanup()
  })
  // Di partenza un locale in regola, con tutti i moduli: le prove dei ruoli
  // parlano d'altro. Quelle della licenza la riscrivono.
  const scriviLicenza = (licenza) =>
    env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'licenza/attuale'), licenza))
  beforeEach(async () => {
    await env.clearStorage()
    await env.clearFirestore()
    await scriviLicenza(LICENZA_VALIDA)
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

  describe('lo Storage segue la licenza (REQ-SIC-006)', () => {
    const IERI = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const PDF = { contentType: 'application/pdf' }

    it('sul Free le foto non si caricano, neanche dal banco', async () => {
      await scriviLicenza({ piano: 'free', stato: 'attiva', moduli: {} })
      await assertFails(chi.banco().ref('drinks/spritz.jpg').put(FOTO, JPEG))
    })

    it('né con la licenza scaduta verso il Free, né sospesa, né senza licenza', async () => {
      await scriviLicenza({ ...LICENZA_VALIDA, valida_fino_ts: IERI, alla_scadenza: 'free' })
      await assertFails(chi.banco().ref('drinks/a.jpg').put(FOTO, JPEG))
      await scriviLicenza({ ...LICENZA_VALIDA, stato: 'sospesa' })
      await assertFails(chi.banco().ref('drinks/b.jpg').put(FOTO, JPEG))
      await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'licenza/attuale')))
      await assertFails(chi.banco().ref('drinks/c.jpg').put(FOTO, JPEG))
    })

    it('un locale fermo vede e cancella le sue foto', async () => {
      await scriviLicenza({ ...LICENZA_VALIDA, stato: 'sospesa' })
      await assertSucceeds(chi.anonimo().ref('drinks/negroni.jpg').getMetadata())
      await assertSucceeds(chi.banco().ref('drinks/negroni.jpg').delete())
    })

    it('gli allegati delle fatture col modulo scadenzario o magazzino, non senza', async () => {
      await assertSucceeds(chi.banco().ref('fatture/f1/fattura.pdf').put(FOTO, PDF))
      await scriviLicenza({ ...LICENZA_VALIDA, moduli: { scadenzario: true } })
      await assertSucceeds(chi.banco().ref('fatture/f2/fattura.pdf').put(FOTO, PDF))
      await scriviLicenza({ ...LICENZA_VALIDA, moduli: {} })
      await assertFails(chi.banco().ref('fatture/f3/fattura.pdf').put(FOTO, PDF))
    })
  })
})
