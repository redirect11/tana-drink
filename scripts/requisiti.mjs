#!/usr/bin/env node
// =====================================================================
//  I REQUISITI, LETTI E RACCONTATI.
//
//    node scripts/requisiti.mjs                 # riepilogo a schermo
//    node scripts/requisiti.mjs --documento     # scrive docs/system_specifications.md
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
//
//  --documento non scrive più lo specchio del registro: scrive LA
//  SPECIFICA DI SISTEMA, e come la mette insieme sta in
//  scripts/lib-specifica.mjs — qui resta solo il giro da riga di comando.
// =====================================================================
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { caricaRequisiti, FILE_BUGS } from './lib-requisiti.mjs'
import { copertura, SEGNO, NOME, costruisciSpecifica } from './lib-specifica.mjs'

const DOCUMENTO = process.argv.includes('--documento')
const requisiti = caricaRequisiti()

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
  console.log('\n  --documento per scrivere docs/system_specifications.md\n')
  process.exit(0)
}

// I difetti sono un registro a parte, con lo stesso formato. Se il file
// non c'è il documento si scrive lo stesso, senza quel capitolo: è un
// registro, non una dipendenza.
let bug = []
try {
  bug = caricaRequisiti(FILE_BUGS)
} catch {
  bug = []
}

const file = 'docs/system_specifications.md'
if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true })
writeFileSync(file, costruisciSpecifica(requisiti, { bug }))

const quanti = (stato) => requisiti.filter((r) => copertura(r) === stato).length
console.log(
  `[requisiti] scritto ${file} — ` +
  `${quanti('coperto') + quanti('scoperto') + quanti('parziale')} comportamenti, ` +
  `${quanti('da-fare')} previsti, ${bug.filter((b) => b.status === 'todo').length} difetti aperti`
)
