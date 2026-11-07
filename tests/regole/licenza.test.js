// ── LE REGOLE FANNO RISPETTARE LA LICENZA (REQ-LIC-008, REQ-LIC-009) ──
//
// L'app nasconde quello che la licenza non include, ma chi apre la console
// del browser scrive lo stesso. Qui si prova che il server dice di no: i
// moduli non inclusi non si scrivono, gli sconti spenti non si mettono, e
// senza il modulo degli ordini dal telefono un cliente non apre un conto.
//
// E LA PROVA DOPPIA, come in tutte le regole: quello che la licenza include
// passa; lo sconto che c'era già e lo sconto tolto passano anche senza
// sconti, perché succedono da soli o tolgono.
//
// SENZA LICENZA VALIDA NON SI SCRIVE NIENTE (REQ-LIC-009): né senza
// documento — fino al 02/11/2026 voleva dire «nessun limite», per la Tana —
// né sospesa, chiusa o scaduta. Scaduta verso il Free si lavora coi limiti
// del Free. Le letture restano, e restano le uscite di chi se ne va.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, writeBatch, Timestamp } from 'firebase/firestore'
import { avviaAmbiente, CHI } from './ambiente.js'
import { COLLEZIONI_DEI_MODULI, conLicenzaAttuale } from '../../src/lib/licenza.js'

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

  it('i dati di un modulo che non c’è più restano leggibili', async () => {
    await prepara('inventory_items/vecchio', { name: 'Gin', stock: 3 })
    await conLicenza({ piano: 'free', moduli: NESSUNO })
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

  it('col modulo e il menù digitale sì', async () => {
    await conLicenza({ piano: 'pro', moduli: { menu_tavoli: true, ordini_cliente: true } })
    await assertSucceeds(setDoc(doc(CHI.anonimo(env), 'orders/o2'), contoDalMenu()))
  })

  // REQ-LIC-015: il cliente ordina DAL menù digitale. Senza, l'ordine non ha
  // da dove arrivare, e chi lo scrive a mano non passa.
  it('col modulo ma senza il menù digitale no', async () => {
    await conLicenza({ piano: 'pro', moduli: { ordini_cliente: true } })
    await assertFails(setDoc(doc(CHI.anonimo(env), 'orders/o3'), contoDalMenu()))
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

  it('con gli sconti nella licenza si mettono', async () => {
    await prepara('orders/o1', { ...contoDalMenu(), discount: null, discount_amount: 0 })
    await conLicenza({ piano: 'pro', moduli: TUTTI })
    await assertSucceeds(updateDoc(doc(CHI.admin(env), 'orders/o1'), { discount: SCONTO, discount_amount: 1.8 }))
    await conLicenza({ piano: 'pro', moduli: TUTTI, limiti: null })
    await assertSucceeds(updateDoc(doc(CHI.admin(env), 'orders/o1'), { discount: { type: 'euro', value: 2 }, discount_amount: 2 }))
    await conLicenza({ piano: 'base', moduli: TUTTI, limiti: { prodotti_max: 50 } })
    await assertSucceeds(updateDoc(doc(CHI.admin(env), 'orders/o1'), { discount: { type: 'euro', value: 3 }, discount_amount: 3 }))
  })
})

// ── SENZA LICENZA VALIDA (REQ-LIC-009) ────────────────────────────────
// Le scritture di tutti i giorni — un conto, un drink, le impostazioni,
// la cassa — che senza una licenza valida non passano più.
const ieri = () => Timestamp.fromMillis(Date.now() - 24 * 3600 * 1000)
const domani = () => Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000)
const COMPLETA = () => ({ piano: 'completo', stato: 'attiva', moduli: TUTTI })

async function scrittureDiOgniGiorno(atteso) {
  const db = CHI.admin(env)
  await atteso(setDoc(doc(db, 'orders/nuovo'), { ...contoDalMenu(), placed_by: 'admin-1' }))
  await atteso(setDoc(doc(db, 'drinks/d1'), { name: 'Negroni', price: 9 }))
  await atteso(setDoc(doc(db, 'settings/bar'), { venue_name: 'Il locale' }))
  await atteso(setDoc(doc(CHI.banco(env), 'cash_sessions/s1'), { aperta: true }))
}

describe('senza una licenza valida non si scrive niente (REQ-LIC-009)', () => {
  it('senza il documento della licenza: niente, nemmeno alla Tana', async () => {
    await scrittureDiOgniGiorno(assertFails)
    await assertFails(setDoc(doc(CHI.anonimo(env), 'orders/o1'), contoDalMenu()))
  })

  it('con la licenza sospesa, chiusa o non attivata: niente', async () => {
    for (const stato of ['sospesa', 'chiusa', 'non_attivata']) {
      await conLicenza({ ...COMPLETA(), stato })
      await scrittureDiOgniGiorno(assertFails)
    }
  })

  it('con la licenza attiva e non scaduta: tutto, come sempre', async () => {
    await conLicenza({ ...COMPLETA(), valida_fino_ts: domani() })
    await scrittureDiOgniGiorno(assertSucceeds)
  })

  it('scaduta, con «ferma» o senza dire cosa fare: niente', async () => {
    await conLicenza({ ...COMPLETA(), valida_fino_ts: ieri(), alla_scadenza: 'ferma' })
    await scrittureDiOgniGiorno(assertFails)
    await conLicenza({ ...COMPLETA(), valida_fino_ts: ieri() })
    await scrittureDiOgniGiorno(assertFails)
  })

  it('scaduta verso il Free: si lavora, senza moduli, sconti né ordini dal telefono', async () => {
    await conLicenza({ ...COMPLETA(), valida_fino_ts: ieri(), alla_scadenza: 'free' })
    await scrittureDiOgniGiorno(assertSucceeds)
    const db = CHI.admin(env)
    await assertFails(setDoc(doc(db, 'inventory_items/d1'), { n: 1 }))
    await assertFails(
      setDoc(doc(db, 'orders/scontato'), {
        ...contoDalMenu(),
        placed_by: 'admin-1',
        discount: { type: 'percent', value: 10 },
        discount_amount: 1.8,
      })
    )
    await assertFails(setDoc(doc(CHI.anonimo(env), 'orders/dal-telefono'), contoDalMenu()))
  })

  it('una scadenza scritta come testo le regole non la leggono: non scade', async () => {
    await conLicenza({ ...COMPLETA(), valida_fino_ts: '2020-01-01T00:00:00Z', alla_scadenza: 'ferma' })
    await scrittureDiOgniGiorno(assertSucceeds)
  })

  it('i dati restano leggibili, fino alla cancellazione', async () => {
    await prepara('orders/vecchio', { ...contoDalMenu() })
    await prepara('inventory_items/gin', { name: 'Gin' })
    await conLicenza({ ...COMPLETA(), stato: 'sospesa' })
    await assertSucceeds(getDoc(doc(CHI.admin(env), 'orders/vecchio')))
    await assertSucceeds(getDoc(doc(CHI.admin(env), 'inventory_items/gin')))
    await assertSucceeds(getDoc(doc(CHI.anonimo(env), 'licenza/attuale')))
  })

  it('chi se ne va può: il profilo cliente, il token delle notifiche, la presenza', async () => {
    await prepara('customers/cliente-1', { nome: 'Giulia' })
    await prepara('staff_tokens/banco-1', { uid: 'banco-1', token: 't' })
    await prepara('presenze/banco-1', { dal: 1 })
    await assertSucceeds(deleteDoc(doc(CHI.cliente(env, 'cliente-1'), 'customers/cliente-1')))
    await assertSucceeds(deleteDoc(doc(CHI.banco(env), 'staff_tokens/banco-1')))
    await assertSucceeds(deleteDoc(doc(CHI.banco(env), 'presenze/banco-1')))
  })
})

// ── LA LICENZA RIMASTA IN settings/bar (BUG-126, H2 dell'audit) ───────
// La regia la scrive ancora lì per le versioni vecchie dell'app, con le
// credenziali di servizio. Dall'app quel campo non lo tocca nessuno: né il
// banco né il titolare, né aggiungendolo, né cambiandolo, né togliendolo.
// E LA PROVA DOPPIA: tutto il resto delle impostazioni il banco e il
// titolare lo scrivono come prima — sono temi, orari, stampa, pagamenti.
describe('settings/bar.licenza non la scrive nessuno dall’app (BUG-126)', () => {
  // Un locale Base, senza moduli: quello che a togliersi i limiti ci guadagna.
  const LICENZA_REGIA = () => ({ piano: 'base', stato: 'attiva', moduli: NESSUNO, valida_fino_ts: domani() })
  const conBar = (extra = {}) => prepara('settings/bar', { venue_name: 'Il locale', licenza: LICENZA_REGIA(), ...extra })

  beforeEach(async () => {
    await conLicenza(COMPLETA())
  })

  it('il banco e il titolare non la cambiano, in nessun modo', async () => {
    await conBar()
    for (const db of [CHI.banco(env), CHI.admin(env)]) {
      const bar = doc(db, 'settings/bar')
      await assertFails(updateDoc(bar, { licenza: { piano: 'completo', stato: 'attiva' } }))
      await assertFails(updateDoc(bar, { 'licenza.piano': 'completo' }))
      await assertFails(setDoc(bar, { licenza: { moduli: { magazzino: true } } }, { merge: true }))
      await assertFails(updateDoc(bar, { licenza: deleteField() }))
      // Una set senza merge che la omette la cancella: anche quello è un cambio.
      await assertFails(setDoc(bar, { venue_name: 'Il locale' }))
      // E il documento che la porta non si cancella.
      await assertFails(deleteDoc(bar))
    }
  })

  it('non la aggiunge chi crea il documento, né chi lo trova senza', async () => {
    await assertFails(setDoc(doc(CHI.banco(env), 'settings/bar'), { licenza: { piano: 'completo' } }))
    await prepara('settings/bar', { venue_name: 'Il locale' })
    await assertFails(updateDoc(doc(CHI.admin(env), 'settings/bar'), { licenza: { piano: 'completo' } }))
  })

  it('la sala, il cliente e chi non è autenticato non scrivono le impostazioni, come prima', async () => {
    await conBar()
    for (const db of [CHI.sala(env), CHI.cliente(env), CHI.anonimo(env)]) {
      await assertFails(updateDoc(doc(db, 'settings/bar'), { venue_name: 'Altro' }))
    }
  })

  it('tutto il resto il banco e il titolare lo scrivono come sempre', async () => {
    await conBar()
    for (const db of [CHI.banco(env), CHI.admin(env)]) {
      const bar = doc(db, 'settings/bar')
      // updateSettings: setDoc con merge, un campo alla volta.
      await assertSucceeds(setDoc(bar, { theme: 'notte', orario_chiusura: '03:00' }, { merge: true }))
      await assertSucceeds(updateDoc(bar, { staff_count: 4, admin_associati: { a: ['b'] } }))
    }
    // Un documento nuovo senza licenza nasce, e gli altri documenti di
    // settings/ si scrivono e si cancellano come prima.
    await assertSucceeds(setDoc(doc(CHI.banco(env), 'settings/printer'), { ip: '192.168.1.50' }))
    await assertSucceeds(deleteDoc(doc(CHI.admin(env), 'settings/printer')))
    await env.clearFirestore()
    await conLicenza(COMPLETA())
    await assertSucceeds(setDoc(doc(CHI.admin(env), 'settings/bar'), { venue_name: 'Nuovo' }))
  })

  // IL RIPRISTINO DAL GESTIONALE (lib/backup.js) scrive i documenti interi.
  // Il backup porta la licenza di quando è stato fatto, e passata da un
  // file JSON la scadenza non è più un Timestamp: rimessa così, è un
  // cambio, e il lotto si ferma. Con la licenza di adesso passa, e le
  // impostazioni tornano quelle del file.
  it('il ripristino con la licenza di adesso passa; con quella del file no', async () => {
    await conBar({ theme: 'giorno' })
    const db = CHI.admin(env)
    const dalFile = JSON.parse(
      JSON.stringify({ venue_name: 'Ieri', theme: 'notte', licenza: { ...LICENZA_REGIA(), piano: 'completo' } })
    )
    const tale = writeBatch(db)
    tale.set(doc(db, 'settings/bar'), dalFile)
    await assertFails(tale.commit())

    const attuali = (await getDoc(doc(db, 'settings/bar'))).data()
    const ripristino = writeBatch(db)
    ripristino.set(doc(db, 'settings/bar'), conLicenzaAttuale(dalFile, attuali))
    await assertSucceeds(ripristino.commit())
    const dopo = (await getDoc(doc(db, 'settings/bar'))).data()
    expect(dopo.theme).toBe('notte')
    expect(dopo.licenza.piano).toBe('base')
  })
})
