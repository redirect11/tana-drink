'use strict'

// Wiring delle Cloud Functions di Tana Drink: registrazione degli handler,
// lettura dei parametri, `fetch` reale, accesso a Firestore. La logica sta
// nei moduli di lib/, puri e testabili senza emulatori.
//
// I pagamenti SumUp (lettore Solo al banco e checkout online) vivono in
// lib/payment-core.js e lib/payment-service.js; la chiave non finisce mai
// nel repo:
//   firebase functions:secrets:set SUMUP_API_KEY

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentUpdated, onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore')
const disponibilita = require('./lib/disponibilita')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')
const { getAuth } = require('firebase-admin/auth')

const { numeroDaRiassegnare } = require('./lib/numerazione')
const {
  decideOrderPush,
  decideStaffCallPush,
  destinatariChiamata,
  decideStaffServePush,
  decideNewOrderStaffPush,
  destinatariPush,
  terminaliDi,
} = require('./lib/push-core')
const { staffAdmin } = require('./lib/staff-service')
const { richiestaAI: richiestaAIsvc } = require('./lib/ai-service')
const {
  createCheckout,
  verifyCheckoutStatus,
  handleOnlineWebhook,
  pairReader,
  unpairReader,
  readerCheckout: readerCheckoutSvc,
  readerTerminate: readerTerminateSvc,
  handleReaderWebhook,
  createGroupCheckout,
  verifyGroupPayment,
  groupReaderCheckout: groupReaderCheckoutSvc,
} = require('./lib/payment-service')
const {
  decideAutoAdvance,
  parseCheckoutWebhookBody,
  parseReaderWebhookBody,
} = require('./lib/payment-core')

initializeApp()
const db = getFirestore()

const OPTS = { region: 'europe-west1' }

// ── Gestione utenze staff (solo bartender) ────────────────────────────────────
// Crea/elenca/modifica/elimina gli account dello staff con il ruolo
// (custom claim). La logica vive in lib/staff-service.js (testata).
exports.staffAdmin = onCall(OPTS, async (request) => {
  try {
    return await staffAdmin(getAuth(), request.auth, request.data)
  } catch (e) {
    if (e?.code && e?.message) throw new HttpsError(e.code, e.message)
    throw new HttpsError('internal', e?.message || 'Errore interno.')
  }
})

// ── LA VOCE NON DISPONIBILE NEL MENÙ DEI CLIENTI (REQ-MENU-017) ───────────────
// Il segno `non_disponibile_cliente` sul prodotto della cassa: il cliente
// non legge il magazzino, e gli arriva solo un sì o un no (Daniele,
// 13/11/2026: al cliente non si dice mai cosa manca). Si scrive solo dove
// cambia, e si ricalcola solo quando serve: un prodotto di magazzino che
// attraversa la soglia, un prodotto della cassa che cambia ricetta o
// opzione, la soglia che cambia. La logica è in lib/disponibilita.js.
async function impostazioniDelBar() {
  const s = await db.doc('settings/bar').get()
  return s.exists ? s.data() : {}
}

// I prodotti di magazzino per id, letti a gruppi di cento (il tetto di
// getAll che si tiene qui).
async function leggiArticoli(ids) {
  const perId = new Map()
  for (let i = 0; i < ids.length; i += 100) {
    const lette = await db.getAll(...ids.slice(i, i + 100).map((id) => db.doc(`inventory_items/${id}`)))
    for (const s of lette) if (s.exists) perId.set(s.id, s.data())
  }
  return perId
}

// Scritture a lotti di quattrocento (il tetto di un batch è cinquecento).
async function scriviALotti(elenco, scrivi) {
  for (let i = 0; i < elenco.length; i += 400) {
    const lotto = db.batch()
    for (const x of elenco.slice(i, i + 400)) scrivi(lotto, x)
    await lotto.commit()
  }
}

async function ricalcolaDisponibilita(drinks, impostazioni) {
  if (!drinks.length) return
  const ids = [...new Set(drinks.flatMap((d) => (d.recipe_items || []).map((r) => r.inventory_item_id).filter(Boolean)))]
  const cambi = disponibilita.cambiDiDisponibilita(drinks, await leggiArticoli(ids), impostazioni)
  await scriviALotti(cambi, (lotto, c) => lotto.update(db.doc(`drinks/${c.id}`), { non_disponibile_cliente: c.valore }))
}

