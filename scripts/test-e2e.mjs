#!/usr/bin/env node
// =====================================================================
//  I TEST END-TO-END IN LOCALE, sugli emulatori completi (REQ-DEV-019).
//
//    npm run test:e2e [-- <argomenti di playwright>]
//
//  Uno script e non una riga in package.json per una ragione sola: le
//  Functions emulate hanno 10 secondi per farsi leggere, e su un portatile
//  carico non bastano («User code failed to load … Timeout after 10000»:
//  visto il 09/11/2026, e i test che le usano falliscono senza dire
//  perché). L'attesa si allunga con FUNCTIONS_DISCOVERY_TIMEOUT, e su
//  Windows npm non sa mettere una variabile davanti a un comando.
// =====================================================================
import { spawnSync } from 'node:child_process'

const playwright = ['npx', 'playwright', 'test', '-c', 'playwright.e2e.config.mjs', ...process.argv.slice(2)].join(' ')
const esito = spawnSync('npx', [
  '--yes', 'firebase-tools@15.26.0', 'emulators:exec',
  '--project', 'demo-tana-drink',
  '--only', 'auth,firestore,storage,functions',
  '--config', 'firebase.collaudo.json',
  JSON.stringify(playwright),
], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || '60' },
})
process.exit(esito.status ?? 1)
