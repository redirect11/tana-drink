// =====================================================================
//  Porta i COSTI AL DETTAGLIO dal foglio INV nell'inventario del gestionale,
//  così il POS può calcolare il prezzo reale di un drink dalla sua ricetta.
//
//    python scripts/estrai-costi-inventario.py         # 1. legge INV.xlsx
//    node scripts/import-costi-inventario.js           # 2. ANTEPRIMA
//    node scripts/import-costi-inventario.js --apply   # 3. scrive davvero
//
//  Opzioni: --project <id> --emulator --force --json <file>
//           --azzera    mette a 0 il costo degli articoli che NON si
//                       abbinano con certezza (zero = da rivedere a mano)
//           --giacenze  aggiorna anche la giacenza dalla colonna DEP
//           --formati   riscrive il contenuto della confezione dalla
//                       colonna `cl` del foglio (package_size)
//  Aggiorna SOLO i campi del costo (cost, vat, package_size quando manca):
//  nome, giacenze e soglie non si toccano. Senza --force lascia stare gli
//  articoli che un costo ce l'hanno già.
//  Autenticazione: sessione del Firebase CLI (firebase login).
// =====================================================================
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { normName, bestMatch } from '../src/lib/nameMatch.js'

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
// Quello che non si abbina con CERTEZZA va messo a zero, non lasciato com'è:
// un costo vecchio che sembra buono è peggio di un buco visibile, perché
// nessuno va a ricontrollarlo. Zero = "da mettere a mano".
const AZZERA = args.includes('--azzera')
// Giacenze dalla colonna DEP del foglio (deposito, in confezioni).
const GIACENZE = args.includes('--giacenze')
// FORMATI: il contenuto della confezione (colonna `cl` del foglio) sovrascrive
// quello in gestionale. Senza questo, il formato in gestionale ha la
// precedenza — e se è sbagliato resta sbagliato per sempre, portandosi dietro
// il costo al cl e quindi il margine di ogni drink che usa il prodotto.
const FORMATI = args.includes('--formati')

const { sheet, products } = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
console.log(`[costi] ${products.length} prodotti dal foglio "${sheet}"`)

// Abbinamento nomi: esatto, parole invertite, nome contenuto, refuso.
// Sotto la soglia NON si scrive nulla — meglio un articolo senza costo
// che un vino col prezzo di una bibita (vedi nameMatch.js).
const MIN = Number(getArg('min', '0.9'))
const ALIAS_PATH = getArg('alias', 'alias-costi.json')
let ALIAS = {}
try {
  ALIAS = JSON.parse(readFileSync(ALIAS_PATH, 'utf8'))
  console.log(`[costi] ${Object.keys(ALIAS).length} corrispondenze manuali da ${ALIAS_PATH}`)
} catch {
  /* file opzionale */
}

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
for (const p of products) if (p.cost > 0) listino.set(normName(p.name), p)
const nomiListino = [...listino.values()].map((p) => p.name)

const daAggiornare = []
const giaValorizzati = []
const daConfermare = [] // somiglianti ma sotto soglia: si mostrano, non si scrivono
const senzaCorrispondenza = []
const daAzzerare = []
const usati = new Set()

