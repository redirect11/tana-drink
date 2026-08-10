// =====================================================================
//  BIBITE e BIRRE si contano a PEZZO, non a millilitri.
//
//    node scripts/bibite-a-pezzo.js                  # ANTEPRIMA
//    node scripts/bibite-a-pezzo.js --apply          # scrive
//    node scripts/bibite-a-pezzo.js --apply --ricette   # anche le ricette
//    node scripts/bibite-a-pezzo.js --project tana-drink --apply
//
//  Una bottiglia di gin la si consuma a cl: si apre e si versa. Una Ceres o
//  una Coca no: o c'è o non c'è. Contarle in millilitri costringe a leggere
//  "9240 ml" per dire "28 bottiglie", e al banco non serve a nessuno.
//
//  Cosa cambia: `unit` diventa 'pz' e la GIACENZA passa da millilitri a
//  pezzi (stock ÷ contenuto). Il contenuto della singola bottiglia resta in
//  `package_size`, che è l'informazione da cui si legge "33 cl a pezzo".
//
//  Restano fuori i FUSTI (BIRRE FUS): da un fusto si spilla, quindi il
//  volume è la misura giusta.
//
//  L'elenco di cosa è bibita e cosa è birra viene dalla colonna TIPO del
//  foglio (costi-inventario.json), non da un elenco scritto a mano.
//
//  Default: progetto tana-drink-test (la produzione va indicata a mano).
// =====================================================================
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { normName, bestMatch } from '../src/lib/nameMatch.js'

const args = process.argv.slice(2)
const getArg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const PROJECT = getArg('project', 'tana-drink-test')
const JSON_PATH = getArg('json', 'costi-inventario.json')
const APPLY = args.includes('--apply')
// Riscrive anche le righe di ricetta che usano questi prodotti a volume:
// senza, quelle righe resterebbero senza costo (e il drink senza margine).
const RICETTE = args.includes('--ricette')
// TIPO del foglio da portare a pezzo. I fusti (BIRRE FUS) NON ci sono.
const TIPI = (getArg('tipi', 'BIBITE,BIRRE') || '').split(',').map((t) => t.trim().toUpperCase())

const { products } = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
const aPezzo = new Map()
for (const p of products) {
  if (TIPI.includes(String(p.tipo || '').toUpperCase())) aPezzo.set(normName(p.name), p)
}
const nomi = [...aPezzo.values()].map((p) => p.name)
console.log(`[pezzo] ${aPezzo.size} prodotti nel foglio con TIPO ${TIPI.join(' o ')}`)

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
const giaPezzo = []
// Articoli già a pezzo che non dicono di che famiglia è il contenuto.
const senzaContentUnit = []
for (const d of docs) {
  const f = d.fields || {}
  const nome = strOf(f.name) || ''
  let p = aPezzo.get(normName(nome))
  if (!p) {
    const m = bestMatch(nome, nomi)
    if (m && m.score >= 0.9 && !m.ambiguous) p = aPezzo.get(normName(m.value))
  }
  if (!p) continue
  const unit = String(strOf(f.unit) || 'pz').toLowerCase()
  if (unit === 'pz') {
    giaPezzo.push(nome)
    if (!strOf(f.content_unit) && (numOf(f.package_size) || 0) > 0) {
      senzaContentUnit.push({ doc: d, nome, pack: numOf(f.package_size) })
    }
    continue
  }
  const pack = numOf(f.package_size) || 0
  const stock = numOf(f.stock) || 0
  daCambiare.push({
    doc: d,
    nome,
    unit,
    pack,
    stock,
    // Giacenza in pezzi: quante bottiglie stanno in quei millilitri.
    pezzi: pack > 0 ? Math.round((stock / pack) * 100) / 100 : stock,
  })
}

console.log(`\n  già a pezzo: ${giaPezzo.length}`)
if (senzaContentUnit.length) {
  console.log(`  di cui SENZA l'unità del contenuto (niente costo al cl): ${senzaContentUnit.length}`)
}
console.log(`  da portare a pezzo: ${daCambiare.length}`)
for (const x of daCambiare.slice(0, 30)) {
  console.log(
    `   ~ ${x.nome.padEnd(26)} ${x.unit} → pz · contenuto ${x.pack} ml (${x.pack / 10} cl)` +
      ` · giacenza ${x.stock} → ${x.pezzi} pz`
  )
}
if (daCambiare.length > 30) console.log(`   … e altri ${daCambiare.length - 30}`)

