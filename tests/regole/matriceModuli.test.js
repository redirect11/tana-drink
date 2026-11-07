// ── LA MATRICE DEI MODULI, SULLE REGOLE VERE (REQ-DEV-017) ───────────────
//
// La metà che conta di tests/unit/matriceModuli.test.js: l'app nasconde, ma
// chi apre la console del browser scrive lo stesso, e a dire di no è il
// server. Qui le stesse licenze (nessun modulo, tutti, ognuno da solo, le
// righe a coppie) passano sull'emulatore con firestore.rules: in ogni
// collezione di un modulo si scrive se e solo se la licenza include uno dei
// suoi moduli, e un cliente apre un conto dal telefono se e solo se ci sono
// gli ordini dal telefono E il menù digitale (REQ-LIC-015).
//
// Che COLLEZIONI_DEI_MODULI dica le stesse cose delle promesse dei moduli
// lo controlla la prova unitaria; questa controlla che le regole dicano le
// stesse cose della tabella, scrivendo davvero.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { avviaAmbiente, CHI } from './ambiente.js'
import { COLLEZIONI_DEI_MODULI, MODULI_PREMIUM } from '../../src/lib/licenza.js'
import { licenzeDaProvare } from '../helpers/combinazioni.js'

let env

beforeAll(async () => {
  env = await avviaAmbiente('matrice-moduli')
})
afterAll(async () => {
  await env?.cleanup()
})
beforeEach(async () => {
  // A ogni licenza un database vuoto: il profilo di un cliente si controlla
  // solo quando nasce, e uno rimasto dalla licenza prima passerebbe come
  // modifica.
  await env.clearFirestore()
})

const prepara = (percorso, dati) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), percorso), dati))

// Chi scrive ogni collezione nell'app: il titolare tutto, il cliente solo
// il suo profilo.
const chi = (collezione) => (collezione === 'customers' ? CHI.cliente(env, 'cliente-1') : CHI.admin(env))
const percorso = (collezione) => (collezione === 'customers' ? 'customers/cliente-1' : `${collezione}/d1`)

// Il conto come esce da creaOrdine quando a ordinare è il cliente dal menù.
const contoDalMenu = () => ({
  daily_number: 12,
  status: 'aperto',
  comande: [{ id: 'c1', seq: 1, items: [], status: 'ricevuto' }],
  comande_statuses: ['ricevuto'],
  total: 18,
  placed_by: null,
  customer_uid: null,
  payment_status: 'non_richiesto',
  items: [{ drink_id: 'd1', name: 'Negroni', unit_price: 9, qty: 2 }],
})

const LICENZE = licenzeDaProvare(Object.keys(MODULI_PREMIUM))

describe.each(LICENZE)('con la licenza «$nome»', ({ moduli }) => {
  it('si scrive nelle collezioni dei moduli inclusi, e solo in quelle', async () => {
    await prepara('licenza/attuale', { piano: 'pro', stato: 'attiva', moduli })
    for (const [collezione, padroni] of Object.entries(COLLEZIONI_DEI_MODULI)) {
      const scrittura = setDoc(doc(chi(collezione), percorso(collezione)), { n: 1 })
      if (padroni.some((m) => moduli[m])) await assertSucceeds(scrittura)
      else await assertFails(scrittura)
    }
  })

  it('il cliente apre un conto dal telefono solo con gli ordini dal telefono e il menù digitale', async () => {
    await prepara('licenza/attuale', { piano: 'pro', stato: 'attiva', moduli })
    const conto = setDoc(doc(CHI.anonimo(env), 'orders/o1'), contoDalMenu())
    if (moduli.ordini_cliente && moduli.menu_tavoli) await assertSucceeds(conto)
    else await assertFails(conto)
    // La cassa invece c'è in ogni piano.
    await assertSucceeds(setDoc(doc(CHI.banco(env), 'orders/o2'), { ...contoDalMenu(), placed_by: 'banco-1' }))
  })
})
