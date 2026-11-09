#!/usr/bin/env node
// =====================================================================
//  I CASI D'USO, letti e raccontati (REQ-DEV-019).
//
//    node scripts/casi-uso.mjs              # riepilogo e controlli
//    node scripts/casi-uso.mjs --documento  # scrive docs/specifica-prodotto.md
//
//  Il registro è requirements/casi-uso.yaml; il come e il perché stanno in
//  scripts/lib-casi-uso.mjs e in docs/modello-a-v.md.
// =====================================================================
import { writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { caricaRequisiti } from './lib-requisiti.mjs'
import { caricaBisogni } from './lib-modello-v.mjs'
import { caricaCasiUso, controllaCasiUso, requisitiFuoriDaiCasi, costruisciSpecificaProdotto } from './lib-casi-uso.mjs'

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..')
const casi = caricaCasiUso()
const requisiti = caricaRequisiti()
const bisogni = caricaBisogni()

const problemi = controllaCasiUso(casi, { requisiti, bisogni, esiste: (t) => existsSync(join(RADICE, t)) })
if (problemi.length) {
  console.error(`\n[casi d'uso] ${problemi.length} problemi:`)
  for (const p of problemi) console.error(`  · ${p}`)
  process.exit(1)
}

if (process.argv.includes('--documento')) {
  const file = 'docs/specifica-prodotto.md'
  writeFileSync(join(RADICE, file), costruisciSpecificaProdotto(casi, { requisiti, bisogni }))
  console.log(`[casi d'uso] scritto ${file} — ${casi.length} casi d'uso`)
  process.exit(0)
}

const provati = casi.filter((c) => c.test_cases.length > 0)
const fuori = requisitiFuoriDaiCasi(casi, requisiti)
console.log(`\n[casi d'uso] ${casi.length}, ${provati.length} con il test end-to-end`)
const perModo = {}
for (const c of casi) perModo[c.si_prova] = (perModo[c.si_prova] || 0) + 1
for (const [m, n] of Object.entries(perModo)) console.log(`  ${String(n).padStart(3)}  si provano ${m}`)
console.log(`\n  ${fuori.length} requisiti fatti fuori da ogni caso d'uso`)
console.log('\n  --documento per scrivere docs/specifica-prodotto.md\n')
