#!/usr/bin/env node
// =====================================================================
//  I REQUISITI, LETTI E RACCONTATI.
//
//    node scripts/requisiti.mjs                 # riepilogo a schermo
//    node scripts/requisiti.mjs --documento     # scrive docs/requisiti.md
//
//  requirements/requirements.yaml è l'elenco; i test dicono quali di
//  quei requisiti sono davvero dimostrati. Da qui si vede a colpo
//  d'occhio in quale dei tre stati si trova ciascuno:
//
//    ✅ fatto e coperto     implementato, con test che lo dimostrano
//    ⚠️  fatto ma scoperto   implementato, ma nessun test lo verifica
//    ⬜ da fare             non implementato (e quindi nemmeno testato)
//
//  Il secondo gruppo è quello che conta: è la roba che "funziona" finché
//  qualcuno non la rompe senza accorgersene.
// =====================================================================
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { caricaRequisiti } from './lib-requisiti.mjs'

const DOCUMENTO = process.argv.includes('--documento')
const requisiti = caricaRequisiti()

// Stato di copertura di un requisito.
export function copertura(r) {
  if (r.status === 'deprecated') return 'deprecato'
  if (r.status === 'todo') return 'da-fare'
  if (r.status === 'partial') return 'parziale'
  return r.test_cases.length > 0 ? 'coperto' : 'scoperto'
}

const SEGNO = {
  coperto: '✅',
  scoperto: '⚠️ ',
  parziale: '🟡',
  'da-fare': '⬜',
  deprecato: '🗑',
}
const NOME = {
  coperto: 'fatto e coperto dai test',
  scoperto: 'fatto ma nessun test lo verifica',
  parziale: 'fatto a metà',
  'da-fare': 'da fare',
  deprecato: 'non più valido',
}

// Area di appartenenza dal prefisso dell'id (REQ-POS-001 → POS).
const gruppo = (r) => (r.id.split('-')[1] || 'ALTRO').toUpperCase()
const TITOLI = {
  ORD: 'Ordini e comande',
  POS: 'Cassa e POS',
  PAG: 'Pagamenti',
  CASSA: 'Cassa di serata e statistiche',
  MAG: 'Magazzino',
  MENU: 'Menù e catalogo',
  GRP: 'Gruppi di conti',
  STAFF: 'Persone: ruoli, utenze, ore',
  CLI: 'Vista cliente',
  STAMPA: 'Stampa',
  NOTIF: 'Notifiche',
  OFFLINE: 'Si lavora anche senza rete',
  DATI: 'Dati e ambienti',
  SIC: 'Sicurezza',
  UI: 'Interfaccia',
  AI: 'Intelligenza artificiale',
  DEV: 'Come si lavora al progetto',
  SUMUP: 'Integrazione SumUp',
}

const conteggi = {}
for (const r of requisiti) {
  const c = copertura(r)
  conteggi[c] = (conteggi[c] || 0) + 1
}

if (!DOCUMENTO) {
  console.log(`\n[requisiti] ${requisiti.length} in totale\n`)
  for (const [k, n] of Object.entries(conteggi).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${SEGNO[k]} ${String(n).padStart(3)}  ${NOME[k]}`)
  }
  const scoperti = requisiti.filter((r) => copertura(r) === 'scoperto')
  if (scoperti.length) {
    console.log('\n  Fatti ma senza test — è quello che si rompe in silenzio:')
    for (const r of scoperti) console.log(`   · ${r.id.padEnd(20)} ${r.title}`)
  }
  const daFare = requisiti.filter((r) => copertura(r) === 'da-fare')
  if (daFare.length) {
    console.log('\n  Da fare:')
    for (const r of daFare) console.log(`   · ${r.id.padEnd(20)} ${r.title}`)
  }
  console.log('\n  --documento per scrivere docs/requisiti.md\n')
  process.exit(0)
}

// ── Il documento ─────────────────────────────────────────────────────
const righe = []
righe.push('# Cosa fa Tana Drink')
righe.push('')
righe.push('> Generato da `requirements/requirements.yaml` con')
righe.push('> `node scripts/requisiti.mjs --documento`. Non si modifica a mano:')
righe.push('> si modifica il file dei requisiti.')
righe.push('')
righe.push(`Alla data di generazione: **${requisiti.length} requisiti**.`)
righe.push('')
righe.push('| | Quanti | Cosa vuol dire |')
righe.push('|---|---|---|')
for (const k of ['coperto', 'scoperto', 'parziale', 'da-fare', 'deprecato']) {
  if (!conteggi[k]) continue
  righe.push(`| ${SEGNO[k]} | ${conteggi[k]} | ${NOME[k]} |`)
}
righe.push('')
righe.push('Un requisito può essere dimostrato da più test; un test appartiene a')
righe.push('un requisito. Il legame è verificato da `tests/unit/requisiti.test.js`:')
righe.push('se qualcuno aggiunge un test senza requisito, la suite fallisce.')
righe.push('')

const aree = [...new Set(requisiti.map(gruppo))]
for (const area of aree) {
  righe.push(`## ${TITOLI[area] ?? area}`)
  righe.push('')
  for (const r of requisiti.filter((x) => gruppo(x) === area)) {
    const c = copertura(r)
    righe.push(`### ${SEGNO[c]} ${r.id} — ${r.title}`)
    righe.push('')
    righe.push(r.description)
    righe.push('')
    righe.push(`*Dove*: \`${r.area}\``)
    righe.push('')
    if (r.test_cases.length) {
      righe.push(`*Lo dimostrano*: ${r.test_cases.map((t) => `\`${t}\``).join(', ')}`)
    } else {
      righe.push('*Nessun test lo verifica.*')
    }
    righe.push('')
  }
}

const file = 'docs/requisiti.md'
if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true })
writeFileSync(file, righe.join('\n'))
console.log(`[requisiti] scritto ${file} — ${requisiti.length} requisiti`)