for (const d of docs) {
  const f = d.fields || {}
  const nome = strOf(f.name)
  const costoAttuale = numOf(f.cost)
  if (costoAttuale > 0 && !FORCE) {
    giaValorizzati.push(nome)
    continue
  }

  // 1) corrispondenza manuale, 2) nome identico, 3) abbinamento fine.
  let p = null
  let come = null
  const alias = ALIAS[nome] || ALIAS[normName(nome)]
  if (alias) {
    p = listino.get(normName(alias))
    come = 'alias'
  }
  if (!p) {
    p = listino.get(normName(nome))
    if (p) come = 'esatto'
  }
  if (!p) {
    const m = bestMatch(nome, nomiListino)
    if (m && m.score >= MIN && !m.ambiguous) {
      p = listino.get(normName(m.value))
      come = `${m.reason} ${m.score}`
    } else if (m && m.score >= 0.72) {
      daConfermare.push({ nome, candidato: m.value, score: m.score, ambiguo: m.ambiguous })
      senzaCorrispondenza.push(nome)
      if (costoAttuale > 0) daAzzerare.push({ doc: d, nome, costoAttuale })
      continue
    }
  }
  if (!p) {
    senzaCorrispondenza.push(nome)
    if (costoAttuale > 0) daAzzerare.push({ doc: d, nome, costoAttuale })
    continue
  }

  usati.add(normName(p.name))
  const unit = strOf(f.unit) || 'pz'
  const packAttuale = numOf(f.package_size)
  // Il formato in gestionale ha la precedenza: può essere stato corretto.
  // Col flag --formati comanda il FOGLIO; altrimenti vince quello che c'è
  // già in gestionale (può essere stato corretto a mano).
  const dalFoglio = unit === 'ml' ? p.package_size_ml : null
  const pack = FORMATI && dalFoglio > 0 ? dalFoglio : packAttuale > 0 ? packAttuale : dalFoglio
  daAggiornare.push({ doc: d, nome, p, unit, pack, costoAttuale, come })
}

const nonUsati = [...listino.values()].filter((p) => !usati.has(normName(p.name)))

console.log(`\n  da aggiornare : ${daAggiornare.length}`)
console.log(`  già valorizzati: ${giaValorizzati.length}${FORCE ? '' : ' (usa --force per sovrascrivere)'}`)
console.log(`  senza costo nel listino: ${senzaCorrispondenza.length}`)
console.log(`  nel listino ma non in inventario: ${nonUsati.length}`)

// Con --force si riscrivono costi che c'erano già: prima di farlo si deve
// poter vedere COSA cambia. Un listino nuovo può contenere un errore di
// battitura, e un costo sbagliato sposta i margini di tutti i drink che
// usano quell'ingrediente.
const variazione = (x) => {
  const vecchio = Number(x.costoAttuale) || 0
  const nuovo = Number(x.p.cost) || 0
  if (!(vecchio > 0)) return null
  return { vecchio, nuovo, pct: ((nuovo - vecchio) / vecchio) * 100 }
}
const conStorico = daAggiornare.map((x) => ({ x, v: variazione(x) })).filter((r) => r.v)
const invariati = conStorico.filter((r) => Math.abs(r.v.pct) < 0.5).length
if (conStorico.length) {
  console.log(`
  di cui già valorizzati e ora RISCRITTI: ${conStorico.length}`)
  console.log(`   invariati (meno dello 0,5%): ${invariati}`)
  const grossi = conStorico
    .filter((r) => Math.abs(r.v.pct) >= 0.5)
    .sort((a, b) => Math.abs(b.v.pct) - Math.abs(a.v.pct))
  console.log(`   cambiano: ${grossi.length} — i venti scostamenti maggiori:`)
  for (const { x, v } of grossi.slice(0, 20)) {
    const segno = v.nuovo > v.vecchio ? '+' : ''
    console.log(
      `   ~ ${x.nome.padEnd(28)} ${v.vecchio.toFixed(2)} → ${v.nuovo.toFixed(2)} €` +
        ` (${segno}${v.pct.toFixed(0)}%)`
    )
  }
}

const nuoviCosti = daAggiornare.filter((x) => !(Number(x.costoAttuale) > 0))
if (nuoviCosti.length) console.log(`
  articoli che un costo NON ce l'avevano: ${nuoviCosti.length}`)
for (const x of nuoviCosti.slice(0, 15)) {
  const perCl = x.pack > 0 ? (x.p.cost * (1 + x.p.vat / 100)) / (x.pack / 10) : null
  console.log(
    `   + ${x.nome.padEnd(28)} ${String(x.p.cost).padStart(8)} € /conf` +
      (perCl ? ` · ${perCl.toFixed(4)} €/cl` : ' · (a pezzo)') +
      (x.come && x.come !== 'esatto' ? `  [${x.come} -> ${x.p.name}]` : '')
  )
}
if (nuoviCosti.length > 15) console.log(`   … e altri ${nuoviCosti.length - 15}`)

