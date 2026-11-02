// ── LE REGOLE FANNO RISPETTARE LA LICENZA (REQ-LIC-008) ───────────────
//
// L'app nasconde quello che la licenza non include, ma chi apre la console
// del browser scrive lo stesso. Qui si prova che il server dice di no: i
// moduli non inclusi non si scrivono, gli sconti spenti non si mettono, e
// senza il modulo degli ordini dal telefono un cliente non apre un conto.
//
// E LA PROVA DOPPIA, come in tutte le regole: quello che la licenza include
// passa; senza documento della licenza (la Tana) passa tutto come prima;
// lo sconto che c'era già e lo sconto tolto passano anche senza sconti,
// perché succedono da soli o tolgono.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { avviaAmbiente, CHI } from './ambiente.js'
import { COLLEZIONI_DEI_MODULI } from '../../src/lib/licenza.js'

let env

beforeAll(async () => {
  env = await avviaAmbiente('licenza')
})
afterAll(async () => {
  await env?.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
})

const prepara = (percorso, dati) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), percorso), dati))
const conLicenza = (licenza) => prepara('licenza/attuale', licenza)

const TUTTI = Object.fromEntries(
  [...new Set(Object.values(COLLEZIONI_DEI_MODULI).flat())].map((id) => [id, true])
)
const NESSUNO = Object.fromEntries(Object.keys(TUTTI).map((id) => [id, false]))

// Chi scrive ogni collezione nell'app: il titolare può tutto, e il cliente
// scrive solo il suo profilo.
const chi = (collezione) => (collezione === 'customers' ? CHI.cliente(env, 'cliente-1') : CHI.admin(env))
const percorso = (collezione) => (collezione === 'customers' ? 'customers/cliente-1' : `${collezione}/d1`)

describe('le collezioni dei moduli', () => {
  it('senza il modulo nella licenza non si scrivono', async () => {
    await conLicenza({ piano: 'free', moduli: NESSUNO })
    for (const collezione of Object.keys(COLLEZIONI_DEI_MODULI)) {
      await assertFails(setDoc(doc(chi(collezione), percorso(collezione)), { n: 1 }))
    }
  })

  it('un modulo che la licenza non nomina vale come non incluso', async () => {
    await conLicenza({ piano: 'base', moduli: {} })
    await assertFails(setDoc(doc(CHI.admin(env), 'inventory_items/d1'), { n: 1 }))
  })

  it('col modulo nella licenza si scrivono', async () => {
    await conLicenza({ piano: 'pro', moduli: TUTTI })
    for (const collezione of Object.keys(COLLEZIONI_DEI_MODULI)) {
      await assertSucceeds(setDoc(doc(chi(collezione), percorso(collezione)), { n: 1 }))
    }
  })

  it('senza il documento della licenza (la Tana) si scrivono come prima', async () => {
    for (const collezione of Object.keys(COLLEZIONI_DEI_MODULI)) {
      await assertSucceeds(setDoc(doc(chi(collezione), percorso(collezione)), { n: 1 }))
    }
  })

  it('i dati di un modulo che non c’è più restano leggibili', async () => {
    await prepara('inventory_items/vecchio', { name: 'Gin', stock: 3 })
    await conLicenza({ piano: 'free', moduli: NESSUNO })
    const { getDoc } = await import('firebase/firestore')
    await assertSucceeds(getDoc(doc(CHI.admin(env), 'inventory_items/vecchio')))
  })

  it('le fatture dei fornitori passano con lo scadenzario o col magazzino', async () => {
    await conLicenza({ piano: 'base', moduli: { magazzino: true } })
    await assertSucceeds(setDoc(doc(CHI.admin(env), 'supplier_invoices/f1'), { n: 1 }))
    await conLicenza({ piano: 'base', moduli: { scadenzario: true } })
    await assertSucceeds(setDoc(doc(CHI.admin(env), 'supplier_invoices/f2'), { n: 1 }))
  })

  it('il cliente cambia e cancella il suo profilo anche senza il modulo: ha diritto di andarsene', async () => {
    await prepara('customers/cliente-1', { nome: 'Giulia' })
    await conLicenza({ piano: 'free', moduli: NESSUNO })
    const db = CHI.cliente(env, 'cliente-1')
    await assertSucceeds(updateDoc(doc(db, 'customers/cliente-1'), { nome: 'Giulia R.' }))
    const { deleteDoc } = await import('firebase/firestore')
    await assertSucceeds(deleteDoc(doc(db, 'customers/cliente-1')))
  })

  // Il lotto grosso del magazzino (la chiusura di un inventario, un
  // ripristino) legge la licenza per ogni documento: le letture dello stesso
  // documento contano una volta, e il lotto passa.
  it('un lotto di 60 articoli passa: la licenza si legge una volta', async () => {
    await conLicenza({ piano: 'pro', moduli: TUTTI })
    const db = CHI.admin(env)
    const lotto = writeBatch(db)
    for (let i = 0; i < 60; i++) lotto.set(doc(db, `inventory_items/i${i}`), { n: i })
    await assertSucceeds(lotto.commit())
  })
})

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

