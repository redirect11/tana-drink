'use strict'

// ── I TEMI DELLE ICONE DEL GESTIONALE (REQ-UI-031) ───────────────────────
//
// Flavio, 07/11/2026: le icone del gestionale vanno «snellite» e fatte a
// silhouette, monocrome; le emoji colorate «sono le emoticon di WhatsApp».
// Decisioni dell'utente: temi delle icone, «Silhouette» (Lucide) di
// partenza, «Emoji» per chi le vuole, solo nel gestionale.
//
// Qui il vocabolario (i nomi, e per ognuno un'emoji e un disegno), la
// lettura del tema, e il CRICCHETTO: le emoji sparse nelle schermate del
// gestionale possono solo calare, una schermata alla volta, finché non
// passano tutte da <Icona>.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import * as Lucide from 'lucide-react'
import { VOCABOLARIO, nomeIcona, temaIconeDi, temiIconeDi, TEMI_ICONE, GRUPPI_ICONE, TUTTE_EMOJI } from '../../src/lib/icone.js'
import { NAV_GESTIONALE, NAV_SALA, titoloPagina } from '../../src/lib/sezioni.js'
import { MODULI_PREMIUM } from '../../src/lib/licenza.js'

describe('il vocabolario', () => {
  it('ogni nome ha un’emoji e un disegno che Lucide ha davvero', () => {
    for (const [nome, v] of Object.entries(VOCABOLARIO)) {
      expect(v.emoji, nome).toBeTruthy()
      expect(typeof Lucide[v.disegno], `${nome}: ${v.disegno}`).not.toBe('undefined')
    }
  })

  it('ogni disegno è importato da Icona.jsx, uno per uno', () => {
    const sorgente = readFileSync(join(process.cwd(), 'src/components/Icona.jsx'), 'utf8')
    const importati = sorgente.match(/import \{([\s\S]*?)\} from 'lucide-react'/)[1]
    const elenco = new Set(importati.split(/[\s,]+/).filter(Boolean))
    for (const v of Object.values(VOCABOLARIO)) expect(elenco.has(v.disegno), v.disegno).toBe(true)
    // E non tutto il pacchetto: finirebbe intero nel bundle.
    expect(sorgente).not.toMatch(/import \* as \w+ from 'lucide-react'/)
  })

  it('le emoji di prima si riconoscono, col significato più comune', () => {
    expect(nomeIcona('🗑')).toBe('elimina')
    expect(nomeIcona('🗑️')).toBe('elimina')
    expect(nomeIcona('✏️')).toBe('modifica')
    expect(nomeIcona('💶')).toBe('contanti')
    expect(nomeIcona('🧾')).toBe('coda')
    expect(nomeIcona('📟')).toBe('lettore')
  })

  it('un nome resta sé stesso, e quello che non è un’icona no', () => {
    expect(nomeIcona('cassa')).toBe('cassa')
    expect(nomeIcona('Magazzino')).toBeNull()
    expect(nomeIcona('')).toBeNull()
  })
})

// UN TEMA PER GRUPPO: l'utente, 07/11/2026, «il selettore del tema deve
// essere separato» per navigazione, tasti e stati, segnali e messaggi.
describe('il tema del locale, gruppo per gruppo', () => {
  it('i gruppi sono tre, ognuno con la sua chiave', () => {
    expect(Object.keys(GRUPPI_ICONE)).toEqual(['navigazione', 'tasti', 'segnali'])
    expect(new Set(Object.values(GRUPPI_ICONE).map((g) => g.chiave)).size).toBe(3)
  })

  it('di partenza tutti Silhouette', () => {
    expect(temiIconeDi({})).toEqual({ navigazione: 'silhouette', tasti: 'silhouette', segnali: 'silhouette' })
    expect(temaIconeDi(null)).toBe('silhouette')
  })

  it('ogni gruppo si sceglie per conto suo, e un valore sconosciuto vale quello di partenza', () => {
    expect(TEMI_ICONE).toEqual(['silhouette', 'emoji'])
    const s = { tema_icone_tasti: 'emoji', tema_icone_segnali: 'neon' }
    expect(temiIconeDi(s)).toEqual({ navigazione: 'silhouette', tasti: 'emoji', segnali: 'silhouette' })
  })

  it('chi non è dello staff le vede tutte emoji', () => {
    expect(TUTTE_EMOJI).toEqual({ navigazione: 'emoji', tasti: 'emoji', segnali: 'emoji' })
  })
})