// Un ingrediente contato a pezzo non ha più un costo al cl: le ricette che lo
// usano a volume resterebbero senza valore. Meglio saperlo prima.
const drinks = await listAll('drinks')
const idsCambiati = new Set(daCambiare.map((x) => x.doc.name.split('/').pop()))
const packPerId = new Map(daCambiare.map((x) => [x.doc.name.split('/').pop(), x.pack]))
const ricetteAVolume = []
const ricetteDaRiscrivere = []
const FATTORE = { l: 1000, cl: 10, ml: 1 }
for (const d of drinks) {
  const righe = d.fields?.recipe_items?.arrayValue?.values || []
  let tocca = false
  const nuove = righe.map((r) => {
    const rf = r.mapValue?.fields || {}
    const id = strOf(rf.inventory_item_id)
    const u = String(strOf(rf.unit) || '').toLowerCase()
    if (!id || !idsCambiati.has(id) || !u || u === 'pz') return r
    const qty = numOf(rf.qty) || 0
    const pack = packPerId.get(id) || 0
    const ml = qty * (FATTORE[u] || 1)
    // Quanti PEZZI sono quei millilitri: almeno uno, arrotondato.
    const pezzi = pack > 0 ? Math.max(1, Math.round(ml / pack)) : 1
    ricetteAVolume.push(
      `${strOf(d.fields?.name) || '?'} → ${strOf(rf.name) || id} (${qty} ${u} = ${pezzi} pz)`
    )
    tocca = true
    return {
      mapValue: {
        fields: { ...rf, qty: { doubleValue: pezzi }, unit: { stringValue: 'pz' } },
      },
    }
  })
  if (tocca) ricetteDaRiscrivere.push({ name: d.name, righe: nuove })
}
if (ricetteAVolume.length) {
  console.log(`\n  ATTENZIONE: ${ricetteAVolume.length} righe di ricetta usano questi prodotti A VOLUME.`)
  console.log('  Contati a pezzo non avranno più un costo al cl: vanno riscritte a pz.')
  for (const r of ricetteAVolume.slice(0, 20)) console.log(`   ! ${r}`)
  if (ricetteAVolume.length > 20) console.log(`   … e altre ${ricetteAVolume.length - 20}`)
} else {
  console.log('\n  Nessuna ricetta usa questi prodotti a volume: si può convertire senza perdere costi.')
}

if (!APPLY) {
  console.log('\n[pezzo] ANTEPRIMA: nessuna scrittura. Aggiungi --apply per salvare.')
  process.exit(0)
}

if (RICETTE && ricetteDaRiscrivere.length) {
  await commit(
    ricetteDaRiscrivere.map((d) => ({
      update: { name: d.name, fields: { recipe_items: { arrayValue: { values: d.righe } } } },
      updateMask: { fieldPaths: ['recipe_items'] },
    }))
  )
  console.log(`[pezzo] ✓ riscritte ${ricetteDaRiscrivere.length} ricette a pezzo.`)
} else if (ricetteDaRiscrivere.length) {
  console.log('[pezzo] ! ricette a volume NON toccate: rilancia con --ricette.')
}

const writes = daCambiare.map((x) => ({
  update: {
    name: x.doc.name,
    fields: {
      unit: { stringValue: 'pz' },
      display_unit: { stringValue: 'pz' },
      stock: { doubleValue: x.pezzi },
      // Il contenuto resta in package_size: `content_unit` dice che è un
      // volume, ed è quello che permette di calcolare il costo al cl di una
      // bottiglia che ormai si conta a pezzi.
      content_unit: { stringValue: 'ml' },
    },
  },
  updateMask: { fieldPaths: ['unit', 'display_unit', 'stock', 'content_unit'] },
}))
// Chi era già a pezzo ma non diceva che il contenuto è un volume: senza
// quel campo il costo al cl non esiste.
for (const x of senzaContentUnit) {
  writes.push({
    update: { name: x.doc.name, fields: { content_unit: { stringValue: 'ml' } } },
    updateMask: { fieldPaths: ['content_unit'] },
  })
}
await commit(writes)
console.log(
  `\n[pezzo] ✓ portati a pezzo ${daCambiare.length} articoli` +
    (senzaContentUnit.length ? `, completati ${senzaContentUnit.length}` : '') +
    ` su "${PROJECT}".`
)
