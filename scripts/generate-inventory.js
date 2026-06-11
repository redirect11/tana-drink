// =====================================================================
//  Genera l'inventario dai prodotti dell'export CSV SumUp ("carte"):
//  bottiglie di distillati/gin/amari, birre, mixer, soft drink, vini.
//
//    node scripts/generate-inventory.js --csv carte.csv [--project tana-drink] [--apply]
//
//  Senza --apply: dry-run (mostra cosa creerebbe). Con --apply:
//  SOSTITUISCE inventory_items e inventory_categories del progetto.
//  Autenticazione: sessione del Firebase CLI (firebase login).
// =====================================================================
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { parseCarteCsv, extractInventory } from '../src/lib/carteImport.js'

const args = process.argv.slice(2)
const getArg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const CSV_PATH = getArg('csv', 'carte_202606100711.csv')
const PROJECT = getArg('project', 'tana-drink')
const APPLY = args.includes('--apply')

const { products } = parseCarteCsv(readFileSync(CSV_PATH, 'latin1'))
const { categories, items } = extractInventory(products)

console.log(`[inventario] ${items.length} ingredienti in ${categories.length} categorie`)
for (const c of categories) {
  const list = items.filter((i) => i.cat === c.key)
  const sample = list.slice(0, 4).map((i) => i.name).join(' · ')
  console.log(`  ${c.name.padEnd(18)} ${String(list.length).padStart(3)}  (${sample}…)`)
}

if (!APPLY) {
  console.log('\n[inventario] DRY-RUN: nessuna scrittura. Aggiungi --apply per creare davvero.')
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
  console.error('[inventario] Autenticazione fallita: esegui "npx firebase-tools login".')
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
const I = (v) => ({ integerValue: String(v) })
const NUL = { nullValue: null }

// 1. Svuota inventario esistente.
for (const col of ['inventory_items', 'inventory_categories']) {
  const docs = await listAll(col)
  if (docs.length) {
    await commit(docs.map((d) => ({ delete: d.name })))
    console.log(`[inventario] svuotata "${col}" (${docs.length})`)
  }
}

// 2. Categorie inventario.
const now = new Date().toISOString()
const catIds = {}
for (const c of categories) {
  const res = await (await fetch(`${BASE}/inventory_categories`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ fields: { name: S(c.name), sort_order: I(c.sort_order), created_at: S(now) } }),
  })).json()
  if (res.error) throw new Error(`categoria ${c.name}: ${res.error.message}`)
  catIds[c.key] = res.name.split('/').pop()
}
console.log(`[inventario] create ${categories.length} categorie`)

// 3. Ingredienti.
const writes = items.map((it) => ({
  update: {
    name: `${DOC_ROOT}/inventory_items/${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
    fields: {
      name: S(it.name),
      unit: S(it.unit),
      package_size: it.package_size == null ? NUL : I(it.package_size),
      stock: I(it.stock),
      low_threshold: I(it.low_threshold),
      category_id: S(catIds[it.cat]),
      created_at: S(now),
    },
  },
}))
await commit(writes)
console.log(`[inventario] ✓ creati ${items.length} ingredienti in "${PROJECT}"`)