const drinksCheSeguono = async () =>
  (await db.collection('drinks').where('segue_giacenze', '==', true).get()).docs.map((d) => ({ id: d.id, ...d.data() }))

exports.disponibilitaDalMagazzino = onDocumentWritten({ ...OPTS, document: 'inventory_items/{itemId}' }, async (event) => {
  const prima = event.data?.before?.exists ? event.data.before.data() : null
  const dopo = event.data?.after?.exists ? event.data.after.data() : null
  if (!disponibilita.contaPerIlMenu(prima, dopo)) return
  const impostazioni = await impostazioniDelBar()
  const itemId = event.params.itemId
  // L'alternativa pubblica del cliente (REQ-MENU-042), se serve.
  const alternativa = disponibilita.alternativaDopo(prima, dopo, impostazioni)
  if (alternativa?.cancella) await db.doc(`alternative_cliente/${itemId}`).delete()
  if (alternativa?.scrivi) await db.doc(`alternative_cliente/${itemId}`).set(alternativa.scrivi)
  // Non a ogni vendita: solo quando la soglia si attraversa.
  if (!disponibilita.haAttraversato(prima, dopo, impostazioni)) return
  await ricalcolaDisponibilita((await drinksCheSeguono()).filter((d) => disponibilita.usaIlProdotto(d, itemId)), impostazioni)
})

async function riallineaScelteDelProdotto(drinkId, ricetta) {
  const voci = await db.collection('carta_voci').where('drink_id', '==', drinkId).get()
  const conScelta = voci.docs.filter((v) => (v.data().etichette || []).some((e) => e?.scelta))
  if (!conScelta.length) return
  const ids = [...new Set(ricetta.map((r) => r?.inventory_item_id).filter(Boolean))]
  const articoli = await leggiArticoli(ids)
  const categoriaDi = new Map([...articoli].map(([id, a]) => [id, a.category_id ?? null]))
  const cambi = conScelta
    .map((v) => ({ ref: v.ref, etichette: disponibilita.scelteRiallineate(v.data().etichette, ricetta, categoriaDi) }))
    .filter((c) => c.etichette)
  await scriviALotti(cambi, (lotto, c) => lotto.update(c.ref, { etichette: c.etichette }))
}

exports.disponibilitaDalProdotto = onDocumentWritten({ ...OPTS, document: 'drinks/{drinkId}' }, async (event) => {
  if (!event.data?.after?.exists) return
  const prima = event.data.before?.exists ? event.data.before.data() : {}
  const dopo = event.data.after.data()
  // La ricetta è cambiata: le scelte del cliente sulle voci collegate
  // seguono (REQ-MENU-042, disponibilita.scelteRiallineate).
  if (JSON.stringify(prima?.recipe_items || []) !== JSON.stringify(dopo?.recipe_items || [])) {
    await riallineaScelteDelProdotto(event.params.drinkId, dopo.recipe_items || [])
  }
  // Solo se cambiano l'opzione o la ricetta: la scrittura del segno, fatta
  // qui, non deve rimettere in moto il calcolo.
  const pesa = (d) => JSON.stringify([d?.segue_giacenze === true, d?.recipe_items || []])
  if (pesa(prima) === pesa(dopo)) return
  await ricalcolaDisponibilita([{ id: event.params.drinkId, ...dopo }], await impostazioniDelBar())
})

exports.disponibilitaDalleImpostazioni = onDocumentUpdated({ ...OPTS, document: 'settings/bar' }, async (event) => {
  const prima = event.data?.before?.data() || {}
  const dopo = event.data?.after?.data() || {}
  if (disponibilita.sogliaDi(prima) === disponibilita.sogliaDi(dopo)) return
  await ricalcolaDisponibilita(await drinksCheSeguono(), dopo)
  // E le alternative del cliente, con la soglia nuova.
  // TUTTE, anche quelle che non cambiano: è anche la strada che rimette il
  // documento ai prodotti spuntati prima che la Function ci fosse.
  const scelte = await db.collection('inventory_items').where('scelta_cliente', '==', true).get()
  const soglia = disponibilita.sogliaDi(dopo)
  await scriviALotti(scelte.docs, (lotto, d) =>
    lotto.set(db.doc(`alternative_cliente/${d.id}`), { disponibile: !disponibilita.manca(d.data(), soglia) })
  )
})

