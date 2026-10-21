// ── LE FUNCTIONS DELLA REGIA (REQ-FLOTTA-006) ─────────────────────────
//
// Due cose sole: quando nasce (o viene rilanciata) una richiesta di
// attivazione, lanciare il workflow GitHub `provisiona-istanza.yml`; e
// ricevere l'esito dal workflow. La logica sta in lib/provisioning.js.
//
// Segreti (firebase functions:secrets:set, progetto drink-regia):
//   GITHUB_DISPATCH_TOKEN         token fine-grained con actions:write sul repo
//   PROVISIONING_CALLBACK_SECRET  il bearer che il workflow usa per l'esito
// Configurazione non segreta (.env): GITHUB_REPO (owner/repo), GITHUB_REF.

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { dispatchPayload, daLanciare, esitoValido, documentoIstanza, bearerValido } = require('./lib/provisioning.js')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { FieldValue } = require('firebase-admin/firestore')
const { righeCheckout, metadatiDi, aggiornamentoDaEvento } = require('./lib/abbonamento.js')

initializeApp()
const db = getFirestore()
const OPTS = { region: 'europe-west1' }
const GITHUB_DISPATCH_TOKEN = defineSecret('GITHUB_DISPATCH_TOKEN')
const PROVISIONING_CALLBACK_SECRET = defineSecret('PROVISIONING_CALLBACK_SECRET')
// Stripe (REQ-FLOTTA-007): chiave segreta e segreto del webhook, prima
// quelle di PROVA (sk_test_…, whsec_…), poi quelle vere.
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY')
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET')
const REPO = process.env.GITHUB_REPO || 'redirect11/tana-drink'
const REF = process.env.GITHUB_REF || 'develop'
const WORKFLOW = 'provisiona-istanza.yml'

async function lancia(richiesta) {
  const corpo = dispatchPayload(richiesta, { ref: REF })
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN.value()}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(corpo),
  })
  const adesso = new Date().toISOString()
  if (res.status !== 204) {
    const testo = await res.text().catch(() => '')
    await db.doc(`richieste/${richiesta.slug}`).set({ stato: 'errore', errore: `GitHub ${res.status}: ${testo.slice(0, 200)}`, aggiornata_il: adesso }, { merge: true })
    await db.doc(`istanze/${richiesta.slug}`).set(
      documentoIstanza({ slug: richiesta.slug, stato: 'errore', errore: `Lancio fallito (GitHub ${res.status})` }, null),
      { merge: true }
    )
    return
  }
  await db.doc(`richieste/${richiesta.slug}`).set({ stato: 'in corso', lanciata_il: adesso }, { merge: true })
  await db.doc(`istanze/${richiesta.slug}`).set(
    { ...documentoIstanza({ slug: richiesta.slug, stato: 'in corso' }, null), uid: richiesta.uid || null },
    { merge: true }
  )
}

exports.avviaProvisioning = onDocumentCreated(
  { ...OPTS, document: 'richieste/{slug}', secrets: [GITHUB_DISPATCH_TOKEN] },
  async (event) => {
    const dopo = event.data?.data()
    if (daLanciare(null, dopo)) await lancia({ ...dopo, slug: event.params.slug })
  }
)

exports.rilanciaProvisioning = onDocumentUpdated(
  { ...OPTS, document: 'richieste/{slug}', secrets: [GITHUB_DISPATCH_TOKEN] },
  async (event) => {
    const prima = event.data?.before?.data()
    const dopo = event.data?.after?.data()
    if (daLanciare(prima, dopo)) await lancia({ ...dopo, slug: event.params.slug })
  }
)

