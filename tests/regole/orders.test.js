// ── GLI ORDINI: CHI PUÒ APRIRNE UNO, E COSA CI PUÒ SCRIVERE (BUG-093) ────
//
// Gli ordini sono l'unica collezione che un CLIENTE NON AUTENTICATO deve
// poter creare e leggere: è il modello «id ordine come lasciapassare», ed è
// una scelta, non una dimenticanza. Chi ha in mano il link del suo conto lo
// vede; nessun altro lo indovina, perché l'id è casuale a 20 caratteri.
//
// Ma «creare» non vuol dire «scrivere qualunque cosa». Prima bastava
// l'apiKey del bundle per far comparire in coda un conto firmato con
// l'email dell'admin, o già pagato, o già fatturato. Qui si prova che
// quella porta è chiusa e che il conto del cliente vero passa ancora.
//
// C'È ANCHE UN PEZZO ANCORA APERTO, ed è in fondo al file, scritto come
// prova: la lettura in blocco di TUTTA la collezione. Chiuderla richiede un
// cambiamento nel client e non si fa di nascosto — sta in BUG-093.

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore'
import { avviaAmbiente, CHI } from './ambiente.js'

let env

// Il conto come esce davvero da src/lib/api.js (creaOrdine) quando a
// ordinare è un cliente dal menù. Se questa forma smette di essere
// accettata, al bar il telefono del cliente non ordina più.
function contoDalMenu(extra = {}) {
  return {
    daily_number: 12,
    serial: 340,
    order_date: '2026-08-26',
    status: 'aperto',
    comande: [{ id: 'c1', seq: 1, items: [], status: 'ricevuto' }],
    comande_statuses: ['ricevuto'],
    total: 18,
    coperto_persons: 0,
    coperto_amount: 0,
    service_charge_amount: 0,
    tip_amount: 0,
    service_mode: 'tavolo',
    push_token: 'token-del-telefono',
    placed_by: null,
    customer_name: 'Giulia',
    customer_uid: null,
    payment_method: null,
    payment_status: 'non_richiesto',
    payment_required: false,
    group_id: null,
    items: [{ drink_id: 'd1', name: 'Negroni', unit_price: 9, qty: 2 }],
    ...extra,
  }
}

beforeAll(async () => {
  env = await avviaAmbiente('orders')
})
afterAll(async () => {
  await env?.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'orders/conto-in-coda'), contoDalMenu())
    await setDoc(
      doc(db, 'orders/conto-chiuso'),
      contoDalMenu({
        status: 'consegnato',
        comande_statuses: ['consegnato'],
        customer_name: 'Marco Esposito',
        placed_by: { email: 'admin@latanadelconiglio.it', role: 'admin' },
      })
    )
  })
})

describe('L’USO LEGITTIMO PASSA: il cliente ordina e segue il suo conto', () => {
  it('il cliente non autenticato apre un conto dal menù', async () => {
    await assertSucceeds(setDoc(doc(CHI.anonimo(env), 'orders/nuovo-1'), contoDalMenu()))
  })

  it('e lo può aprire anche scegliendo di pagare online', async () => {
    await assertSucceeds(
      setDoc(
        doc(CHI.anonimo(env), 'orders/nuovo-2'),
        contoDalMenu({ payment_method: 'online', payment_status: 'in_attesa' })
      )
    )
  })

  // Il lasciapassare è l'id: chi ha il link del proprio conto lo legge.
  it('con l’id in mano, chiunque legge quel conto', async () => {
    await assertSucceeds(getDoc(doc(CHI.anonimo(env), 'orders/conto-in-coda')))
  })

  // Il cliente REGISTRATO intesta il conto al suo account: è così che «i
  // miei ordini» lo ritrova da un altro telefono.
  it('il cliente registrato intesta il conto a sé stesso, e lo ritrova', async () => {
    const db = CHI.cliente(env, 'cliente-1')
    await assertSucceeds(
      setDoc(doc(db, 'orders/nuovo-3'), contoDalMenu({ customer_uid: 'cliente-1' }))
    )
    await assertSucceeds(
      getDocs(query(collection(db, 'orders'), where('customer_uid', '==', 'cliente-1')))
    )
  })

  // La sala prende l'ordine al tavolo col telefono: è personale, firma col
  // suo nome, e la comanda nasce già in preparazione.
  it('la sala apre un conto firmandolo col proprio nome', async () => {
    await assertSucceeds(
      setDoc(
        doc(CHI.sala(env), 'orders/nuovo-4'),
        contoDalMenu({
          placed_by: { email: 'sala@latanadelconiglio.it', role: 'staff', device: 'tel-1' },
          comande_statuses: ['in_preparazione'],
        })
      )
    )
  })

  // Il banco batte i conti e non ha vincoli di forma: dal POS nasce anche
  // un conto già incassato e scontato.
  it('il banco apre un conto già incassato, come fa il POS', async () => {
    await assertSucceeds(
      setDoc(
        doc(CHI.banco(env), 'orders/nuovo-5'),
        contoDalMenu({
          placed_by: { email: 'banco@latanadelconiglio.it', role: 'bartender' },
          payment_status: 'pagato',
          paid_at: '2026-08-26T21:00:00.000Z',
          discount_amount: 2,
        })
      )
    )
  })

  // Il tabellone del menù («stiamo servendo») e la stima dei tempi: due
  // liste che il cliente non autenticato deve poter chiedere.
  it('il cliente vede la coda e il tabellone dei pronti', async () => {
    const db = CHI.anonimo(env)
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'orders'),
          where('comande_statuses', 'array-contains-any', ['ricevuto', 'in_preparazione'])
        )
      )
    )
    await assertSucceeds(
      getDocs(query(collection(db, 'orders'), where('comande_statuses', 'array-contains', 'pronto')))
    )
  })

  it('il banco legge tutto, che è il suo mestiere', async () => {
    await assertSucceeds(getDocs(collection(CHI.banco(env), 'orders')))
  })
})

