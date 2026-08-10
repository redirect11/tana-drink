// =====================================================================
//  TUTTO L'INVENTARIO CONTATO A PEZZO.
//
//    node scripts/inventario-a-pezzo.js            # ANTEPRIMA
//    node scripts/inventario-a-pezzo.js --apply    # scrive
//    node scripts/inventario-a-pezzo.js --project tana-drink --apply
//
//  Al banco si contano bottiglie, non millilitri: "9 bottiglie e una aperta a
//  metà" si dice in un attimo, "6.350 ml" no. La giacenza passa quindi in
//  PEZZI, e il contenuto della bottiglia resta scritto (package_size +
//  content_unit) perché continua a servire per il costo al cl e per leggere
//  quanto è rimasto nell'aperta.
//
//  Una giacenza frazionaria non è un errore: 0,8 pz è una bottiglia aperta
//  all'80%, ed è così che la mostra l'inventario ("1 bott. · aperta 56 cl").
//
//  LE RICETTE NON SI TOCCANO: restano in cl/ml, come si versa. È lo scarico
//  a convertire (vedi qtyInStockUnit in src/lib/inventory.js): 40 ml da una
//  bottiglia da 700 valgono 0,057 pezzi.
//
//  Restano fuori solo gli articoli SENZA contenuto dichiarato: senza sapere
//  quanto contiene una confezione non si può dire quante confezioni siano
//  quei millilitri, e inventarselo sarebbe peggio che lasciarli come stanno.
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
  console.error('[pezzo] Autenticazione fallita: esegui "npx firebase-tools login".')
  process.exit(1)
}
const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' }
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

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
  for (let i = 0; i < writes.length; i += 400) {
    const res = await (
      await fetch(`${BASE.replace('/documents', '')}/documents:commit`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ writes: writes.slice(i, i + 400) }),
      })
    ).json()
    if (res.error) throw new Error(`commit: ${res.error.message}`)
  }
}
const numOf = (f) =>
  f?.doubleValue != null
    ? Number(f.doubleValue)
    : f?.integerValue != null
      ? Number(f.integerValue)
      : null
const strOf = (f) => (f?.stringValue != null ? f.stringValue : null)

const docs = await listAll('inventory_items')
const daCambiare = []
const senzaContenuto = []
let giaPezzo = 0
for (const d of docs) {
  const f = d.fields || {}
  const unit = String(strOf(f.unit) || 'pz').toLowerCase()
  if (unit === 'pz') {
    giaPezzo++
    continue
  }
  const pack = numOf(f.package_size) || 0
  const nome = strOf(f.name) || '(senza nome)'
  if (!(pack > 0)) {
    senzaContenuto.push(nome)
    continue
  }
  const stock = numOf(f.stock) || 0
  const soglia = numOf(f.low_threshold) || 0
  daCambiare.push({
    doc: d,
    nome,
    unit,
    pack,
    stock,
    soglia,
    pezzi: Math.round((stock / pack) * 1000) / 1000,
    // La soglia di riordino era in ml: va convertita anche lei, altrimenti
    // "avvisami sotto i 200 ml" diventa "sotto le 200 bottiglie" e l'intero
    // magazzino risulta in esaurimento.
    sogliaPezzi: Math.round((soglia / pack) * 1000) / 1000,
  })
}

console.log(`[pezzo] ${docs.length} articoli su "${PROJECT}"`)
console.log(`\n  già a pezzo: ${giaPezzo}`)
console.log(`  da portare a pezzo: ${daCambiare.length}`)
for (const x of daCambiare.slice(0, 25)) {
  console.log(
    `   ~ ${x.nome.padEnd(26)} ${x.unit} → pz · 1 pz = ${x.pack / 10} cl` +
      ` · giacenza ${x.stock} → ${x.pezzi} pz` +
      (x.soglia ? ` · soglia ${x.soglia} → ${x.sogliaPezzi}` : '')
  )
}
if (daCambiare.length > 25) console.log(`   … e altri ${daCambiare.length - 25}`)
if (senzaContenuto.length) {
  console.log(`\n  SENZA contenuto dichiarato (restano come sono): ${senzaContenuto.length}`)
  console.log('   ' + senzaContenuto.slice(0, 20).join(', ') + (senzaContenuto.length > 20 ? ' …' : ''))
}

if (!APPLY) {
  console.log('\n[pezzo] ANTEPRIMA: nessuna scrittura. Aggiungi --apply per salvare.')
  process.exit(0)
}

await commit(
  daCambiare.map((x) => ({
    update: {
      name: x.doc.name,
      fields: {
        unit: { stringValue: 'pz' },
        display_unit: { stringValue: 'pz' },
        stock: { doubleValue: x.pezzi },
        low_threshold: { doubleValue: x.sogliaPezzi },
        // Il contenuto resta dov'era; qui si dice solo di che famiglia è,
        // così il costo al cl continua a esistere.
        content_unit: { stringValue: x.unit === 'g' ? 'g' : 'ml' },
      },
    },
    updateMask: {
      fieldPaths: ['unit', 'display_unit', 'stock', 'low_threshold', 'content_unit'],
    },
  }))
)
console.log(`\n[pezzo] ✓ portati a pezzo ${daCambiare.length} articoli su "${PROJECT}".`)
