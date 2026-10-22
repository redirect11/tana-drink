// =====================================================================
//  I RUOLI DEL SERVICE ACCOUNT DI PROVISIONING (REQ-FLOTTA-006).
//
//    node scripts/ruoli-provisioning.mjs --sa provisioning@drink-regia.iam.gserviceaccount.com \
//         --billing 01FD7B-XXXXXX-XXXXXX --bucket drink-regia-tfstate --progetto drinkpos-demo
//
//  Dà al service account quello che il workflow provisiona-istanza.yml gli
//  chiede: usare l'account di fatturazione (agganciare Blaze ai progetti
//  nuovi), scrivere lo stato Terraform nel bucket, e amministrare il
//  progetto di un'istanza (--progetto, ripetibile: senza Organizzazione i
//  progetti li crea l'utente, e il ruolo va dato uno per uno).
//  Lo lancia una persona, col suo accesso (22/10/2026: via libera
//  esplicito dell'utente). Idempotente: un ruolo già dato non si duplica.
// =====================================================================
import { accessToken, arg } from './lib-firestore.js'

const SA = arg('sa')
const BILLING = arg('billing')
const BUCKET = arg('bucket')
const PROGETTI = process.argv.flatMap((a, i, all) => (a === '--progetto' ? [all[i + 1]] : []))
if (!SA) {
  console.error('Uso: node scripts/ruoli-provisioning.mjs --sa <email> [--billing <id>] [--bucket <nome>] [--progetto <id>]...')
  process.exit(1)
}
const token = await accessToken()
const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const membro = `serviceAccount:${SA}`

// La lettura della policy è POST per i progetti e GET per gli account di
// fatturazione (Cloud Billing API); la scrittura è POST per tutti e due.
async function aggiungi(url, ruoli, { lettura = 'POST' } = {}) {
  const get = await fetch(`${url}:getIamPolicy`, lettura === 'GET' ? { headers: h } : { method: 'POST', headers: h, body: JSON.stringify({}) })
  const policy = await get.json()
  if (policy.error) throw new Error(`${url}: ${policy.error.message}`)
  policy.bindings = policy.bindings || []
  let nuovi = 0
  for (const role of ruoli) {
    let b = policy.bindings.find((x) => x.role === role && !x.condition)
    if (!b) policy.bindings.push((b = { role, members: [] }))
    if (!b.members.includes(membro)) {
      b.members.push(membro)
      nuovi += 1
    }
  }
  if (nuovi === 0) return 'già a posto'
  const set = await fetch(`${url}:setIamPolicy`, { method: 'POST', headers: h, body: JSON.stringify({ policy }) })
  const j = await set.json()
  if (j.error) throw new Error(`${url}: ${j.error.message}`)
  return `${nuovi} ruoli dati`
}

if (BILLING) {
  console.log('fatturazione:', await aggiungi(`https://cloudbilling.googleapis.com/v1/billingAccounts/${BILLING}`, ['roles/billing.user'], { lettura: 'GET' }))
}
if (BUCKET) {
  // I bucket hanno la loro API: la policy si legge e si scrive con GET/PUT.
  const get = await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/iam`, { headers: h })
  const policy = await get.json()
  if (policy.error) throw new Error(policy.error.message)
  let b = policy.bindings.find((x) => x.role === 'roles/storage.objectAdmin')
  if (!b) policy.bindings.push((b = { role: 'roles/storage.objectAdmin', members: [] }))
  if (!b.members.includes(membro)) {
    b.members.push(membro)
    const put = await fetch(`https://storage.googleapis.com/storage/v1/b/${BUCKET}/iam`, { method: 'PUT', headers: h, body: JSON.stringify(policy) })
    const j = await put.json()
    if (j.error) throw new Error(j.error.message)
    console.log('bucket: 1 ruolo dato')
  } else console.log('bucket: già a posto')
}
for (const p of PROGETTI) {
  // Owner: il provisioning amministra l'istanza per intero (API, Firebase,
  // Firestore, Hosting, Auth, IAM del progetto). È il ruolo che Terraform e
  // il deploy si aspettano; un elenco più stretto si rompe a ogni risorsa nuova.
  console.log(`progetto ${p}:`, await aggiungi(`https://cloudresourcemanager.googleapis.com/v1/projects/${p}`, ['roles/owner']))
}
