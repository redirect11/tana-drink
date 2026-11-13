#!/usr/bin/env node
// =====================================================================
//  L'AMBIENTE E2E, DA RIGA DI COMANDO (REQ-DEV-019).
//
//    node scripts/ambiente-e2e.mjs --smonta --project drinkpos-prova-e2e
//
//  Lo usa .github/workflows/e2e.yml alla fine di ogni giro, anche quando
//  i test falliscono: dati e utenze del progetto di prova si cancellano.
//  La semina invece la fanno i test, prima di ognuno (tests/sistema/
//  semina.mjs). Le regole e le guardie stanno in scripts/lib-ambiente-e2e.mjs.
// =====================================================================
import { svuotaE2e } from './lib-ambiente-e2e.mjs'

const arg = (nome) => {
  const i = process.argv.indexOf(nome)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const progetto = arg('--project') || process.env.E2E_PROGETTO

if (!process.argv.includes('--smonta')) {
  console.error('Uso: node scripts/ambiente-e2e.mjs --smonta --project drinkpos-prova-…')
  process.exit(2)
}
await svuotaE2e(progetto)
console.log(`[e2e] ${progetto}: dati e utenze cancellati`)
