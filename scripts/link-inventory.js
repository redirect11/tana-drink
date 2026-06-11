// =====================================================================
//  Collega le voci di menu "senza preparazione" al loro ingrediente in
//  inventario (recipe_items 1:1): vendere la voce scala la scorta.
//
//    node scripts/link-inventory.js [--project tana-drink] [--apply]
//
//  Legge drinks e inventory_items dal progetto, calcola i collegamenti
//  con le regole di carteImport.recipeLinkFor e aggiorna SOLO i drink
//  senza ricetta (non tocca ricette inserite a mano).
//  Senza --apply: dry-run. Autenticazione: sessione Firebase CLI.
// =====================================================================
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { recipeLinkFor } from '../src/lib/carteImport.js'

const args = process.argv.slice(2)
const getArg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const PROJECT = getArg('project', 'tana-drink')
const APPLY = args.includes('--apply')
const EMULATOR = args.includes('--emulator')

const cfg = EMULATOR
  ? null
  : JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'))
const tok = EMULATOR ? { access_token: 'owner' } : await (await fetch('https://oauth2.googleapis.com/token', {
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
  console.error('[link] Autenticazione fallita: esegui "npx firebase-tools login".')
  process.exit(1)
}
const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' }
const BASE = `${EMULATOR ? 'http://localhost:8080' : 'https://firestore.googleapis.com'}/v1/projects/${EMULATOR ? 'demo-tana-drink' : PROJECT}/databases/(default)/documents`

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

const str = (f) => f?.stringValue ?? null
const num = (f) => (f?.doubleValue ?? (f?.integerValue != null ? Number(f.integerValue) : null))

// Inventario: nome (lowercase) → { id, unit }
const inventory = new Map()
for (const d of await listAll('inventory_items')) {
  inventory.set(str(d.fields.name)?.toLowerCase(), {
    id: d.name.split('/').pop(),
    unit: str(d.fields.unit) || 'ml',
  })
}
console.log(`[link] inventario: ${inventory.size} ingredienti`)

const drinks = await listAll('drinks')
let linked = 0
let skippedRecipe = 0
let noMatch = 0
const updates = []

for (const d of drinks) {
  const f = d.fields
  const existing = f.recipe_items?.arrayValue?.values?.length || 0
  if (existing > 0) { skippedRecipe++; continue }

  const link = recipeLinkFor({
    name: str(f.name) || '',
    category: str(f.category) || '',
    price: num(f.price) ?? 0,
  })
  if (!link) continue
  const inv = inventory.get(link.invName.toLowerCase())
  if (!inv) { noMatch++; console.warn(`  ? nessun ingrediente per: ${str(f.name)} → ${link.invName}`); continue }

  linked++
  if (APPLY) {
    updates.push({
      update: {
        name: d.name,
        fields: {
          recipe_items: {
            arrayValue: {
              values: [{
                mapValue: {
                  fields: {
                    inventory_item_id: { stringValue: inv.id },
                    name: { stringValue: link.invName },
                    unit: { stringValue: inv.unit },
                    qty: { doubleValue: link.qty },
                  },
                },
              }],
            },
          },
        },
      },
      updateMask: { fieldPaths: ['recipe_items'] },
    })
  } else {
    console.log(`  + ${str(f.name)} → ${link.invName} (${link.qty} ${inv.unit})`)
  }
}

if (APPLY && updates.length) {
  for (let i = 0; i < updates.length; i += 400) {
    const res = await (await fetch(`${BASE.replace('/documents', '')}/documents:commit`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ writes: updates.slice(i, i + 400) }),
    })).json()
    if (res.error) throw new Error(`commit: ${res.error.message}`)
  }
}

console.log(`\n[link] ${APPLY ? '✓ collegati' : 'collegabili'}: ${linked} drink · con ricetta esistente (intatti): ${skippedRecipe} · senza ingrediente corrispondente: ${noMatch}`)
if (!APPLY) console.log('[link] DRY-RUN: aggiungi --apply per scrivere.')
