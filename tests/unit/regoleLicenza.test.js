'use strict'

// ── LE REGOLE E LA TABELLA DEI MODULI DICONO LA STESSA COSA (REQ-LIC-008)
//
// Quale collezione è di quale modulo sta scritto due volte: in
// src/lib/licenza.js (COLLEZIONI_DEI_MODULI, che usa l'app, per esempio il
// ripristino del backup) e in firestore.rules (che lo fa rispettare). Due
// copie vanno fuori passo appena qualcuno ne tocca una sola: qui si leggono
// le regole come testo e si confrontano con la tabella. Le prove di quello
// che le regole FANNO stanno in tests/regole/licenza.test.js, sull'emulatore.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { COLLEZIONI_DEI_MODULI, MODULI_PREMIUM, scritturaConsentita } from '../../src/lib/licenza.js'

const REGOLE = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')

// Il blocco di una collezione: da `match /<nome>/{` alla graffa che lo chiude.
function blocco(nome) {
  const inizio = REGOLE.indexOf(`match /${nome}/{`)
  if (inizio < 0) return null
  let livello = 0
  for (let i = REGOLE.indexOf('{', REGOLE.indexOf('}', inizio)); i < REGOLE.length; i++) {
    if (REGOLE[i] === '{') livello++
    if (REGOLE[i] === '}' && --livello === 0) return REGOLE.slice(inizio, i + 1)
  }
  return null
}
const moduliNelBlocco = (testo) => [...testo.matchAll(/modulo\('([a-z_]+)'\)/g)].map((m) => m[1]).sort()

describe('le regole e COLLEZIONI_DEI_MODULI', () => {
  it('ogni collezione della tabella chiede, nelle regole, esattamente i suoi moduli', () => {
    for (const [collezione, moduli] of Object.entries(COLLEZIONI_DEI_MODULI)) {
      const testo = blocco(collezione)
      expect(testo, `manca il blocco di ${collezione}`).toBeTruthy()
      expect(moduliNelBlocco(testo), collezione).toEqual([...moduli].sort())
    }
  })

  // Gli ordini dal telefono vogliono anche il menù digitale (REQ-LIC-015).
  it('nessun’altra collezione chiede un modulo, tranne gli ordini dal telefono', () => {
    // `databases` è il blocco che le contiene tutte.
    const tutte = [...REGOLE.matchAll(/match \/([a-z_]+)\/\{/g)].map((m) => m[1]).filter((c) => c !== 'databases')
    for (const collezione of tutte) {
      if (collezione in COLLEZIONI_DEI_MODULI) continue
      const attesi = collezione === 'orders' ? ['menu_tavoli', 'ordini_cliente'] : []
      expect(moduliNelBlocco(blocco(collezione)), collezione).toEqual(attesi)
    }
  })

  it('i moduli nominati esistono', () => {
    for (const moduli of Object.values(COLLEZIONI_DEI_MODULI)) {
      for (const id of moduli) expect(Object.hasOwn(MODULI_PREMIUM, id), id).toBe(true)
    }
  })
})

describe('scritturaConsentita', () => {
  const FREE = { licenza: { piano: 'free', moduli: {} } }
  it('una collezione di un modulo che la licenza non include no; le altre sì', () => {
    expect(scritturaConsentita(FREE, 'inventory_items')).toBe(false)
    expect(scritturaConsentita(FREE, 'orders')).toBe(true)
    expect(scritturaConsentita(FREE, 'staff_shifts')).toBe(true)
  })

  it('le fatture dei fornitori bastano col magazzino', () => {
    expect(scritturaConsentita({ licenza: { moduli: { magazzino: true } } }, 'supplier_invoices')).toBe(true)
  })

  // La licenza che non si sa ancora (prima risposta) non blocca lo scarico
  // né il ripristino: decidono le regole, che la licenza la leggono sempre.
  it('con una licenza che non si sa ancora si prova a scrivere: decidono le regole', () => {
    expect(scritturaConsentita({}, 'inventory_items')).toBe(true)
  })
})

// ── OGNI SCRITTURA CHIEDE UNA LICENZA VALIDA (REQ-LIC-009) ─────────────
// Una collezione nuova con le sue regole scritte senza licenzaValida()
// riaprirebbe le scritture a un locale fermo. Qui ogni `allow` di scrittura
// deve chiederla, tranne quelle che non si permettono a nessuno (`false`)
// e le uscite di chi se ne va, scritte qui per nome.
const USCITE = ['customers:update, delete', 'staff_tokens:delete', 'presenze:delete']

describe('le regole e la licenza valida', () => {
  it('ogni allow di scrittura chiede licenzaValida(), tranne le uscite', () => {
    const scoperte = []
    let collezione = null
    for (const m of REGOLE.matchAll(/match \/([a-z_]+)\/\{|allow ([a-z, ]+):\s*if ([\s\S]*?);/g)) {
      if (m[1]) {
        collezione = m[1]
        continue
      }
      const operazioni = m[2].split(',').map((o) => o.trim())
      if (!operazioni.some((o) => ['write', 'create', 'update', 'delete'].includes(o))) continue
      if (m[3].trim() === 'false') continue
      if (USCITE.includes(`${collezione}:${m[2].trim()}`)) continue
      if (!m[3].trimStart().startsWith('licenzaValida()')) scoperte.push(`${collezione}: allow ${m[2]}`)
    }
    expect(scoperte).toEqual([])
  })
})
