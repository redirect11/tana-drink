// =====================================================================
//  Porta l'inventario al nuovo stato di partenza: IN ASSORTIMENTO.
//
//    node scripts/stato-assortimento.js            # ANTEPRIMA
//    node scripts/stato-assortimento.js --apply    # scrive
//    node scripts/stato-assortimento.js --project tana-drink --apply
//
//  Gli stati sono quattro: 'assortimento' (si tiene, ed è il default),
//  'linea' (i cavalli di battaglia, non devono mancare mai), 'premium' e
//  'out'. Prima il default era 'linea', quindi TUTTO risultava "in linea" e
//  la distinzione non diceva più niente: se tutto è prioritario, niente lo è.
//
//  Qui si azzera quel falso: chi è 'linea' (o non ha stato) torna
//  'assortimento'. I 'premium' e gli 'out' NON si toccano: quelli sono
//  scelte vere, fatte a mano.
//
//  Chi va davvero in linea lo decide il gestore, prodotto per prodotto: sono
//  pochi, e sono i primi da controllare prima di una serata.
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
  console.error('[stato] Autenticazione fallita: esegui "npx firebase-tools login".')
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
const strOf = (f) => (f?.stringValue != null ? f.stringValue : null)

const docs = await listAll('inventory_items')
const conta = {}
const daCambiare = []
for (const d of docs) {
  const st = strOf(d.fields?.status) || '(nessuno)'
  conta[st] = (conta[st] || 0) + 1
  if (st === 'linea' || st === '(nessuno)') daCambiare.push(d)
}
console.log(`[stato] ${docs.length} articoli su "${PROJECT}"`)
console.log('\n  stato attuale:')
console.table(conta)
console.log(`  da portare in assortimento: ${daCambiare.length}`)
console.log('  (premium e out restano dove sono)')

if (!APPLY) {
  console.log('\n[stato] ANTEPRIMA: nessuna scrittura. Aggiungi --apply per salvare.')
  process.exit(0)
}

await commit(
  daCambiare.map((d) => ({
    update: { name: d.name, fields: { status: { stringValue: 'assortimento' } } },
    updateMask: { fieldPaths: ['status'] },
  }))
)
console.log(`\n[stato] ✓ ${daCambiare.length} articoli in assortimento su "${PROJECT}".`)
