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

if (!EMAIL || !['bartender', 'staff'].includes(ROLE)) {
  console.error('Uso: node scripts/set-role.js --email <email> --role bartender|staff [--emulator]')
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
    customAttributes: JSON.stringify({ role: ROLE }),
  }),
})).json()
if (res.error) {
  console.error('Errore:', res.error.message)
  process.exit(1)
}
console.log(`✓ ${EMAIL} → ruolo "${ROLE}" (${EMULATOR ? 'emulatore' : PROJECT}). Attivo al prossimo login.`)