describe('L’ABUSO È BLOCCATO: un conto non nasce firmato o già successo', () => {
  // Il peggiore: un conto che compare in coda intestato all'admin. La
  // legenda della coda, la stampa e lo storico direbbero tutti «l'ha
  // battuto lui», e non è vero.
  it('chi non è del personale non firma col nome del personale', async () => {
    await assertFails(
      setDoc(
        doc(CHI.anonimo(env), 'orders/falso-1'),
        contoDalMenu({ placed_by: { email: 'admin@latanadelconiglio.it', role: 'admin' } })
      )
    )
    // Nemmeno un cliente registrato: l'account non è un ruolo.
    await assertFails(
      setDoc(
        doc(CHI.cliente(env), 'orders/falso-2'),
        contoDalMenu({ placed_by: { email: 'chiunque@example.com', role: 'staff' } })
      )
    )
  })

  it('un conto non nasce già pagato', async () => {
    const db = CHI.anonimo(env)
    await assertFails(setDoc(doc(db, 'orders/falso-3'), contoDalMenu({ payment_status: 'pagato' })))
    await assertFails(
      setDoc(doc(db, 'orders/falso-4'), contoDalMenu({ paid_at: '2026-08-26T21:00:00.000Z' }))
    )
  })

  it('né già scontato, fatturato o incassato', async () => {
    const db = CHI.anonimo(env)
    await assertFails(setDoc(doc(db, 'orders/falso-5'), contoDalMenu({ discount_amount: 50 })))
    await assertFails(setDoc(doc(db, 'orders/falso-6'), contoDalMenu({ invoice_number: '1/2026' })))
    await assertFails(setDoc(doc(db, 'orders/falso-7'), contoDalMenu({ payments: [{ amount: 18 }] })))
    await assertFails(setDoc(doc(db, 'orders/falso-8'), contoDalMenu({ closed_in_session: 'cassa-1' })))
  })

  it('né già venduto a SumUp', async () => {
    await assertFails(
      setDoc(doc(CHI.anonimo(env), 'orders/falso-9'), contoDalMenu({ sumup_sale_id: 'sale-1' }))
    )
  })

  // Intestare un conto all'account di un altro vuol dire infilarglielo nei
  // «miei ordini» e nel suo gruppo-cliente.
  it('non si intesta un conto all’account di un altro cliente', async () => {
    await assertFails(
      setDoc(doc(CHI.anonimo(env), 'orders/falso-10'), contoDalMenu({ customer_uid: 'cliente-1' }))
    )
    await assertFails(
      setDoc(
        doc(CHI.cliente(env, 'cliente-1'), 'orders/falso-11'),
        contoDalMenu({ customer_uid: 'cliente-2' })
      )
    )
  })

  // Un conto che nasce già «consegnato» salta la coda: non lo prepara
  // nessuno e risulta servito.
  it('un conto non nasce già avanti di stato', async () => {
    await assertFails(
      setDoc(doc(CHI.anonimo(env), 'orders/falso-12'), contoDalMenu({ status: 'consegnato' }))
    )
  })

  it('né con un totale che non è un numero, o negativo', async () => {
    const db = CHI.anonimo(env)
    await assertFails(setDoc(doc(db, 'orders/falso-13'), contoDalMenu({ total: 'gratis' })))
    await assertFails(setDoc(doc(db, 'orders/falso-14'), contoDalMenu({ total: -100 })))
  })

  // Nel dubbio: quello che c'era già continua a valere.
  it('e il conto del banco non si tocca da fuori', async () => {
    await assertFails(
      setDoc(
        doc(CHI.anonimo(env), 'orders/conto-chiuso'),
        { payment_status: 'pagato' },
        { merge: true }
      )
    )
  })
})

describe('QUELLO CHE RESTA APERTO, e sta scritto perché si veda (BUG-093)', () => {
  // I documenti degli ordini contengono dati personali — nome del cliente,
  // note, token push, email di chi li ha battuti — e sono a lettura
  // pubblica per disegno (il lasciapassare è l'id).
  //
  // Chiudere la lettura IN BLOCCO si può, ed è provato che funziona: un
  // `allow list` che lasci passare solo le liste del banco, le due del
  // tabellone e quella del cliente sui propri ordini blocca il travaso
  // dell'archivio. Ma manda in errore «I miei ordini» del cliente NON
  // registrato, che chiede i suoi conti con una query su
  // `documentId() in [...]` — e quella query non c'è modo di riconoscerla
  // dentro una regola.
  //
  // Servirebbe una riga diversa nel client (chiedere i conti uno per id,
  // che il lasciapassare già permette): è un cambiamento nell'app e lo
  // decide chi tiene il locale, non chi scrive le regole. Finché non è
  // deciso, questa prova dice la verità su com'è adesso — e diventerà
  // `assertFails` il giorno in cui si chiude.
  it('oggi la collezione degli ordini si legge ancora tutta insieme', async () => {
    const snap = await assertSucceeds(getDocs(collection(CHI.anonimo(env), 'orders')))
    expect(snap.size).toBeGreaterThan(0)
    // Ed ecco cosa ne esce: il nome del cliente e l'email di chi l'ha battuto.
    const chiuso = snap.docs.find((d) => d.id === 'conto-chiuso').data()
    expect(chiuso.customer_name).toBe('Marco Esposito')
    expect(chiuso.placed_by.email).toBe('admin@latanadelconiglio.it')
  })
})
