'use strict'

// I RUOLI SI CONFRONTANO IN UN POSTO SOLO.
//
// Aggiungendo "admin" è successo esattamente quello che doveva evitare
// src/lib/ruoli.js: erano rimasti indietro dei `role === 'bartender'`, e
// l'admin che apriva un ordine si vedeva la schermata del cliente invece
// del POS. Nessun lint può accorgersene: sono confronti validissimi.
//
// Questo test fa da guardia: chi scrive un confronto diretto su un ruolo
// fuori da ruoli.js lo scopre subito, non in cassa il sabato sera.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  aggiunteInComandaNuova,
  isAdmin,
  isBanco,
  isGestore,
  isPersonale,
  normalizzaRuolo,
  puoGestireComande,
  puoSegnare,
  RUOLI,
} from '../../src/lib/ruoli.js'

describe('chi può cosa', () => {
  it("l'admin fa tutto quello che fa il bartender", () => {
    for (const r of ['admin', 'bartender']) {
      expect(isGestore(r)).toBe(true)
      expect(isPersonale(r)).toBe(true)
    }
    expect(isAdmin('admin')).toBe(true)
    expect(isAdmin('bartender')).toBe(false)
  })

  it('il BANCO è il bartender, e l’admin non lo è', () => {
    // Possono le stesse cose, ma non guardano le stesse: le corsie della
    // coda mostrano le COMANDE a chi prepara e i CONTI a chi guarda come
    // sta andando la serata.
    expect(isBanco('bartender')).toBe(true)
    for (const r of ['admin', 'staff', 'cliente', null, undefined]) {
      expect(isBanco(r)).toBe(false)
    }
  })

  it('lo staff è personale ma non gestisce', () => {
    expect(isPersonale('staff')).toBe(true)
    expect(isGestore('staff')).toBe(false)
  })

  it('il cliente (e chi non ha ruolo) non è nessuno dei due', () => {
    for (const r of ['cliente', null, undefined, '', 'padrone']) {
      expect(isPersonale(r)).toBe(false)
      expect(isGestore(r)).toBe(false)
      expect(isAdmin(r)).toBe(false)
      expect(normalizzaRuolo(r)).toBe('cliente')
    }
  })

  it('ogni ruolo dichiarato è riconosciuto', () => {
    for (const r of RUOLI) expect(normalizzaRuolo(r)).toBe(r)
  })
})

// LA SALA SERVE, NON PREPARA. Vede a che punto sono le comande — le serve
// per sapere cosa portare — ma il solo passo che segna è «servito», perché
// è lei a portare il drink al tavolo.
describe('la sala serve, non prepara', () => {
  it('l’unico passo della sala è «servito»', () => {
    expect(puoSegnare('staff', 'ritirato')).toBe(true)
    for (const passo of ['in_preparazione', 'pronto', 'ricevuto', 'pagato']) {
      expect(puoSegnare('staff', passo)).toBe(false)
    }
  })

  it('al banco non si toglie niente', () => {
    for (const r of ['admin', 'bartender']) {
      for (const passo of ['in_preparazione', 'pronto', 'ritirato']) {
        expect(puoSegnare(r, passo)).toBe(true)
      }
      expect(puoGestireComande(r)).toBe(true)
    }
  })

  // IL METRO È AL CONTRARIO — «non è la sala» — apposta: queste funzioni
  // spengono dei tasti mentre il ruolo sta ancora tornando dal server, e
  // spegnerli per un istante a chi sta al banco vuol dire premere a vuoto
  // proprio nell'attimo in cui si apre un conto.
  it('col ruolo non ancora noto la schermata resta com’è', () => {
    for (const r of [null, undefined]) {
      expect(puoSegnare(r, 'pronto')).toBe(true)
      expect(puoGestireComande(r)).toBe(true)
      expect(aggiunteInComandaNuova(r)).toBe(false)
    }
  })

  it('tornare indietro, dividere e annullare non sono della sala', () => {
    expect(puoGestireComande('staff')).toBe(false)
  })

  it('quello che la sala aggiunge fa una comanda NUOVA', () => {
    expect(aggiunteInComandaNuova('staff')).toBe(true)
    for (const r of ['admin', 'bartender']) expect(aggiunteInComandaNuova(r)).toBe(false)
  })
})

// ── La guardia ───────────────────────────────────────────────────────
const RADICI = ['src', 'functions/lib']
// Confronti diretti su un ruolo: `role === 'bartender'`, `x !== 'staff'`…
const CONFRONTO = /([A-Za-z_$][\w$.?[\]]*)\s*[=!]==\s*['"](admin|bartender|staff)['"]/g
// Stesse parole, ma non sono ruoli: il nome di una scheda, chi ha annullato
// un ordine, il tipo di una notifica.
const OMONIMI = ['tab', 'tabEffettivo', 'sub', 'cancelled_by', 'cancel_phrase', 'kind', 'by', 'phrase']
// Dove i confronti CI VOGLIONO: è il modulo che li definisce, e i due
// elenchi lato Functions (non possono importare i moduli del client).
const AMMESSI = ['src/lib/ruoli.js', 'functions/lib/push-core.js', 'functions/lib/staff-service.js', 'functions/lib/payment-service.js']

function sorgenti(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) sorgenti(p, out)
    else if (/\.(js|jsx)$/.test(nome)) out.push(p.replace(/\\/g, '/'))
  }
  return out
}

describe('nessun confronto sui ruoli sparso per il codice', () => {
  it('si passa sempre da src/lib/ruoli.js', () => {
    const colpevoli = []
    for (const radice of RADICI) {
      for (const file of sorgenti(radice)) {
        if (AMMESSI.includes(file)) continue
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((riga, i) => {
            // I commenti parlano di ruoli di continuo: guardiamo il codice.
            const codice = riga.replace(/\/\/.*$/, '')
            for (const [, variabile] of codice.matchAll(CONFRONTO)) {
              const nome = variabile.split(/[.?[]/).filter(Boolean).pop()
              if (OMONIMI.includes(nome)) continue
              colpevoli.push(`${file}:${i + 1} → ${riga.trim()}`)
            }
          })
      }
    }
    expect(colpevoli, `Usa isAdmin/isGestore/isPersonale da src/lib/ruoli.js:\n${colpevoli.join('\n')}`)
      .toEqual([])
  })
})
