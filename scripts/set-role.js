// =====================================================================
//  Assegna un ruolo a un utente staff (custom claim "role" su Firebase
//  Auth). Ruoli: bartender (default per chi non ha claim) | staff.
//
//    node scripts/set-role.js --email cameriera@bar.it --role staff
//    node scripts/set-role.js --email x@y.it --role staff --emulator
//
//  Produzione: usa la sessione del Firebase CLI (firebase login).
//  NB: l'utente deve già esistere (Console → Authentication → Add user).
//  Il nuovo ruolo è attivo al prossimo login (o refresh del token).
// =====================================================================
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
const getArg = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : null
}
const EMAIL = getArg('email')
const ROLE = getArg('role')
const EMULATOR = args.includes('--emulator')
const PROJECT = getArg('project') || (EMULATOR ? 'demo-tana-drink' : 'tana-drink')

const RUOLI = ['admin', 'bartender', 'staff', 'cliente']
const ELENCO = args.includes('--elenco')

if (!ELENCO && (!EMAIL || !RUOLI.includes(ROLE))) {
  console.error('Uso: node scripts/set-role.js --email <email> --role admin|bartender|staff|cliente [--emulator]')
  console.error('     node scripts/set-role.js --elenco [--project tana-drink-test]')
  process.exit(1)
}

let accessToken = 'owner'
if (!EMULATOR) {
  const cfg = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'))
  const tok = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: cfg.tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })).json()
  if (!tok.access_token) {
    console.error('Autenticazione fallita: esegui "npx firebase-tools login".')
    process.exit(1)
  }
  accessToken = tok.access_token
}

const HOST = EMULATOR
  ? 'http://localhost:9099/identitytoolkit.googleapis.com'
  : 'https://identitytoolkit.googleapis.com'
const auth = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

// --elenco: chi ha un ruolo, in questo progetto. Le password non sono
// leggibili (Firebase tiene solo l'impronta), i ruoli sì.
if (ELENCO) {
  const res = await (await fetch(`${HOST}/v1/projects/${PROJECT}/accounts:query`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ limit: 1000 }),
  })).json()
  if (res.error) {
    console.error('Errore:', res.error.message)
    process.exit(1)
  }
  const conRuolo = (res.userInfo || [])
    .map((u) => {
      let ruolo = null
      try {
        ruolo = JSON.parse(u.customAttributes || '{}').role ?? null
      } catch {
        /* attributi illeggibili: lo trattiamo come cliente */
      }
      return { email: u.email || '(senza email)', nome: u.displayName || '—', ruolo, sospeso: !!u.disabled }
    })
    .filter((u) => u.ruolo)
  console.log(`[ruoli] ${PROJECT}: ${res.userInfo?.length ?? 0} utenze, ${conRuolo.length} con un ruolo`)
  for (const u of conRuolo.sort((a, b) => a.ruolo.localeCompare(b.ruolo))) {
    console.log(`  ${u.ruolo.padEnd(10)} ${u.email.padEnd(34)} ${u.nome}${u.sospeso ? '  [sospeso]' : ''}`)
  }
  if (!conRuolo.some((u) => u.ruolo === 'admin')) {
    console.log('')
    console.log('  ⚠️  Nessun admin: nominane uno con --email <email> --role admin')
  }
  process.exit(0)
}

// 1. Trova l'utente per email.
const lookup = await (await fetch(`${HOST}/v1/projects/${PROJECT}/accounts:lookup`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ email: [EMAIL] }),
})).json()
const user = lookup.users?.[0]
if (!user) {
  console.error(`Utente ${EMAIL} non trovato: crealo prima (Console → Authentication).`)
  process.exit(1)
}

// 2. Imposta il claim "role".
const res = await (await fetch(`${HOST}/v1/projects/${PROJECT}/accounts:update`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    localId: user.localId,
    // "cliente" non è un ruolo: è l'assenza di ruolo.
    customAttributes: JSON.stringify(ROLE === 'cliente' ? {} : { role: ROLE }),
  }),
})).json()
if (res.error) {
  console.error('Errore:', res.error.message)
  process.exit(1)
}
console.log(`✓ ${EMAIL} → ruolo "${ROLE}" (${EMULATOR ? 'emulatore' : PROJECT}). Attivo al prossimo login.`)