// ── L'AI, attraverso la regia (REQ-AI-003) ───────────────────────────────────
// Il locale si fa riconoscere dalla regia col gettone d'identità di Google
// del suo account dedicato `ai-locale@<progetto>` (Daniele, 12/11/2026:
// «niente chiave»; contratto in drink-regia, docs/handover.md §7). Niente
// segreti: la Function gira con quell'account e chiede il gettone al server
// dei metadati di Google. La logica è in lib/ai-service.js.
//
// QUALE REGIA: `REGIA_PROGETTO` in functions/.env.<progetto>, che la regia
// scrive nei suoi locali (drink-regia, o drink-regia-test per i locali di
// prova). SENZA, L'AI È SPENTA e la Function gira con l'account di sempre:
// `serviceAccount` si chiede solo dove c'è REGIA_PROGETTO, perché nei
// progetti senza l'account `ai-locale` (oggi tana-drink, tana-drink-test e
// drinkpos-prova-e2e, che non nascono dal Terraform della regia) un account
// che non esiste fermerebbe il deploy di tutte le Functions.
// `'ai-locale@'`: firebase-functions lo completa col dominio del progetto.
const REGIA_PROGETTO = process.env.REGIA_PROGETTO || ''
// Quanto si aspetta la regia: per una fattura lunga ha fino a 300 secondi.
// Oltre, la regia finisce comunque e il costo si paga: meglio aspettarla.
const ATTESA_REGIA_MS = 290 * 1000

// Il gettone d'identità dell'account con cui gira la Function, per quel
// destinatario. Torna null se il server dei metadati non lo dà.
async function gettoneDiGoogle(destinatario) {
  const url =
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=' +
    encodeURIComponent(destinatario)
  const res = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(10 * 1000) })
  if (!res.ok) return null
  const gettone = (await res.text()).trim()
  return gettone || null
}

exports.richiestaAI = onCall(
  {
    ...OPTS,
    ...(REGIA_PROGETTO ? { serviceAccount: 'ai-locale@' } : {}),
    // Una fattura in PDF arriva a 20 MB e la regia ha fino a 300 secondi per
    // leggerla: tempo e memoria in più rispetto alle altre.
    timeoutSeconds: 310,
    memory: '512MiB',
  },
  async (request) => {
    try {
      return await richiestaAIsvc(
        {
          progettoRegia: () => REGIA_PROGETTO,
          gettone: gettoneDiGoogle,
          invia: async (url, opzioni) => {
            const res = await fetch(url, { ...opzioni, signal: AbortSignal.timeout(ATTESA_REGIA_MS) })
            const testo = await res.text()
            let corpo = null
            try {
              corpo = testo ? JSON.parse(testo) : null
            } catch {
              corpo = null
            }
            return { status: res.status, corpo }
          },
        },
        request.auth,
        request.data
      )
    } catch (e) {
      if (e?.code && e?.message) throw new HttpsError(e.code, e.message)
      throw new HttpsError('internal', e?.message || 'Errore interno.')
    }
  }
)