// L'esito dal workflow: POST con bearer, corpo { slug, stato, url, progetto, versione, errore }.
exports.esitoProvisioning = onRequest({ ...OPTS, secrets: [PROVISIONING_CALLBACK_SECRET], cors: false }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('')
  if (!bearerValido(req.get('authorization'), PROVISIONING_CALLBACK_SECRET.value())) return res.status(401).send('')
  const esito = esitoValido(req.body)
  if (!esito) return res.status(400).json({ errore: 'esito non valido' })
  const ref = db.doc(`istanze/${esito.slug}`)
  const prima = (await ref.get()).data() || null
  await ref.set(documentoIstanza(esito, prima), { merge: true })
  await db.doc(`richieste/${esito.slug}`).set({ stato: esito.stato, aggiornata_il: new Date().toISOString() }, { merge: true })
  res.status(200).json({ ok: true })
})

// ── L'ABBONAMENTO (REQ-FLOTTA-007) ────────────────────────────────────

const stripeClient = () => {
  const chiave = STRIPE_SECRET_KEY.value()
  if (!chiave) return null
  // Caricato qui e non in cima: senza chiave la regia lavora lo stesso.
  const Stripe = require('stripe')
  return new Stripe(chiave)
}

// Il titolare sceglie il piano: nasce la sessione di Checkout (abbonamento
// mensile) e torna l'url. I metadati portano uid e scelta, che il webhook
// userà per aggiornare il cliente.
exports.creaCheckout = onCall({ ...OPTS, secrets: [STRIPE_SECRET_KEY] }, async (req) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Serve l’accesso.')
  const stripe = stripeClient()
  if (!stripe) throw new HttpsError('failed-precondition', 'Il pagamento online non è ancora attivo: scrivici all’email del prodotto.')
  const uid = req.auth.uid
  const cliente = (await db.doc(`clienti/${uid}`).get()).data()
  if (!cliente) throw new HttpsError('not-found', 'Nessun locale registrato per questo account.')
  const scelta = { piano: req.data?.piano, moduli: req.data?.moduli, terminali: req.data?.terminali }
  const ritorno = String(req.data?.ritorno || '').replace(/\/$/, '')
  if (!/^https?:\/\//.test(ritorno)) throw new HttpsError('invalid-argument', 'Indirizzo di ritorno non valido.')
  const sessione = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: righeCheckout(scelta),
    customer_email: cliente.abbonamento?.stripe_customer ? undefined : cliente.email,
    customer: cliente.abbonamento?.stripe_customer || undefined,
    client_reference_id: uid,
    metadata: metadatiDi(uid, scelta),
    subscription_data: { metadata: metadatiDi(uid, scelta) },
    success_url: `${ritorno}/dashboard?pagamento=ok`,
    cancel_url: `${ritorno}/dashboard?pagamento=annullato`,
    locale: 'it',
  })
  return { url: sessione.url }
})

// Il webhook di Stripe: la firma si verifica sul corpo grezzo, e lo stato
// dell'abbonamento segue gli eventi (aggiornamentoDaEvento). Una
// subscription si ritrova per id nel cliente che l'ha aperta.
exports.stripeWebhook = onRequest({ ...OPTS, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], cors: false }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('')
  const stripe = stripeClient()
  if (!stripe) return res.status(503).send('')
  let evento
  try {
    evento = stripe.webhooks.constructEvent(req.rawBody, req.get('stripe-signature'), STRIPE_WEBHOOK_SECRET.value())
  } catch (e) {
    console.error('[stripe] firma non valida:', e?.message)
    return res.status(400).send('')
  }
  const agg = aggiornamentoDaEvento(evento.type, evento.data?.object)
  if (!agg) return res.status(200).json({ ok: true, ignorato: evento.type })
  let uid = agg.uid
  if (!uid && agg.stripe_subscription) {
    const q = await db.collection('clienti').where('abbonamento.stripe_subscription', '==', agg.stripe_subscription).limit(1).get()
    uid = q.empty ? null : q.docs[0].id
  }
  if (!uid) return res.status(200).json({ ok: true, ignorato: 'cliente non trovato' })
  const ref = db.doc(`clienti/${uid}`)
  if (agg.patch.abbonamento) await ref.set(agg.patch, { merge: true })
  else await ref.update({ ...agg.patch, 'abbonamento.visto_il': FieldValue.serverTimestamp() })
  res.status(200).json({ ok: true })
})
