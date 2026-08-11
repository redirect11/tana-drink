// =====================================================================
//  PROVA I PERMESSI COME UN UTENTE VERO.
//
//    node scripts/diagnostica-permessi.js --project tana-drink --prova
//    node scripts/diagnostica-permessi.js --project tana-drink \
//        --email tizio@bar.it --password ***
//
//  Gli altri script parlano a Firestore da amministratore: passano sempre,
//  e quindi non dimostrano niente su cosa possa fare chi si collega
//  dall'app. Questo invece fa il login come utente (Identity Toolkit, la
//  stessa porta che usa il browser), si prende il suo token con dentro il
//  ruolo, e ripete LE STESSE letture che fa la schermata: se qualcosa è
//  vietato, si vede qui e si vede a quale collezione.
//
//  Con --prova crea un utente usa-e-getta col ruolo indicato (--ruolo,
//  default bartender), lo interroga e LO CANCELLA. Non tocca nessuno.
//
//  NB: questa via NON passa da App Check (è REST con la chiave web, non
//  l'SDK del browser). Se qui va tutto e nel browser no, il problema non
//  sono i permessi: è App Check, o la rete.
// =====================================================================
import { accessToken, arg, flag } from './lib-firestore.js'

const PROGETTO = arg('project', 'tana-drink-test')
const PROVA = flag('prova')
const RUOLO = arg('ruolo', 'bartender')
let EMAIL = arg('email')
let PASSWORD = arg('password')

// Chiavi web pubbliche (stanno già nel bundle dell'app: non sono segreti).
const API_KEY = {
  'tana-drink': 'AIzaSyDFqH3ZZ8dVVWAm73rrMDgKpzI6cP3xDmk',
  'tana-drink-test': arg('apikey'),
}[PROGETTO]

const admin = { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' }
const IT = 'https://identitytoolkit.googleapis.com/v1'

async function crea() {
  EMAIL = `diagnostica-${Date.now()}@tana.local`
  PASSWORD = `p${Math.abs(Date.now() % 1e9)}!ok`
  const u = await (
    await fetch(`${IT}/projects/${PROGETTO}/accounts`, {
      method: 'POST',
      headers: admin,
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, emailVerified: true }),
    })
  ).json()
  if (u.error) throw new Error(`creazione: ${u.error.message}`)
  const claim = RUOLO === 'cliente' ? {} : { role: RUOLO }
  const upd = await (
    await fetch(`${IT}/projects/${PROGETTO}/accounts:update`, {
      method: 'POST',
      headers: admin,
      body: JSON.stringify({ localId: u.localId, customAttributes: JSON.stringify(claim) }),
    })
  ).json()
  if (upd.error) throw new Error(`ruolo: ${upd.error.message}`)
  console.log(`[diagnostica] utente usa-e-getta ${EMAIL} · ruolo ${RUOLO}`)
  return u.localId
}

async function elimina(uid) {
  await fetch(`${IT}/projects/${PROGETTO}/accounts:delete`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({ localId: uid }),
  })
  console.log(`[diagnostica] utente usa-e-getta eliminato`)
}

let uidTemporaneo = null
if (PROVA) uidTemporaneo = await crea()
if (!EMAIL || !PASSWORD || !API_KEY) {
  console.error('Servono --email e --password (o --prova), e la chiave web del progetto (--apikey).')
  process.exit(1)
}

// 1. Login come farebbe il browser.
const login = await (
  await fetch(`${IT}/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  })
).json()
if (login.error) {
  console.error(`[diagnostica] login fallito: ${login.error.message}`)
  if (uidTemporaneo) await elimina(uidTemporaneo)
  process.exit(1)
}
const claims = JSON.parse(Buffer.from(login.idToken.split('.')[1], 'base64').toString())
console.log(`[diagnostica] ${PROGETTO} · ${EMAIL}`)
console.log(`  ruolo nel token: ${claims.role ?? '— nessuno (cliente) —'}`)

const utente = { Authorization: `Bearer ${login.idToken}`, 'Content-Type': 'application/json' }
const BASE = `https://firestore.googleapis.com/v1/projects/${PROGETTO}/databases/(default)/documents`

// 2. Le letture della coda ordini, una per una.
const prove = [
  ['settings/bar (lettura pubblica)', () => fetch(`${BASE}/settings/bar`, { headers: utente })],
  ['drinks (menù)', () => fetch(`${BASE}/drinks?pageSize=1`, { headers: utente })],
  [
    'orders con status "in" (coda)',
    () =>
      fetch(`${BASE}:runQuery`, {
        method: 'POST',
        headers: utente,
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'orders' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'status' },
                op: 'IN',
                value: { arrayValue: { values: [{ stringValue: 'aperto' }, { stringValue: 'ricevuto' }] } },
              },
            },
            limit: 3,
          },
        }),
      }),
  ],
  ['cash_sessions (cassa)', () => fetch(`${BASE}/cash_sessions?pageSize=1`, { headers: utente })],
  ['staff_calls (cerca-persone)', () => fetch(`${BASE}/staff_calls?pageSize=1`, { headers: utente })],
  ['groups (gruppi)', () => fetch(`${BASE}/groups?pageSize=1`, { headers: utente })],
  ['inventory_items (inventario)', () => fetch(`${BASE}/inventory_items?pageSize=1`, { headers: utente })],
  ['pos_prefs (preferenze POS)', () => fetch(`${BASE}/pos_prefs?pageSize=1`, { headers: utente })],
  ['staff_hours (ore)', () => fetch(`${BASE}/staff_hours?pageSize=1`, { headers: utente })],
  ['supplier_invoices (fatture)', () => fetch(`${BASE}/supplier_invoices?pageSize=1`, { headers: utente })],
]

let vietate = 0
for (const [nome, chiama] of prove) {
  const res = await chiama()
  const body = await res.json().catch(() => ({}))
  const err = Array.isArray(body) ? body.find((x) => x.error)?.error : body.error
  if (err) {
    vietate++
    console.log(`  ✖ ${nome.padEnd(34)} ${err.status}: ${err.message}`)
  } else {
    console.log(`  ✔ ${nome}`)
  }
}

console.log(
  vietate
    ? `\n[diagnostica] ${vietate} letture vietate: il problema È nei permessi.`
    : `\n[diagnostica] nessuna lettura vietata con questo ruolo: i permessi non c'entrano.`
)

if (uidTemporaneo) await elimina(uidTemporaneo)