describe('la navigazione parla il vocabolario', () => {
  it('le voci del gestionale e della sala', () => {
    for (const [id, icona] of [...NAV_GESTIONALE, ...NAV_SALA]) {
      expect(Object.hasOwn(VOCABOLARIO, icona), `${id}: ${icona}`).toBe(true)
    }
  })

  it('le pagine fuori dal gestionale, nella barra', () => {
    for (const via of ['/profilo-staff', '/ordini', '/accedi']) {
      expect(Object.hasOwn(VOCABOLARIO, titoloPagina(via).icona), via).toBe(true)
    }
  })

  it('i moduli, nelle schede del Marketplace', () => {
    for (const [id, m] of Object.entries(MODULI_PREMIUM)) {
      expect(Object.hasOwn(VOCABOLARIO, m.icona), `${id}: ${m.icona}`).toBe(true)
    }
  })
})

// ── IL CRICCHETTO ────────────────────────────────────────────────────────
//
// Le emoji ancora scritte a mano nelle schermate del gestionale. Il numero
// può solo scendere: chi ne toglie, abbassa MASSIMO nello stesso commit
// (come le soglie della coverage). Una schermata nuova con le emoji fa
// diventare rossa questa prova: le icone passano da <Icona>.
//
// Restano fuori, apposta: il vocabolario stesso; le pagine del cliente (lo
// stile del loro menù, decisione dell'utente); le stampe; le icone delle
// categorie, che sceglie il locale; i nomi delle tavolozze; i semi dello
// stile «Carte». I commenti non contano.
const MASSIMO = 283

const FUORI = new Set([
  'src/lib/icone.js',
  'src/lib/categoryColors.js',
  'src/lib/themes.js',
  'src/lib/mazzoCarte.js',
  'src/pages/MenuPage.jsx',
  'src/pages/OrderStatusPage.jsx',
  'src/pages/LandingPage.jsx',
  'src/pages/AccountPages.jsx',
  'src/pages/MyOrdersPage.jsx',
  'src/components/ClientDrawer.jsx',
  'src/components/OrderSummary.jsx',
  'src/components/PaymentPanel.jsx',
  'src/components/CaroselloSpeciali.jsx',
  'src/components/MenuCarte.jsx',
  'src/components/MenuGiornale.jsx',
  'src/components/DettaglioDrink.jsx',
])
const EMOJI = /\p{Extended_Pictographic}/gu
const SEGNI = new Set(['©', '®', '™', '↩', '↪', '↔', '↕'])

function* sorgenti(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) yield* sorgenti(p)
    else if (/\.jsx?$/.test(n)) yield p
  }
}

function emojiNelGestionale() {
  const radice = process.cwd()
  const trovate = []
  for (const p of sorgenti(join(radice, 'src'))) {
    const rel = relative(radice, p).replaceAll('\\', '/')
    if (FUORI.has(rel) || /printer|stampa|scontrino/i.test(rel) || rel.startsWith('src/demo/')) continue
    const testo = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    testo.split(/\r?\n/).forEach((riga, i) => {
      const codice = riga.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')
      for (const m of codice.matchAll(EMOJI)) if (!SEGNI.has(m[0])) trovate.push(`${rel}:${i + 1} ${m[0]}`)
    })
  }
  return trovate
}

describe('il cricchetto delle emoji nel gestionale', () => {
  it(`ne restano al massimo ${MASSIMO}, e possono solo calare`, () => {
    const trovate = emojiNelGestionale()
    expect(
      trovate.length,
      `Emoji scritte a mano nel gestionale: ${trovate.length} (massimo ${MASSIMO}). Usa <Icona nome="…"> ` +
        '(src/components/Icona.jsx) invece dell’emoji. Se ne hai tolte, abbassa MASSIMO.'
    ).toBeLessThanOrEqual(MASSIMO)
  })
})
