// =====================================================================
//  Rimette in riga le UNITÀ DI MISURA dell'inventario.
//
//    node scripts/normalizza-unita-inventario.js            # ANTEPRIMA
//    node scripts/normalizza-unita-inventario.js --apply    # scrive
//    node scripts/normalizza-unita-inventario.js --project tana-drink --apply
//
//  Il modello vuole `unit` = unità BASE (ml | g | pz) e `display_unit` =
//  l'unità con cui si scrive e si legge (cl, L, kg…). Giacenza e formato
//  della confezione stanno sempre in unità base.
//
//  Una parte dell'inventario ha invece `unit: 'cl'` con formato e giacenza
//  scritti in cl. Il risultato è che una bottiglia da 70 cl viene letta come
//  70 ml e mostrata come 7 cl, il costo al cl non si calcola più (la
//  conversione si rifiuta di lavorare fuori dalla sua famiglia) e le ricette
//  restano senza valore — quindi niente margini.
//
//  Qui si converte: unit → base, display_unit → l'unità di prima,
//  package_size e stock moltiplicati per il fattore. Nessun altro campo si
//  tocca: nomi, costi, categorie e soglie restano dove sono.
//
//  Default: progetto tana-drink-test (la produzione va indicata a mano).
//  Autenticazione: sessione del Firebase CLI (firebase login).
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

// Quante unità base vale un'unità (deve restare uguale a inventory.js).
const BASE_PER_UNIT = { l: 1000, cl: 10, ml: 1, kg: 1000, g: 1, mg: 0.001, pz: 1 }
const BASE_DI = { l: 'ml', cl: 'ml', ml: 'ml', kg: 'g', g: 'g', mg: 'g', pz: 'pz' }

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
  console.error('[unita] Autenticazione fallita: esegui "npx firebase-tools login".')
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
console.log(`[unita] ${docs.length} articoli su "${PROJECT}"`)

const daSistemare = []
for (const d of docs) {
  const f = d.fields || {}
  const unit = String(strOf(f.unit) || 'pz').toLowerCase()
  const base = BASE_DI[unit]
  if (!base || base === unit) continue // già a posto (ml, g, pz)
  const k = BASE_PER_UNIT[unit] || 1
  daSistemare.push({
    doc: d,
    nome: strOf(f.name) || '(senza nome)',
    unit,
    base,
    k,
    display: strOf(f.display_unit),
    pack: numOf(f.package_size),
    stock: numOf(f.stock),
  })
}

console.log(`\n  da convertire: ${daSistemare.length}`)
if (daSistemare.length === 0) {
  console.log('[unita] Niente da fare: le unità sono già tutte di base.')
  process.exit(0)
}
for (const x of daSistemare.slice(0, 25)) {
  const packDopo = x.pack > 0 ? Math.round(x.pack * x.k) : null
  console.log(
    `   ~ ${x.nome.padEnd(26)} ${x.unit} → ${x.base}` +
      (packDopo ? ` · confezione ${x.pack} → ${packDopo} ${x.base} (${x.pack} ${x.unit})` : '') +
      (x.stock ? ` · giacenza ${x.stock} → ${Math.round(x.stock * x.k * 1000) / 1000}` : '')
  )
}
if (daSistemare.length > 25) console.log(`   … e altri ${daSistemare.length - 25}`)

if (!APPLY) {
  console.log('\n[unita] ANTEPRIMA: nessuna scrittura. Aggiungi --apply per salvare.')
  process.exit(0)
}

const writes = daSistemare.map((x) => {
  const fields = {
    unit: { stringValue: x.base },
    // L'unità di prima diventa quella con cui si continua a leggere e a
    // scrivere: chi lavorava in cl deve continuare a vedere i cl.
    display_unit: { stringValue: x.display || x.unit },
  }
  const paths = ['unit', 'display_unit']
  if (x.pack > 0) {
    fields.package_size = { integerValue: String(Math.round(x.pack * x.k)) }
    paths.push('package_size')
  }
  if (x.stock != null) {
    fields.stock = { doubleValue: Math.round(x.stock * x.k * 1000) / 1000 }
    paths.push('stock')
  }
  return { update: { name: x.doc.name, fields }, updateMask: { fieldPaths: paths } }
})

await commit(writes)
console.log(`\n[unita] ✓ convertiti ${writes.length} articoli su "${PROJECT}".`)
