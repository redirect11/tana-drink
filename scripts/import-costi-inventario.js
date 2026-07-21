// =====================================================================
//  Porta i COSTI AL DETTAGLIO dal foglio INV nell'inventario del gestionale,
//  così il POS può calcolare il prezzo reale di un drink dalla sua ricetta.
//
//    python scripts/estrai-costi-inventario.py         # 1. legge INV.xlsx
//    node scripts/import-costi-inventario.js           # 2. ANTEPRIMA
//    node scripts/import-costi-inventario.js --apply   # 3. scrive davvero
//
//  Opzioni: --project <id> --emulator --force --json <file>
//  Aggiorna SOLO i campi del costo (cost, vat, package_size quando manca):
//  nome, giacenze e soglie non si toccano. Senza --force lascia stare gli
//  articoli che un costo ce l'hanno già.
//  Autenticazione: sessione del Firebase CLI (firebase login).
// =====================================================================
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
const getArg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const JSON_PATH = getArg('json', 'costi-inventario.json')
const PROJECT = getArg('project', 'tana-drink')
const APPLY = args.includes('--apply')
const EMULATOR = args.includes('--emulator')
const FORCE = args.includes('--force')

const { sheet, products } = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
console.log(`[costi] ${products.length} prodotti dal foglio "${sheet}"`)

// Confronto dei nomi tollerante: minuscole, senza accenti e punteggiatura,
// spazi normalizzati ("Amaro del Capo " ≈ "amaro del capo").
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // toglie i segni diacritici
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// ── Autenticazione via sessione Firebase CLI ──────────────────────────
const cfg = EMULATOR
  ? null
  : JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'))
const tok = EMULATOR
  ? { access_token: 'owner' }
  : await (
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
  console.error('[costi] Autenticazione fallita: esegui "npx firebase-tools login".')
  process.exit(1)
}
const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' }
const DOC_ROOT = `projects/${EMULATOR ? 'demo-tana-drink' : PROJECT}/databases/(default)/documents`
const BASE = `${EMULATOR ? 'http://localhost:8080' : 'https://firestore.googleapis.com'}/v1/${DOC_ROOT}`

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

// ── Confronto inventario ↔ listino ────────────────────────────────────
const docs = await listAll('inventory_items')
console.log(`[costi] ${docs.length} articoli in inventario su "${EMULATOR ? 'emulatore' : PROJECT}"`)

const listino = new Map()
for (const p of products) if (p.cost > 0) listino.set(norm(p.name), p)

const daAggiornare = []
const giaValorizzati = []
const senzaCorrispondenza = []

for (const d of docs) {
  const f = d.fields || {}
  const nome = strOf(f.name)
  const p = listino.get(norm(nome))
  if (!p) {
    senzaCorrispondenza.push(nome)
    continue
  }
  const costoAttuale = numOf(f.cost)
  if (costoAttuale > 0 && !FORCE) {
    giaValorizzati.push(nome)
    continue
  }
  const unit = strOf(f.unit) || 'pz'
  const packAttuale = numOf(f.package_size)
  // Il formato si scrive solo se manca: quello in gestionale ha la
  // precedenza (potrebbe essere stato corretto a mano).
  const pack = packAttuale > 0 ? packAttuale : unit === 'ml' ? p.package_size_ml : null
  daAggiornare.push({ doc: d, nome, p, unit, pack, costoAttuale })
}

const nonUsati = [...listino.values()].filter(
  (p) => !docs.some((d) => norm(strOf(d.fields?.name)) === norm(p.name))
)

console.log(`\n  da aggiornare : ${daAggiornare.length}`)
console.log(`  già valorizzati: ${giaValorizzati.length}${FORCE ? '' : ' (usa --force per sovrascrivere)'}`)
console.log(`  senza costo nel listino: ${senzaCorrispondenza.length}`)
console.log(`  nel listino ma non in inventario: ${nonUsati.length}`)

for (const x of daAggiornare.slice(0, 15)) {
  const perCl = x.pack > 0 ? (x.p.cost * (1 + x.p.vat / 100)) / (x.pack / 10) : null
  console.log(
    `   + ${x.nome.padEnd(28)} ${String(x.p.cost).padStart(8)} € /conf` +
      (perCl ? ` · ${perCl.toFixed(4)} €/cl` : ' · (a pezzo)')
  )
}
if (daAggiornare.length > 15) console.log(`   … e altri ${daAggiornare.length - 15}`)

if (senzaCorrispondenza.length) {
  console.log(`\n  Senza corrispondenza nel listino (restano senza costo):`)
  console.log('   ' + senzaCorrispondenza.slice(0, 20).join(', ') + (senzaCorrispondenza.length > 20 ? ' …' : ''))
}

if (!APPLY) {
  console.log('\n[costi] ANTEPRIMA: nessuna scrittura. Aggiungi --apply per salvare.')
  process.exit(0)
}

// ── Scrittura: solo i campi del costo, con updateMask ─────────────────
const writes = daAggiornare.map((x) => {
  const fields = {
    cost: { doubleValue: x.p.cost },
    vat: { doubleValue: x.p.vat },
  }
  const paths = ['cost', 'vat']
  if (x.pack > 0 && !(numOf(x.doc.fields?.package_size) > 0)) {
    fields.package_size = { integerValue: String(Math.round(x.pack)) }
    paths.push('package_size')
  }
  return { update: { name: x.doc.name, fields }, updateMask: { fieldPaths: paths } }
})

await commit(writes)
console.log(`\n[costi] ✓ aggiornati ${writes.length} articoli su "${EMULATOR ? 'emulatore' : PROJECT}".`)
