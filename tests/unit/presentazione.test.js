// @vitest-environment happy-dom
'use strict'

// ── L'APP SI PRESENTA ALLA REGIA (REQ-FLOTTA-026) ─────────────────────
//
// «Regia e il sito custom del bar si devono parlare dopo il deploy» (l'utente,
// 02/11/2026). L'app, partita con una versione nuova, dice alla regia chi è
// e che versione ha. Mai a tempo: una volta per versione, e di nuovo finché
// manca la licenza. Il token di chi ha fatto l'accesso parte solo verso i
// due progetti della regia.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  urlPresentazione,
  presentaSeServe,
  esitoPresentazione,
  giaPresentata,
} from '../../src/lib/presentazione.js'

const RIUSCITA = { ok: true, licenza: 'non_dalla_regia' }

beforeEach(() => {
  localStorage.clear()
})

describe('dove si chiama', () => {
  it('solo i due progetti della regia, con la regione del contratto', () => {
    expect(urlPresentazione('drink-regia')).toBe('https://europe-west1-drink-regia.cloudfunctions.net/presentazione')
    expect(urlPresentazione('drink-regia-test')).toBe(
      'https://europe-west1-drink-regia-test.cloudfunctions.net/presentazione'
    )
  })

  it('senza variabile, o con un progetto che non è della regia, nessun indirizzo', () => {
    expect(urlPresentazione(undefined)).toBeNull()
    expect(urlPresentazione('')).toBeNull()
    expect(urlPresentazione('foo-drink-regia')).toBeNull()
    expect(urlPresentazione('tana-drink')).toBeNull()
  })
})

describe('quando si chiama', () => {
  const chiama = () => vi.fn(() => Promise.resolve(RIUSCITA))
  const base = { versione: 'v1.10.4', collegato: true, progetto: 'drink-regia' }

  it('una volta per versione: la seconda apertura non chiama', async () => {
    const c = chiama()
    expect(await presentaSeServe({ ...base, chiama: c })).toEqual(RIUSCITA)
    expect(c).toHaveBeenCalledWith('https://europe-west1-drink-regia.cloudfunctions.net/presentazione', 'v1.10.4')
    expect(giaPresentata('1.10.4')).toBe(true)
    expect(await presentaSeServe({ ...base, chiama: c })).toBeNull()
    expect(c).toHaveBeenCalledTimes(1)
  })

  it('una versione nuova si presenta di nuovo', async () => {
    const c = chiama()
    await presentaSeServe({ ...base, chiama: c })
    await presentaSeServe({ ...base, versione: 'v1.10.5', chiama: c })
    expect(c).toHaveBeenCalledTimes(2)
  })

  it('se la chiamata non riesce non si segna niente: si riprova alla prossima apertura', async () => {
    const c = vi.fn(() => Promise.resolve({ ok: false, status: 0 }))
    await presentaSeServe({ ...base, chiama: c })
    await presentaSeServe({ ...base, chiama: c })
    expect(c).toHaveBeenCalledTimes(2)
    expect(giaPresentata('1.10.4')).toBe(false)
  })

  it('senza licenza si chiama anche con la versione già presentata', async () => {
    const c = chiama()
    await presentaSeServe({ ...base, chiama: c })
    await presentaSeServe({ ...base, licenzaMancante: true, chiama: c })
    expect(c).toHaveBeenCalledTimes(2)
  })

  it('non parte senza accesso, senza versione, senza variabile o con un progetto non ammesso', async () => {
    const c = chiama()
    expect(await presentaSeServe({ ...base, collegato: false, chiama: c })).toBeNull()
    expect(await presentaSeServe({ ...base, versione: '', chiama: c })).toBeNull()
    expect(await presentaSeServe({ ...base, progetto: undefined, chiama: c })).toBeNull()
    expect(await presentaSeServe({ ...base, progetto: 'altro-progetto', chiama: c })).toBeNull()
    expect(c).not.toHaveBeenCalled()
  })
})

describe('la risposta della regia', () => {
  it('un 200 dice cosa ne è della licenza; il resto non è riuscito, col testo della regia', () => {
    expect(esitoPresentazione(200, { ok: true, licenza: 'scritta' })).toEqual({ ok: true, licenza: 'scritta' })
    expect(esitoPresentazione(200, { ok: true, licenza: 'non_dalla_regia' })).toEqual({
      ok: true,
      licenza: 'non_dalla_regia',
    })
    expect(esitoPresentazione(404, { errore: 'La regia non conosce questo progetto' })).toEqual({
      ok: false,
      status: 404,
      errore: 'La regia non conosce questo progetto',
    })
    expect(esitoPresentazione(503, null)).toEqual({ ok: false, status: 503, errore: null })
  })
})

describe('il deploy', () => {
  it('compila la regia giusta: drink-regia in produzione, drink-regia-test sul test', () => {
    const yml = readFileSync('.github/workflows/deploy.yml', 'utf8')
    expect(yml).toMatch(
      /VITE_REGIA_PROGETTO: \$\{\{ inputs\.ambiente == 'production' && 'drink-regia' \|\| 'drink-regia-test' \}\}/
    )
  })
})