// ── Notifiche push al cliente (FCM) ───────────────────────────────────────────
// Quando un ordine passa a "pronto" (drink pronto) o ad "annullato" da parte
// del bartender con notifica richiesta, invia una push al dispositivo del
// cliente (token salvato sull'ordine alla creazione). La decisione su cosa
// inviare vive in lib/push-core.js (pura, testata).
exports.notifyOrderUpdate = onDocumentUpdated({ ...OPTS, document: 'orders/{orderId}' }, async (event) => {
  const before = event.data?.before?.data()
  const after = event.data?.after?.data()

  // 1) Push al cliente (drink pronto / ordine annullato).
  const msg = decideOrderPush(before, after)
  if (msg) {
    try {
      await getMessaging().send({
        token: after.push_token,
        notification: { title: msg.title, body: msg.body },
        data: { url: `/ordine/${event.params.orderId}` },
        webpush: {
          fcmOptions: { link: `/ordine/${event.params.orderId}` },
          notification: { icon: '/logo.png', badge: '/logo.png' },
        },
      })
      // SEGNARE CHE È PARTITO. Le comande annunciate si scrivono
      // sull'ordine: se qualcuno riporta indietro lo stato e lo rimette
      // «pronto», il cliente non riceve un secondo squillo per un drink che
      // ha già in mano — al secondo si smette di credere al primo.
      // Si segna DOPO l'invio riuscito: un avviso mai partito non deve
      // risultare dato. La scrittura fa ripartire questo stesso trigger,
      // che con la comanda ormai segnata non manda più niente.
      if (msg.comande?.length) {
        await event.data.after.ref
          .update({ pronto_avvisate: FieldValue.arrayUnion(...msg.comande) })
          .catch((e) => console.error('[push] pronto_avvisate:', e?.message || e))
      }
    } catch (e) {
      // Token scaduto/non valido: rimuovilo dall'ordine, niente retry.
      if (e?.code === 'messaging/registration-token-not-registered') {
        await event.data.after.ref.update({ push_token: null }).catch(() => {})
      } else {
        console.error('[push] invio fallito:', e?.message || e)
      }
    }
  }

  // 2) Push allo staff al bancone quando un ordine in attesa di pagamento
  //    obbligatorio viene saldato ed entra in coda (è "nuovo" per la cucina).
  const newOrderMsg = decideNewOrderStaffPush(before, after)
  if (newOrderMsg) {
    await pushToStaff({
      kind: 'new_order',
      orderId: event.params.orderId,
      msg: newOrderMsg,
      dispositivoOrigine: after?.placed_by?.device ?? null,
    })
  }

  // 3) Push allo staff quando un drink e' pronto: da portare al tavolo
  //    oppure da consegnare a chi viene a ritirarlo. A TUTTI I TERMINALI
  //    tranne quello che ha premuto «pronto», che sa gia'. Prima si
  //    smistava per ruolo — roles: ['staff'] — e non arrivava a nessuno
  //    (BUG-036).
  const serveMsg = decideStaffServePush(before, after)
  if (serveMsg) {
    await pushToStaff({
      kind: 'staff_serve',
      orderId: event.params.orderId,
      msg: serveMsg,
      dispositivoOrigine: after?.avanzamento_device ?? null,
    })
  }
})

// Invia una push data-only a TUTTI i dispositivi staff registrati
// (staff_tokens). La notifica vera (titolo/corpo/vibrazione) la costruisce il
// service worker dal campo `kind`, così arriva anche ad app in background o
// chiusa. Rimuove in automatico i token scaduti.
async function pushToStaff({ kind, orderId, msg, url = '/bar', dispositivoOrigine = null }) {
  const tokensSnap = await db.collection('staff_tokens').get()
  // Chi avvisare lo decide destinatariPush (push-core, pura e provata):
  // tutti i terminali registrati, tranne quello da cui è partita la cosa
  // che si sta annunciando — chi ha battuto l'ordine, o chi ha appena
  // premuto «pronto», sa già di averlo fatto.
  const ammessi = new Set(
    destinatariPush(
      tokensSnap.docs.map((d) => ({ token: d.get('token'), device: d.get('device') })),
      { dispositivoOrigine }
    ).map((t) => t.token)
  )
  const docs = tokensSnap.docs.filter((d) => ammessi.has(d.get('token')))
  // A VOCE ALTA CHI SI E' AVVISATO. BUG-036 era invisibile dai log: la
  // funzione usciva in silenzio con zero destinatari, identica a una che
  // non era mai stata chiamata, e per scoprirlo e' servito leggere
  // `staff_tokens` a mano. Una riga sola dice se il messaggio e' partito
  // e a quanti terminali.
  if (docs.length === 0) {
    console.log(`[push staff] ${kind}: nessun terminale da avvisare (${tokensSnap.size} registrati)`)
    return
  }

  const res = await getMessaging().sendEachForMulticast({
    tokens: docs.map((d) => d.get('token')),
    data: { kind, order_id: orderId, title: msg.title, body: msg.body, url },
    webpush: { headers: { Urgency: 'high', TTL: '600' } },
  })

  console.log(
    `[push staff] ${kind}: inviata a ${docs.length}/${tokensSnap.size} terminali ` +
      `(ok ${res.successCount}, ko ${res.failureCount})`
  )

  await Promise.all(
    res.responses.map((r, i) =>
      r.error?.code === 'messaging/registration-token-not-registered'
        ? docs[i].ref.delete().catch(() => {})
        : null
    )
  )
}

