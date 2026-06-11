// =====================================================================
//  Import del catalogo prodotti da un export CSV di SumUp ("carte").
//
//    node scripts/import-carte.js --csv carte.csv [--project tana-drink] [--apply]
//
//  Senza --apply esegue una prova (dry-run): mostra cosa importerebbe.
//  Con --apply: SOSTITUISCE drinks e categories del progetto indicato
//  (produzione!) con il contenuto del CSV.
//
//  Autenticazione: riusa la sessione del Firebase CLI (firebase login),
//  nessun service account necessario. Particolarità dell'export SumUp:
//  Price e Cost usano la virgola decimale non quotata, quindi ognuno
//  occupa DUE colonne (euro, centesimi).
// =====================================================================
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
const getArg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const CSV_PATH = getArg('csv', 'carte_202606100711.csv')
const PROJECT = getArg('project', 'tana-drink')
const APPLY = args.includes('--apply')

// ── Parsing (modulo condiviso col pannello admin) ─────────────────────
import { parseCarteCsv } from '../src/lib/carteImport.js'

const { products, categories: catNames, skipped } = parseCarteCsv(readFileSync(CSV_PATH, 'latin1'))
if (skipped) console.warn(`[import] ${skipped} righe non valide saltate`)

// Categorie nell'ordine di prima apparizione nel file.
const categories = catNames

console.log(`[import] CSV: ${products.length} prodotti, ${categories.length} categorie`)
for (const c of categories) {
  const list = products.filter((p) => p.category === c)
  const sample = list.slice(0, 3).map((p) => `${p.name} €${p.price.toFixed(2)}`).join(' · ')
  console.log(`  ${c.padEnd(20)} ${String(list.length).padStart(3)}  (${sample}…)`)
}

if (!APPLY) {
  console.log('\n[import] DRY-RUN: nessuna scrittura. Aggiungi --apply per importare davvero.')
  process.exit(0)
}

// ── Autenticazione via sessione Firebase CLI ──────────────────────────
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
  console.error('[import] Autenticazione fallita: esegui "npx firebase-tools login".')
  process.exit(1)
}
const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' }
const DOC_ROOT = `projects/${PROJECT}/databases/(default)/documents`
const BASE = `https://firestore.googleapis.com/v1/${DOC_ROOT}`

async function listAll(col) {
  const out = []
  let pageToken = ''
  do {
    const res = await (await fetch(`${BASE}/${col}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: auth })).json()
    if (res.error) throw new Error(`${col}: ${res.error.message}`)
    out.push(...(res.documents || []))
    pageToken = res.nextPageToken || ''
  } while (pageToken)
  return out
}

async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const res = await (await fetch(`${BASE.replace('/documents', '')}/documents:commit`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ writes: writes.slice(i, i + 400) }),
    })).json()
    if (res.error) throw new Error(`commit: ${res.error.message}`)
  }
}

const S = (v) => ({ stringValue: String(v) })
const N = (v) => ({ doubleValue: v })
const I = (v) => ({ integerValue: String(v) })
const B = (v) => ({ booleanValue: v })
const NUL = { nullValue: null }

// 1. Svuota drinks e categories esistenti.
for (const col of ['drinks', 'categories']) {
  const docs = await listAll(col)
  if (docs.length) {
    await commit(docs.map((d) => ({ delete: d.name })))
    console.log(`[import] svuotata "${col}" (${docs.length} documenti)`)
  }
}

// 2. Categorie (id auto, sort_order da ordine nel file).
const now = new Date().toISOString()
const catIds = {}
let sort = 0
for (const name of categories) {
  const res = await (await fetch(`${BASE}/categories`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ fields: { name: S(name), sort_order: I(sort++), created_at: S(now) } }),
  })).json()
  if (res.error) throw new Error(`categoria ${name}: ${res.error.message}`)
  catIds[name] = res.name.split('/').pop()
}
console.log(`[import] create ${categories.length} categorie`)

// 3. Prodotti.
const writes = products.map((p) => ({
  update: {
    name: `${DOC_ROOT}/drinks/${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
    fields: {
      name: S(p.name),
      description: p.description ? S(p.description) : NUL,
      category: S(p.category),
      category_id: S(catIds[p.category]),
      recipe: NUL,
      recipe_items: { arrayValue: {} },
      price: N(p.price),
      available: B(true),
      image_url: NUL,
      sumup_product_id: S(p.sumup_product_id),
      created_at: S(now),
    },
  },
}))
await commit(writes)
console.log(`[import] ✓ importati ${products.length} prodotti in "${PROJECT}"`)
