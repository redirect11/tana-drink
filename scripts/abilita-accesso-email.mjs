// =====================================================================
//  ACCENDE L'ACCESSO CON EMAIL E PASSWORD (Firebase Auth) su un progetto.
//
//    node scripts/abilita-accesso-email.mjs --project drink-regia
//
//  Senza gcloud e senza console (docs/flotta.md): usa il token del
//  Firebase CLI e l'API di amministrazione di Identity Platform. Serve
//  l'API identitytoolkit abilitata (scripts/abilita-api.mjs).
//
//  Un progetto nuovo risponde CONFIGURATION_NOT_FOUND finché Auth non è
//  inizializzata: è il clic «Inizia» della console, che qui si fa con
//  `identityPlatform:initializeAuth` (l'utente, 22/10/2026: «questo deve
//  essere già pronto dopo il deploy»). Per le istanze lo fa Terraform
//  (google_identity_platform_config); questo script serve alla regia e a
//  qualunque progetto creato a mano.
// =====================================================================
import { accessToken, arg } from './lib-firestore.js'

const PROGETTO = arg('project')
if (!PROGETTO) {
  console.error('Uso: node scripts/abilita-accesso-email.mjs --project <id>')
  process.exit(1)
}
const token = await accessToken()
const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const BASE = 'https://identitytoolkit.googleapis.com'

async function accendi() {
  const res = await fetch(`${BASE}/admin/v2/projects/${PROGETTO}/config?updateMask=signIn.email`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } }),
  })
  return res.json().catch(() => ({}))
}

let json = await accendi()
if (json.error?.message?.includes('CONFIGURATION_NOT_FOUND')) {
  const init = await fetch(`${BASE}/v2/projects/${PROGETTO}/identityPlatform:initializeAuth`, { method: 'POST', headers: h, body: '{}' })
  const esito = await init.json().catch(() => ({}))
  if (esito.error) {
    console.error(`✖ inizializzazione di Auth: ${esito.error.status || init.status}: ${esito.error.message}`)
    process.exit(1)
  }
  console.log(`[auth] ${PROGETTO}: Auth inizializzata`)
  json = await accendi()
}
if (json.error) {
  console.error(`✖ ${json.error.status || ''}: ${json.error.message}`)
  process.exit(1)
}
console.log(`[auth] ✓ ${PROGETTO}: accesso con email e password acceso`)
