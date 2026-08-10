// =====================================================================
//  ELIMINA GLI ORDINI NON CHIUSI da un progetto.
//
//    node scripts/pulisci-ordini-aperti.js                    # ANTEPRIMA (test)
//    node scripts/pulisci-ordini-aperti.js --project tana-drink
//    node scripts/pulisci-ordini-aperti.js --project tana-drink --apply
//
//  "Non chiuso" = né pagato né annullato: sono i conti rimasti aperti dalle
//  prove. Un conto PAGATO non si tocca mai, nemmeno se è vecchio: è un
//  incasso, e sparirebbe dalle chiusure di cassa e dalle statistiche.
//
//  La cancellazione è DEFINITIVA: l'anteprima elenca sempre tutto quello che
//  verrebbe tolto, con numero, data e totale, così si vede prima.
//
//  Default: progetto tana-drink-test (la produzione va indicata a mano).
// =====================================================================
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
const getArg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const PROJECT = getArg('project', 'tana-drink-test')
const APPLY = args.includes('--apply')

const cfg = JSON.parse(
  readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8')
)
const tok = await (
  await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: cfg.tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
).json()
if (!tok.access_token) {
  console.error('[ordini] Autenticazione fallita: esegui "npx firebase-tools login".')
  process.exit(1)
}
const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' }
const radice = `projects/${PROJECT}/databases/(default)/documents`
const BASE = `https://firestore.googleapis.com/v1/${radice}`

async function listAll(col) {
  const out = []
  let pageToken = ''
  do {
    const res = await (
      await fetch(`${BASE}/${col}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, {
        headers: auth,
      })
    ).json()
    if (res.error) throw new Error(`${col}: ${res.error.message}`)
    out.push(...(res.documents || []))
    pageToken = res.nextPageToken || ''
  } while (pageToken)
  return out
}
async function commit(writes) {
  for (let i = 0; i < writes.length; i += 200) {
    const res = await (
      await fetch(`https://firestore.googleapis.com/v1/${radice}:commit`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ writes: writes.slice(i, i + 200) }),
      })
    ).json()
    if (res.error) throw new Error(`commit: ${res.error.message}`)
  }
}
const v = (f) => {
  if (!f) return undefined
  if (f.stringValue !== undefined) return f.stringValue
  if (f.integerValue !== undefined) return Number(f.integerValue)
  if (f.doubleValue !== undefined) return f.doubleValue
  if (f.timestampValue !== undefined) return f.timestampValue
  if (f.arrayValue !== undefined) return (f.arrayValue.values || []).map(v)
  return undefined
}
const campo = (d, k) => v(d.fields?.[k])
const idDi = (d) => d.name.split('/').pop()

const docs = await listAll('orders')
const chiuso = (d) =>
  campo(d, 'status') === 'pagato' ||
  campo(d, 'status') === 'annullato' ||
  campo(d, 'payment_status') === 'pagato'

const daTogliere = docs.filter((d) => !chiuso(d))
const conIncasso = daTogliere.filter((d) => (campo(d, 'payments') || []).length > 0)

console.log(`[ordini] ${PROJECT}${APPLY ? '' : '   (ANTEPRIMA)'}`)
console.log(`  ordini in tutto:        ${docs.length}`)
console.log(`  chiusi (non si toccano): ${docs.length - daTogliere.length}`)
console.log(`  DA ELIMINARE:            ${daTogliere.length}\n`)

for (const d of daTogliere.slice(0, 40)) {
  const q = (campo(d, 'items') || []).length
  console.log(
    `   #${String(campo(d, 'daily_number') ?? '?').padStart(3)}` +
      `  ${String(campo(d, 'created_at') || '').slice(0, 16).replace('T', ' ')}` +
      `  ${String(campo(d, 'customer_name') || '—').padEnd(18)}` +
      `  ${q} righe · ${campo(d, 'total') ?? 0} €` +
      `  [${campo(d, 'status') ?? '—'}]`
  )
}
if (daTogliere.length > 40) console.log(`   … e altri ${daTogliere.length - 40}`)

// Un conto non chiuso ma con un acconto registrato è un caso da guardare in
// faccia: cancellarlo fa sparire dei soldi già incassati.
if (conIncasso.length) {
  console.log(`\n  ⚠️  ${conIncasso.length} di questi hanno GIÀ un incasso registrato (acconti):`)
  for (const d of conIncasso) {
    const tot = (campo(d, 'payments') || []).reduce((s, p) => s + (Number(v(p.mapValue?.fields?.amount)) || 0), 0)
    console.log(`   ! #${campo(d, 'daily_number') ?? '?'} — incassati ${tot} €`)
  }
  console.log('   Cancellandoli, quei soldi spariscono dalle chiusure di cassa.')
}

if (!APPLY) {
  console.log('\n[ordini] ANTEPRIMA: nessuna cancellazione. Aggiungi --apply per eliminarli.')
  process.exit(0)
}

await commit(daTogliere.map((d) => ({ delete: `${radice}/orders/${idDi(d)}` })))
console.log(`\n[ordini] ✓ eliminati ${daTogliere.length} ordini non chiusi da "${PROJECT}".`)