// ── Push nuovo ordine allo staff (FCM) ────────────────────────────────────────
// Quando arriva un ordine, avvisa tutti i dispositivi al bancone: è l'unico
// modo per ricevere l'avviso a schermo bloccato / app in background su iPad
// (lì il listener realtime della pagina è sospeso dal sistema). Gli ordini con
// pagamento obbligatorio non ancora saldato NON si notificano qui: lo farà
// notifyOrderUpdate quando risulteranno pagati.
exports.notifyNewOrder = onDocumentCreated({ ...OPTS, document: 'orders/{orderId}' }, async (event) => {
  const after = event.data?.data()
  const msg = decideNewOrderStaffPush(null, after)
  if (!msg) return
  await pushToStaff({
    kind: 'new_order',
    orderId: event.params.orderId,
    msg,
    dispositivoOrigine: after?.placed_by?.device ?? null,
  })
})

// ── DUE TERMINALI, LO STESSO NUMERO: LA DISPUTA LA CHIUDE IL SERVER ──────────
//
// Il numero del conto lo assegna il dispositivo, senza chiedere niente a
// nessuno: è l'unico modo perché battere un conto sia immediato e funzioni
// offline. Il prezzo è che il telefono della sala e il tablet del banco, che
// battono nello stesso istante, possono prendersi lo stesso #15.
//
// Qui, dove esiste un «prima» e un «dopo» veri, si decide: tiene il numero
// chi è arrivato prima, e chi arriva dopo prende il primo libero. Automatico:
// al banco non si ferma una serata per un numero.
//
// Il numero cambia SOLO a chi ha perso, e resta scritto da dove veniva
// (`daily_number_precedente`): la comanda può essere già uscita dalla
// stampante col numero vecchio, e chi la tiene in mano deve ritrovarlo.
exports.risolviNumeroDuplicato = onDocumentCreated(
  { ...OPTS, document: 'orders/{orderId}' },
  async (event) => {
    const nuovo = event.data?.data()
    if (!nuovo || !(Number(nuovo.daily_number) > 0)) return
    // I conti si contendono il numero dentro la stessa CASSA; senza cassa
    // aperta, dentro la stessa giornata commerciale.
    const campo = nuovo.cash_session_id ? 'cash_session_id' : 'order_date'
    const valore = nuovo.cash_session_id || nuovo.order_date
    if (!valore) return

    const snap = await db.collection('orders').where(campo, '==', valore).get()
    const fratelli = snap.docs.map((d) => ({
      id: d.id,
      created_at: d.get('created_at'),
      daily_number: d.get('daily_number'),
    }))
    const conto = {
      id: event.params.orderId,
      created_at: nuovo.created_at,
      daily_number: nuovo.daily_number,
    }
    const numero = numeroDaRiassegnare(conto, fratelli)
    if (numero == null) return

    await db.collection('orders').doc(conto.id).update({
      daily_number: numero,
      daily_number_precedente: nuovo.daily_number,
      numero_riassegnato_at: FieldValue.serverTimestamp(),
    })
    // Il contatore si allinea, così il prossimo conto non ripesca il numero
    // appena assegnato.
    const contatore = nuovo.cash_session_id ? `cash-${nuovo.cash_session_id}` : nuovo.order_date
    await db
      .collection('counters')
      .doc(contatore)
      .set({ last: FieldValue.increment(1) }, { merge: true })
  }
)