if (daConfermare.length) {
  console.log(`
  DA CONFERMARE (somiglianti ma sotto la soglia ${MIN}: NON vengono scritti)`)
  for (const c of daConfermare.slice(0, 30)) {
    console.log(`   ? ${c.nome.padEnd(26)} -> ${String(c.candidato).padEnd(26)} ${c.score}${c.ambiguo ? ' (ambiguo)' : ''}`)
  }
  if (daConfermare.length > 30) console.log(`   ... e altri ${daConfermare.length - 30}`)
  console.log(`   Per accettarne uno: mettilo in ${ALIAS_PATH} come {"NOME GESTIONALE": "NOME LISTINO"}`)
}

if (FORMATI) {
  const cambiati = daAggiornare.filter((x) => {
    const inDoc = numOf(x.doc.fields?.package_size)
    return x.pack > 0 && inDoc > 0 && Math.round(x.pack) !== Math.round(inDoc)
  })
  console.log(`\n  FORMATI riscritti dalla colonna cl: ${cambiati.length}`)
  for (const x of cambiati.slice(0, 25)) {
    const inDoc = numOf(x.doc.fields?.package_size)
    console.log(`   ~ ${x.nome.padEnd(28)} ${inDoc} → ${Math.round(x.pack)} ml`)
  }
  if (cambiati.length > 25) console.log(`   … e altri ${cambiati.length - 25}`)
}

if (AZZERA && daAzzerare.length) {
  console.log(`\n  DA AZZERARE: ${daAzzerare.length} articoli senza corrispondenza certa`)
  console.log('  che oggi hanno un costo. Va a zero, cosi si vedono e si mettono a mano:')
  for (const z of daAzzerare.slice(0, 25)) {
    console.log(`   0 ${z.nome.padEnd(28)} (aveva ${z.costoAttuale.toFixed(2)} €)`)
  }
  if (daAzzerare.length > 25) console.log(`   … e altri ${daAzzerare.length - 25}`)
}

if (GIACENZE) {
  const conDep = daAggiornare.filter((x) => x.p.dep != null)
  console.log(`\n  GIACENZE dalla colonna DEP: ${conDep.length} articoli`)
  for (const x of conDep.slice(0, 12)) {
    console.log(`   = ${x.nome.padEnd(28)} ${x.p.dep} ${x.unit === 'pz' ? 'pz' : 'conf'}`)
  }
  if (conDep.length > 12) console.log(`   … e altri ${conDep.length - 12}`)
  const senzaDep = daAggiornare.filter((x) => x.p.dep == null).length
  if (senzaDep) console.log(`   (${senzaDep} senza DEP nel foglio: la giacenza resta com'è)`)
}

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
  const packInDoc = numOf(x.doc.fields?.package_size)
  if (x.pack > 0 && (FORMATI ? Math.round(x.pack) !== Math.round(packInDoc) : !(packInDoc > 0))) {
    fields.package_size = { integerValue: String(Math.round(x.pack)) }
    paths.push('package_size')
  }
  // GIACENZA: nel foglio DEP è in CONFEZIONI (0,8 = 8/10 di bottiglia),
  // mentre in gestionale `stock` è in unità base (ml per i liquidi, pezzi
  // per i pezzi): si moltiplica per il formato.
  if (GIACENZE && x.p.dep != null) {
    const base = x.unit === 'pz' ? x.p.dep : x.pack > 0 ? x.p.dep * x.pack : null
    if (base != null) {
      fields.stock = { doubleValue: Math.round(base * 1000) / 1000 }
      paths.push('stock')
    }
  }
  return { update: { name: x.doc.name, fields }, updateMask: { fieldPaths: paths } }
})

// Senza corrispondenza certa il costo va a ZERO: un costo vecchio che sembra
// buono e' peggio di un buco visibile, perche' nessuno va a ricontrollarlo.
if (AZZERA) {
  for (const z of daAzzerare) {
    writes.push({
      update: { name: z.doc.name, fields: { cost: { doubleValue: 0 } } },
      updateMask: { fieldPaths: ['cost'] },
    })
  }
}

await commit(writes)
console.log(`\n[costi] ✓ aggiornati ${writes.length} articoli su "${EMULATOR ? 'emulatore' : PROJECT}".`)
