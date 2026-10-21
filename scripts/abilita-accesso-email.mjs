// =====================================================================
//  ACCENDE L'ACCESSO CON EMAIL E PASSWORD (Firebase Auth) su un progetto.
//
//    node scripts/abilita-accesso-email.mjs --project drink-regia
//
//  Senza gcloud e senza console (docs/flotta.md): usa il token del
//  Firebase CLI e l'API di amministrazione di Identity Platform. Serve
//  l'API identitytoolkit abilitata (scripts/abilita-api.mjs).
// =====================================================================
import { accessToken, arg } from './lib-firestore.js'

const PROGETTO = arg('project')
if (!PROGETTO) {
  console.error('Uso: node scripts/abilita-accesso-email.mjs --project <id>')
  process.exit(1)
}
const token = await accessToken()
const res = await fetch(
  `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROGETTO}/config?updateMask=signIn.email`,
  {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } }),
  }
)
const json = await res.json().catch(() => ({}))
if (json.error) {
  console.error(`✖ ${json.error.status || res.status}: ${json.error.message}`)
  process.exit(1)
}
console.log(`[auth] ✓ ${PROGETTO}: accesso con email e password acceso`)
