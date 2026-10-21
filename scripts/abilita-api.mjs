// =====================================================================
//  ABILITA LE API DI UN PROGETTO GOOGLE CLOUD, dalla riga di comando.
//
//    node scripts/abilita-api.mjs --project drinkpos-demo
//    node scripts/abilita-api.mjs --project drinkpos-demo --api firestore.googleapis.com,run.googleapis.com
//
//  Senza gcloud sulla macchina (docs/flotta.md): usa il token del Firebase
//  CLI (lib-firestore.js) e l'API Service Usage. Di default abilita quello
//  che un'istanza della flotta si aspetta (infra/istanza/main.tf). Un'API
//  già accesa non dà errore.
// =====================================================================
import { accessToken, arg } from './lib-firestore.js'

const PROGETTO = arg('project')
if (!PROGETTO) {
  console.error('Uso: node scripts/abilita-api.mjs --project <id> [--api a,b,c]')
  process.exit(1)
}
const PREDEFINITE = [
  'serviceusage.googleapis.com',
  'firebase.googleapis.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'firebasehosting.googleapis.com',
  'cloudfunctions.googleapis.com',
  'cloudbuild.googleapis.com',
  'artifactregistry.googleapis.com',
  'run.googleapis.com',
  'eventarc.googleapis.com',
  'pubsub.googleapis.com',
  'storage.googleapis.com',
  'firebaseappcheck.googleapis.com',
  'iam.googleapis.com',
]
const API = (arg('api', '') || '').split(',').map((s) => s.trim()).filter(Boolean)
const elenco = API.length ? API : PREDEFINITE

const token = await accessToken()
const res = await fetch(`https://serviceusage.googleapis.com/v1/projects/${PROGETTO}/services:batchEnable`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ serviceIds: elenco }),
})
const json = await res.json().catch(() => ({}))
if (json.error) {
  console.error(`✖ ${json.error.status || res.status}: ${json.error.message}`)
  process.exit(1)
}
// È un'operazione lunga: si aspetta che finisca.
let op = json
while (op.name && !op.done) {
  await new Promise((r) => setTimeout(r, 3000))
  const r = await fetch(`https://serviceusage.googleapis.com/v1/${op.name}`, { headers: { Authorization: `Bearer ${token}` } })
  op = await r.json()
  if (op.error) {
    console.error(`✖ ${op.error.message}`)
    process.exit(1)
  }
}
console.log(`[api] ✓ ${PROGETTO}: ${elenco.length} API abilitate`)