describe('gli ordini dal telefono del cliente', () => {
  it('senza il modulo il cliente non apre un conto', async () => {
    await conLicenza({ piano: 'free', moduli: { ordini_cliente: false } })
    await assertFails(setDoc(doc(CHI.anonimo(env), 'orders/o1'), contoDalMenu()))
  })

  it('col modulo, o senza licenza, sì', async () => {
    await assertSucceeds(setDoc(doc(CHI.anonimo(env), 'orders/o1'), contoDalMenu()))
    await conLicenza({ piano: 'pro', moduli: { ordini_cliente: true } })
    await assertSucceeds(setDoc(doc(CHI.anonimo(env), 'orders/o2'), contoDalMenu()))
  })

  it('il personale apre conti anche senza il modulo: è la cassa, che c’è in ogni piano', async () => {
    await conLicenza({ piano: 'free', moduli: NESSUNO })
    await assertSucceeds(setDoc(doc(CHI.banco(env), 'orders/o1'), { ...contoDalMenu(), placed_by: 'banco-1' }))
  })
})

describe('gli sconti', () => {
  const FREE = { piano: 'free', moduli: NESSUNO, limiti: { sconti: false } }
  const SCONTO = { type: 'percent', value: 10 }

  it('senza sconti non se ne mette uno nuovo, né aprendo il conto né dopo', async () => {
    await prepara('orders/o1', { ...contoDalMenu(), discount: null, discount_amount: 0 })
    await conLicenza(FREE)
    const db = CHI.admin(env)
    await assertFails(updateDoc(doc(db, 'orders/o1'), { discount: SCONTO, discount_amount: 1.8 }))
    await assertFails(setDoc(doc(db, 'orders/o2'), { ...contoDalMenu(), discount: SCONTO, discount_amount: 1.8 }))
    // Nemmeno l'importo da solo, senza lo sconto accanto.
    await assertFails(updateDoc(doc(db, 'orders/o1'), { discount_amount: 5 }))
  })

  it('senza sconti non se ne alza uno che c’era già', async () => {
    await prepara('orders/o1', { ...contoDalMenu(), discount: SCONTO, discount_amount: 1.8 })
    await conLicenza(FREE)
    await assertFails(updateDoc(doc(CHI.admin(env), 'orders/o1'), { discount: { type: 'percent', value: 50 } }))
  })

  it('lo sconto che c’era resta, si ricalcola con le righe, e si toglie', async () => {
    await prepara('orders/o1', { ...contoDalMenu(), discount: SCONTO, discount_amount: 1.8 })
    await conLicenza(FREE)
    const db = CHI.admin(env)
    // Le righe cambiano, l'importo segue: succede da solo (salvaComandeERifaiTotale).
    await assertSucceeds(updateDoc(doc(db, 'orders/o1'), { total: 27, discount_amount: 2.7 }))
    // Un aggiornamento che non tocca lo sconto passa.
    await assertSucceeds(updateDoc(doc(db, 'orders/o1'), { customer_name: 'Giulia R.' }))
    // E lo sconto si toglie (l'incasso lo azzera così).
    await assertSucceeds(updateDoc(doc(db, 'orders/o1'), { discount: null, discount_amount: 0 }))
  })

  it('con gli sconti nella licenza, o senza licenza, si mettono', async () => {
    await prepara('orders/o1', { ...contoDalMenu(), discount: null, discount_amount: 0 })
    await assertSucceeds(updateDoc(doc(CHI.admin(env), 'orders/o1'), { discount: SCONTO, discount_amount: 1.8 }))
    await conLicenza({ piano: 'pro', moduli: TUTTI, limiti: null })
    await assertSucceeds(updateDoc(doc(CHI.admin(env), 'orders/o1'), { discount: { type: 'euro', value: 2 }, discount_amount: 2 }))
    await conLicenza({ piano: 'base', moduli: TUTTI, limiti: { prodotti_max: 50 } })
    await assertSucceeds(updateDoc(doc(CHI.admin(env), 'orders/o1'), { discount: { type: 'euro', value: 3 }, discount_amount: 3 }))
  })
})
