// =====================================================================
//  Imposta l'IVA di ACQUISTO su TUTTI i prodotti dell'inventario.
//  Le fatture fornitore sono al 22%: i prodotti nati con l'IVA di vendita
//  (10%) vanno riallineati.
//
//    node scripts/set-iva-acquisto.js                       # ANTEPRIMA (test)
//    node scripts/set-iva-acquisto.js --apply               # scrive davvero
//    node scripts/set-iva-acquisto.js --vat 22 --apply
//    node scripts/set-iva-acquisto.js --project tana-drink --apply   # PRODUZIONE
//
//  Default: progetto tana-drink-test (la produzione va indicata a mano).
//  Tocca SOLO il campo `vat`: costi, giacenze e nomi restano intatti.
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
const VAT = Number(getArg('vat', '22'))
const APPLY = args.includes('--apply')

if (!(VAT >= 0)) {
  console.error('[iva] --vat non valida')
  process.exit(1)
}

// ── Autenticazione via sessione Firebase CLI ──────────────────────────
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
  console.error('[iva] Autenticazione fallita: esegui "npx firebase-tools login".')
  process.exit(1)
}
const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' }
const DOC_ROOT = `projects/${PROJECT}/databases/(default)/documents`
const BASE = `https://firestore.googleapis.com/v1/${DOC_ROOT}`

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

const docs = await listAll('inventory_items')
console.log(`[iva] progetto ${PROJECT} · ${docs.length} prodotti in inventario`)

const perVat = new Map()
const writes = []
for (const d of docs) {
  const cur = numOf(d.fields?.vat)
  perVat.set(cur, (perVat.get(cur) || 0) + 1)
  if (cur === VAT) continue
  writes.push({
    update: { name: d.name, fields: { vat: { doubleValue: VAT } } },
    updateMask: { fieldPaths: ['vat'] },
  })
}

console.log('[iva] situazione attuale:')
for (const [v, n] of [...perVat.entries()].sort((a, b) => (a[0] ?? -1) - (b[0] ?? -1))) {
  console.log(`   IVA ${v == null ? '(assente)' : `${v}%`}: ${n} prodotti`)
}
console.log(`[iva] da portare a ${VAT}%: ${writes.length} prodotti`)

if (!APPLY) {
  console.log('[iva] ANTEPRIMA — rilancia con --apply per scrivere.')
  process.exit(0)
}
await commit(writes)
console.log(`[iva] fatto: ${writes.length} prodotti aggiornati a IVA ${VAT}%.`)