// ── Push cerca-persone allo staff (FCM) ───────────────────────────────────────
// Quando il bartender crea una chiamata, invia una push al dispositivo del
// membro dello staff chiamato (token in staff_tokens/{uid}, registrato
// quando lo staff apre il gestionale). Messaggio data-only: la notifica
// con vibrazione la costruisce il service worker, così arriva anche con
// l'app in background o chiusa.
exports.notifyStaffCall = onDocumentCreated({ ...OPTS, document: 'staff_calls/{callId}' }, async (event) => {
  const call = event.data?.data()
  const msg = decideStaffCallPush(call)
  if (!msg) return

  // TUTTI I TERMINALI DI QUELLA PERSONA, non uno solo. La riga del token è
  // del DISPOSITIVO (`staff_tokens/<device>`, col campo `uid` dentro): da
  // quando è così, cercarla all'indirizzo `staff_tokens/<uid>` non trovava
  // niente e la chiamata non partiva — il telefono di chi veniva cercato
  // non vibrava mai. E chi lavora ha spesso due terminali accesi: la
  // chiamata deve suonare su entrambi, perché non si sa quale ha in mano.
  // CHI VA CHIAMATO: una persona, o — se la chiamata la fa la sala al
  // bancone (REQ-STAFF-019) — chi è titolare, letto dai claim delle utenze.
  let utenti = []
  if (!call.to_uid && call.to_role === 'admin') {
    let pagina
    do {
      const r = await getAuth().listUsers(1000, pagina)
      utenti = utenti.concat(r.users)
      pagina = r.pageToken
    } while (pagina)
  }
  const destinatari = destinatariChiamata(call, utenti)
  if (destinatari.length === 0) return

  const tokensSnap = await db.collection('staff_tokens').get()
  const righe = tokensSnap.docs.map((d) => ({ id: d.id, uid: d.get('uid'), token: d.get('token') }))
  const suoi = new Set(destinatari.flatMap((uid) => terminaliDi(righe, uid)).map((r) => r.token))
  const docs = tokensSnap.docs.filter((d) => suoi.has(d.get('token')))
  if (docs.length === 0) return

  try {
    const res = await getMessaging().sendEachForMulticast({
      tokens: docs.map((d) => d.get('token')),
      data: {
        kind: 'staff_call',
        title: msg.title,
        body: msg.body,
        url: '/bar',
      },
      webpush: {
        // Consegna immediata: la chiamata ha senso solo nel momento.
        headers: { Urgency: 'high', TTL: '180' },
      },
    })
    // I terminali che non esistono più si tolgono dalla rubrica: se no
    // restano lì a far fallire ogni chiamata successiva.
    await Promise.all(
      res.responses.map((r, i) =>
        r.error?.code === 'messaging/registration-token-not-registered'
          ? docs[i].ref.delete().catch(() => {})
          : null
      )
    )
  } catch (e) {
    console.error('[push staff] invio fallito:', e?.message || e)
  }
})

// ── Pagamenti SumUp (checkout online + lettore) ───────────────────────────────
// La chiave API è un secret runtime (firebase functions:secrets:set
// SUMUP_API_KEY); il merchant code non è segreto e vive in functions/.env.
// Senza configurazione le funzioni rispondono { unavailable: true }.
const SUMUP_API_KEY = defineSecret('SUMUP_API_KEY')
const SUMUP_MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE || ''
const SUMUP_PAYMENTS_BASE = process.env.SUMUP_PAYMENTS_BASE || 'https://api.sumup.com'
// Affiliate key: obbligatoria per il checkout sul lettore (Cloud API).
// Non è un segreto (identifica l'app, non autentica): vive in .env.
const SUMUP_AFFILIATE_KEY = process.env.SUMUP_AFFILIATE_KEY || ''
const SUMUP_AFFILIATE_APP_ID = process.env.SUMUP_AFFILIATE_APP_ID || ''
// IL NOME DEL LOCALE PER LE DESCRIZIONI DEI PAGAMENTI (REQ-VENUE-005): da
// functions/.env.<progetto> (per la Tana: .env.tana-drink), non dal codice.
const VENUE_NAME = process.env.VENUE_NAME || 'Il locale'

