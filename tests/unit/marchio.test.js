'use strict'

// IL TEST-GUARDIA ANTI-MARCHIO (REQ-VENUE-004).
//
// Il prodotto è lo stesso codice compilato per locali diversi
// (docs/flotta.md): nessuna parola della Tana deve restare scritta nel
// codice fuori dai commenti. Quello che resta sta nella WHITELIST qui
// sotto, file per file col numero di occorrenze ammesse: si può solo
// accorciare — come le soglie di coverage, è un cricchetto. A whitelist
// vuota la sbrandizzazione è dimostrata.
//
// I commenti sono liberi: la storia del progetto è della Tana e si
// racconta. Le cartelle `clienti/` e `tests/` non si guardano: la prima è
// il posto dove la Tana DEVE stare, la seconda la prova.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RADICE = process.cwd()

// Cosa si cerca. `Tana` come parola (non «tanaglia»), le chiavi tecniche
// `tana:` / `tana_` / `tana-` (localStorage, cache del service worker,
// progetti).
const MARCHIO = /Tana\b|Coniglio|latanadelconiglio|EFFEVI|\btana[:_-]/g

// QUELLO CHE RESTA, e perché (REQ-VENUE-005 per le chiavi tecniche).
const WHITELIST = {
  // Il seed di sviluppo coi drink della Tana (piano, Fase 2.4).
  'src/dev/seedData.js': 6,
  // Il tema predefinito «tana-scuro» nelle impostazioni: un alias (vedi themes.js).
  'src/lib/api.js': 2,
  // La migrazione delle chiavi vecchie (REQ-VENUE-005): deve conoscerle.
  'src/lib/migrazioneChiavi.js': 2,
  // Il tema «Tana scuro» resta come alias (piano, Fase 2.6).
  'src/lib/themes.js': 4,
}

const SCANSIONE = ['src', 'functions/index.js', 'functions/lib', 'index.html', 'public/sw.js', 'clienti/manifest.template.json']

function file(percorso, out = []) {
  const pieno = join(RADICE, percorso)
  if (statSync(pieno).isFile()) {
    out.push(percorso)
    return out
  }
  for (const nome of readdirSync(pieno)) {
    if (nome === 'node_modules') continue
    const figlio = `${percorso}/${nome}`
    const st = statSync(join(RADICE, figlio))
    if (st.isDirectory()) file(figlio, out)
    else if (/\.(js|jsx|html|json)$/.test(nome)) out.push(figlio)
  }
  return out
}

// Via i commenti: /* … */, // … (non dentro un indirizzo «https://»),
// <!-- … -->.
const senzaCommenti = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')

function occorrenze() {
  const out = {}
  for (const f of SCANSIONE.flatMap((p) => file(p))) {
    const testo = senzaCommenti(readFileSync(join(RADICE, f), 'utf8'))
    const n = (testo.match(MARCHIO) || []).length
    if (n > 0) out[relative(RADICE, join(RADICE, f)).replace(/\\/g, '/')] = n
  }
  return out
}

describe('il marchio della Tana nel codice', () => {
  const trovate = occorrenze()
  const ammesse = Object.fromEntries(Object.entries(WHITELIST).filter(([k]) => !k.includes('#')))

  it('non compare dove la whitelist non lo ammette', () => {
    const fuori = Object.entries(trovate)
      .filter(([f, n]) => n > (ammesse[f] || 0))
      .map(([f, n]) => `${f}: ${n} (ammesse ${ammesse[f] || 0})`)
    expect(fuori, 'parole della Tana nel codice, fuori dai commenti').toEqual([])
  })

  it('e la whitelist non tiene voci che non servono più: il cricchetto scende', () => {
    const larghe = Object.entries(ammesse)
      .filter(([f, n]) => (trovate[f] || 0) < n)
      .map(([f, n]) => `${f}: ammesse ${n}, trovate ${trovate[f] || 0}`)
    expect(larghe, 'abbassa questi numeri nella whitelist').toEqual([])
  })
})
