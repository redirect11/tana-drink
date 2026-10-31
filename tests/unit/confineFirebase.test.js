'use strict'

// ── FIREBASE SOLO NEGLI ADATTATORI (REQ-FLOTTA-021) ───────────────────
//
// L'utente, 31/10/2026: «possiamo prevedere delle interfacce che
// implementano le logiche di firebase o altre logiche con altri db [...]
// Così possiamo riutilizzare tutto anche su cloud puro». L'app parla con
// porte nostre (src/porte/), e Firebase sta dietro, in un adattatore: è
// così che l'installazione on premise potrà avere un altro backend senza
// diventare un secondo prodotto (docs/porte-e-adattatori.md).
//
// Il passaggio si fa un pezzo alla volta, quindi oggi molti file importano
// ancora Firebase direttamente. Questo test fa due cose:
//   - NESSUN FILE NUOVO: fuori dagli adattatori, chi importa Firebase deve
//     stare nell'elenco qui sotto;
//   - L'ELENCO SI PUÒ SOLO ACCORCIARE: un file che ha smesso di importare
//     Firebase va tolto, se no il test lo segnala. Così l'elenco dice
//     sempre a che punto è il lavoro.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const RADICE = process.cwd()

// Dove Firebase sta di casa. `functions/index.js` è l'ospite Firebase
// delle Functions: collega la logica di functions/lib/ agli onCall, ai
// trigger e all'onRequest, ed è fatto apposta per conoscere Firebase.
const ADATTATORI = ['src/adattatori/', 'functions/index.js']

// Chi importa ancora Firebase direttamente. Erano 22 al 31/10/2026 (develop
// f310f64, l'inventario di docs/porte-e-adattatori.md); la porta dei dati
// ne ha tolti sei (api.js, backup.js, progressivi.js, devActions.js, e
// scritture.js e letture.js, entrati nell'adattatore). Da accorciare:
// quelli rimasti usano l'accesso, i file, le Functions e le notifiche, e
// demo/avvio.js carica i dati di prova nella cache di Firestore.
const ECCEZIONI = [
  'src/App.jsx',
  'src/components/OrderPosDetail.jsx',
  'src/demo/avvio.js',
  'src/lib/analytics.js',
  'src/lib/customerAuth.js',
  'src/lib/firebaseClient.js',
  'src/lib/logout.js',
  'src/lib/paymentsApi.js',
  'src/lib/push.js',
  'src/lib/staffApi.js',
  'src/lib/storage.js',
  'src/pages/BartenderPage.jsx',
  'src/pages/ComandaPage.jsx',
  'src/pages/MenuPage.jsx',
  'src/pages/OrderStatusPage.jsx',
  'src/pages/StaffProfilePage.jsx',
]

// `from '…'`, `import '…'`, `import('…')`, `require('…')` di firebase,
// firebase/*, @firebase/*, firebase-functions/* e firebase-admin/*.
const IMPORT_FIREBASE =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"](?:firebase(?:-functions|-admin)?|@firebase\/[\w.-]+)(?:\/[\w./-]+)?['"]/

function sorgenti(cartella) {
  const fuori = []
  for (const nome of readdirSync(join(RADICE, cartella))) {
    if (nome === 'node_modules') continue
    const rel = `${cartella}/${nome}`
    if (statSync(join(RADICE, rel)).isDirectory()) fuori.push(...sorgenti(rel))
    else if (/\.(c|m)?jsx?$/.test(nome)) fuori.push(rel)
  }
  return fuori
}

const chiImporta = [...sorgenti('src'), ...sorgenti('functions')]
  .filter((rel) => IMPORT_FIREBASE.test(readFileSync(join(RADICE, rel), 'utf8')))
  .map((rel) => relative(RADICE, join(RADICE, rel)).split(sep).join('/'))

const negliAdattatori = (rel) => ADATTATORI.some((a) => (a.endsWith('/') ? rel.startsWith(a) : rel === a))

describe('il confine di Firebase', () => {
  it('fuori dagli adattatori nessun file nuovo importa Firebase', () => {
    const nuovi = chiImporta.filter((rel) => !negliAdattatori(rel) && !ECCEZIONI.includes(rel))
    expect(nuovi, 'si passa da una porta (src/porte/) o si lavora in un adattatore').toEqual([])
  })

  it('l’elenco delle eccezioni si accorcia: chi non importa più Firebase va tolto', () => {
    const finiti = ECCEZIONI.filter((rel) => !chiImporta.includes(rel))
    expect(finiti, 'togliere questi file da ECCEZIONI').toEqual([])
  })

  it('le porte non conoscono Firebase', () => {
    expect(chiImporta.filter((rel) => rel.startsWith('src/porte/'))).toEqual([])
  })

  it('il controllo riconosce ogni modo di importare', () => {
    for (const riga of [
      "import { getDoc } from 'firebase/firestore'",
      "import 'firebase/app'",
      "const m = await import('firebase/firestore/lite')",
      "const { onCall } = require('firebase-functions/v2/https')",
      "const admin = require('firebase-admin')",
      'import { x } from "@firebase/util"',
    ]) {
      expect(IMPORT_FIREBASE.test(riga), riga).toBe(true)
    }
    for (const riga of ["import { db } from './firebaseClient.js'", "import { x } from 'firebasey'", '// firebase/firestore']) {
      expect(IMPORT_FIREBASE.test(riga), riga).toBe(false)
    }
  })
})