function paymentDeps() {
  const apiKey = SUMUP_API_KEY.value() || ''
  return {
    db,
    isConfigured: () => Boolean(apiKey && SUMUP_MERCHANT_CODE),
    merchantCode: () => SUMUP_MERCHANT_CODE,
    now: () => new Date().toISOString(),
    venueName: () => VENUE_NAME,
    webhookUrl: () =>
      `https://${OPTS.region}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/paymentWebhook`,
    affiliate: () =>
      SUMUP_AFFILIATE_KEY
        ? { app_id: SUMUP_AFFILIATE_APP_ID, key: SUMUP_AFFILIATE_KEY }
        : null,
    paymentsFetch: async (path, options = {}) => {
      const res = await fetch(`${SUMUP_PAYMENTS_BASE}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      })
      const text = await res.text()
      if (!res.ok) {
        const e = new Error(`SumUp ${res.status} su ${path}: ${text}`)
        e.status = res.status
        throw e
      }
      return text ? JSON.parse(text) : null
    },
  }
}

function toHttpsError(e) {
  if (e?.code && e?.message && typeof e.code === 'string') {
    return new HttpsError(e.code, e.message)
  }
  return new HttpsError('internal', e?.message || 'Errore interno.')
}

// Checkout online: chiamabile anche da clienti anonimi (l'id ordine fa
// da capability token, come per la pagina ordine pubblica).
exports.createPaymentCheckout = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await createCheckout(paymentDeps(), request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.getPaymentStatus = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await verifyCheckoutStatus(paymentDeps(), request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

// Webhook esiti di pagamento (checkout online + return_url del lettore).
// Smista per forma del payload; l'esito viene SEMPRE ri-verificato via
// API SumUp, quindi un payload malformato è innocuo.
exports.paymentWebhook = onRequest({ ...OPTS, secrets: [SUMUP_API_KEY], cors: false }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('')
  try {
    const deps = paymentDeps()
    const reader = parseReaderWebhookBody(req.body)
    if (reader.clientTransactionId) {
      await handleReaderWebhook(deps, reader)
    } else {
      const online = parseCheckoutWebhookBody(req.body)
      await handleOnlineWebhook(deps, online)
    }
  } catch (e) {
    console.error('[payments] webhook:', e?.message || e)
  }
  // Sempre 200: gli esiti veri si leggono dall'API, niente retry storm.
  res.status(200).json({ ok: true })
})

// Cintura server: ordine ritirato + pagato (in qualunque ordine) → chiuso.
exports.autoAdvancePaid = onDocumentUpdated({ ...OPTS, document: 'orders/{orderId}' }, async (event) => {
  const before = event.data?.before?.data()
  const after = event.data?.after?.data()
  const advance = decideAutoAdvance(before, after)
  if (!advance) return
  const nowIso = new Date().toISOString()
  await event.data.after.ref
    .update({ status: advance, [`status_times.${advance}`]: nowIso })
    .catch((e) => console.error('[payments] auto-advance:', e?.message || e))
})

// ── Lettore SumUp Solo (Cloud API): pairing e incasso dalla coda ──────────────
exports.pairSumUpReader = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await pairReader(paymentDeps(), request.auth, request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.unpairSumUpReader = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await unpairReader(paymentDeps(), request.auth)
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.readerCheckout = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await readerCheckoutSvc(paymentDeps(), request.auth, request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.readerTerminate = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await readerTerminateSvc(paymentDeps(), request.auth, request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

// ── Pagamento di un GRUPPO via SumUp (online + lettore) ───────────────────────
exports.createGroupCheckout = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await createGroupCheckout(paymentDeps(), request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.getGroupPaymentStatus = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await verifyGroupPayment(paymentDeps(), request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})

exports.groupReaderCheckout = onCall({ ...OPTS, secrets: [SUMUP_API_KEY] }, async (request) => {
  try {
    return await groupReaderCheckoutSvc(paymentDeps(), request.auth, request.data || {})
  } catch (e) {
    throw toHttpsError(e)
  }
})
