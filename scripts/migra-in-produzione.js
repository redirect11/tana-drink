// =====================================================================
//  RISPECCHIA IL CATALOGO DA TEST A PRODUZIONE.
//
//    node scripts/migra-in-produzione.js            # ANTEPRIMA (non scrive)
//    node scripts/migra-in-produzione.js --apply    # scrive davvero
//
//  Copia da tana-drink-test a tana-drink, con gli STESSI identificativi:
//    inventory_items · inventory_categories · suppliers · drinks ·
//    categories · settings/bar
//
//  NON TOCCA, mai: orders, cash_sessions, payments, stock_movements,
//  staff_shifts, gruppi e utenze. Lo storico della produzione resta dov'è.
//
//  Gli articoli di magazzino presenti solo in produzione vengono ELIMINATI
//  (--orfani lascia|out|elimina, default elimina): sono l'assortimento
//  vecchio, e lasciarli significherebbe ritrovarsi due volte lo stesso
//  prodotto, uno col costo e uno senza. Prima di cancellarli si controlla
//  che nessuna ricetta li usi ancora: se qualcuna li usa, lo script SI
//  FERMA e li elenca.
//
//  Autenticazione: sessione del Firebase CLI (firebase login).
// =====================================================================
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
const getArg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const APPLY = args.includes('--apply')
const ORFANI = getArg('orfani', 'elimina') // elimina | out | lascia
const DA = getArg('da', 'tana-drink-test')
const A = getArg('a', 'tana-drink')

const COLLEZIONI = [
  'inventory_categories',
  'suppliers',
  'inventory_items',
  'categories',
  'drinks',
]

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
  console.error('[migra] Autenticazione fallita: esegui "npx firebase-tools login".')
  process.exit(1)
}
const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' }
const radice = (proj) => `projects/${proj}/databases/(default)/documents`
const url = (proj) => `https://firestore.googleapis.com/v1/${radice(proj)}`

async function listAll(proj, col) {
  const out = []
  let pageToken = ''
  do {
    const res = await (
      await fetch(`${url(proj)}/${col}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, {
        headers: auth,
      })
    ).json()
    if (res.error) throw new Error(`${proj}/${col}: ${res.error.message}`)
    out.push(...(res.documents || []))
    pageToken = res.nextPageToken || ''
  } while (pageToken)
  return out
}

async function commit(proj, writes) {
  for (let i = 0; i < writes.length; i += 200) {
    const res = await (
      await fetch(`https://firestore.googleapis.com/v1/${radice(proj)}:commit`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ writes: writes.slice(i, i + 200) }),
      })
    ).json()
    if (res.error) throw new Error(`commit: ${res.error.message}`)
  }
}

const idDi = (d) => d.name.split('/').pop()
const str = (f) => (f?.stringValue != null ? f.stringValue : null)

console.log(`[migra] ${DA}  →  ${A}${APPLY ? '' : '   (ANTEPRIMA)'}\n`)

// ── Lettura ──────────────────────────────────────────────────────────
const daTest = {}
const inProd = {}
for (const col of COLLEZIONI) {
  ;[daTest[col], inProd[col]] = await Promise.all([listAll(DA, col), listAll(A, col)])
}

// ── Articoli di magazzino presenti SOLO in produzione ─────────────────
const idsTest = new Set(daTest.inventory_items.map(idDi))
const orfani = inProd.inventory_items.filter((d) => !idsTest.has(idDi(d)))

// Nessuna ricetta (quelle NUOVE, che stanno per arrivare) deve usarli: se le
// usasse, cancellare l'articolo lascerebbe il drink senza quell'ingrediente.
const usatiDalleRicette = new Set()
for (const d of daTest.drinks) {
  for (const r of d.fields?.recipe_items?.arrayValue?.values || []) {
    const id = str(r.mapValue?.fields?.inventory_item_id)
    if (id) usatiDalleRicette.add(id)
  }
}
const orfaniInUso = orfani.filter((d) => usatiDalleRicette.has(idDi(d)))

// ── Riepilogo ────────────────────────────────────────────────────────
for (const col of COLLEZIONI) {
  const nuovi = daTest[col].filter((d) => !inProd[col].some((p) => idDi(p) === idDi(d))).length
  console.log(
    `  ${col.padEnd(22)} ${String(daTest[col].length).padStart(4)} da copiare` +
      `  (${nuovi} nuovi, ${daTest[col].length - nuovi} sovrascritti)` +
      `   [in produzione ora: ${inProd[col].length}]`
  )
}
console.log(`  ${'settings/bar'.padEnd(22)}    1 da copiare`)
console.log(`\n  articoli solo in produzione: ${orfani.length} → ${ORFANI}`)
for (const d of orfani.slice(0, 12)) console.log(`     · ${str(d.fields?.name) || idDi(d)}`)
if (orfani.length > 12) console.log(`     … e altri ${orfani.length - 12}`)

// Chi è ancora usato da una ricetta NON si tocca, qualunque cosa dica
// --orfani: cancellarlo lascerebbe quel drink senza l'ingrediente. Restano
// finché le ricette non vengono riagganciate ai nuovi articoli.
const daEliminare = orfani.filter((d) => !usatiDalleRicette.has(idDi(d)))
if (orfaniInUso.length) {
  console.log(`\n  di cui ANCORA USATI da una ricetta: ${orfaniInUso.length} → restano dove sono`)
  for (const d of orfaniInUso.slice(0, 8)) console.log(`     · ${str(d.fields?.name) || idDi(d)}`)
  if (orfaniInUso.length > 8) console.log(`     … e altri ${orfaniInUso.length - 8}`)
}
console.log(`  eliminabili senza conseguenze: ${daEliminare.length}`)

console.log('\n  NON si toccano: orders, cash_sessions, payments, stock_movements, utenze.')

if (!APPLY) {
  console.log('\n[migra] ANTEPRIMA: nessuna scrittura. Aggiungi --apply per migrare.')
  process.exit(0)
}

// ── Scrittura ────────────────────────────────────────────────────────
for (const col of COLLEZIONI) {
  const writes = daTest[col].map((d) => ({
    update: { name: `${radice(A)}/${col}/${idDi(d)}`, fields: d.fields || {} },
  }))
  await commit(A, writes)
  console.log(`[migra] ✓ ${col}: ${writes.length} documenti`)
}

// Impostazioni del locale (IVA, sconto, gruppi…): un documento solo.
const settingsTest = (await listAll(DA, 'settings')).find((d) => idDi(d) === 'bar')
if (settingsTest) {
  await commit(A, [
    { update: { name: `${radice(A)}/settings/bar`, fields: settingsTest.fields || {} } },
  ])
  console.log('[migra] ✓ settings/bar')
}

if (daEliminare.length && ORFANI !== 'lascia') {
  const writes = daEliminare.map((d) =>
    ORFANI === 'elimina'
      ? { delete: `${radice(A)}/inventory_items/${idDi(d)}` }
      : {
          update: {
            name: `${radice(A)}/inventory_items/${idDi(d)}`,
            fields: { ...(d.fields || {}), status: { stringValue: 'out' } },
          },
        }
  )
  await commit(A, writes)
  console.log(
    `[migra] ✓ articoli solo in produzione: ${writes.length} ${ORFANI === 'elimina' ? 'eliminati' : 'messi fuori assortimento'}` +
      (orfaniInUso.length ? ` (${orfaniInUso.length} lasciati: servono alle ricette)` : '')
  )
}

console.log('\n[migra] Fatto. Storico ordini e cassa di produzione: intatti.')
