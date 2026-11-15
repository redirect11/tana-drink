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
  codiceDispositivo,
  RIPRESENTA_DOPO,
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
    expect(c).toHaveBeenCalledWith(
      'https://europe-west1-drink-regia.cloudfunctions.net/presentazione',
      'v1.10.4',
      expect.stringMatching(/^[A-Za-z0-9_-]{22}$/)
    )
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

// ── UNA VERSIONE PER DISPOSITIVO (REQ-FLOTTA-031) ─────────────────────
//
// Il 14/11/2026 la Tana di test si è presentata da due dispositivi a pochi
// decimi di secondo, uno con la 1.10.49-beta e uno con la 1.10.40-beta, e la
// regia, che teneva l'ultima, è tornata indietro di dieci versioni. Daniele,
// 15/11: «tenere una versione per dispositivo». La forma del codice è quella
// concordata con la regia (contratto, interfaccia 4).
describe('il codice del dispositivo', () => {
  it('16 byte casuali in base64url senza padding: 22 caratteri', () => {
    expect(codiceDispositivo()).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })

  it('resta lo stesso da un\'apertura all\'altra: è scritto sul dispositivo', () => {
    const primo = codiceDispositivo()
    expect(codiceDispositivo()).toBe(primo)
    expect(localStorage.getItem('drink:codice_regia')).toBe(primo)
  })

  it('un codice di forma sbagliata in memoria si sostituisce: la regia lo ignorerebbe', () => {
    localStorage.setItem('drink:codice_regia', 'mario@tana.it')
    const codice = codiceDispositivo()
    expect(codice).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(localStorage.getItem('drink:codice_regia')).toBe(codice)
  })

  // La prima stesura usava la chiave di idDispositivo (lib/dispositivo.js)
  // e la sovrascriveva: gli avvisi degli ordini e i token del personale
  // avrebbero cambiato dispositivo. E quell'id sta nel database del locale:
  // alla regia non deve arrivare.
  it('non tocca e non riusa l\'identificativo degli avvisi', async () => {
    const { idDispositivo } = await import('../../src/lib/dispositivo.js')
    const avvisi = idDispositivo()
    const codice = codiceDispositivo()
    expect(codice).not.toBe(avvisi)
    expect(localStorage.getItem('drink:dispositivo')).toBe(avvisi)
  })

  it('due dispositivi, due codici: nasce da byte casuali', async () => {
    vi.resetModules()
    const a = await import('../../src/lib/presentazione.js')
    const primo = a.codiceDispositivo()
    localStorage.clear()
    vi.resetModules()
    const b = await import('../../src/lib/presentazione.js')
    expect(b.codiceDispositivo()).not.toBe(primo)
  })
})

// La correzione chiesta dalla regia: un tablet che resta su una versione e
// si usa ogni giorno non si ripresentava mai, e dopo 30 giorni la regia lo
// avrebbe dimenticato mentre chiamava ancora le interfacce vecchie.
describe('una volta al giorno anche a versione invariata', () => {
  const base = { versione: 'v1.10.40-beta', collegato: true, progetto: 'drink-regia-test' }
  const chiama = () => vi.fn(() => Promise.resolve(RIUSCITA))
  const ORA = Date.UTC(2026, 10, 15, 20, 0)

  it('nelle 24 ore non si ripresenta; dopo sì, con lo stesso codice', async () => {
    const c = chiama()
    await presentaSeServe({ ...base, chiama: c, adesso: ORA })
    await presentaSeServe({ ...base, chiama: c, adesso: ORA + RIPRESENTA_DOPO - 1 })
    expect(c).toHaveBeenCalledTimes(1)
    await presentaSeServe({ ...base, chiama: c, adesso: ORA + RIPRESENTA_DOPO })
    expect(c).toHaveBeenCalledTimes(2)
    expect(c.mock.calls[1][2]).toBe(c.mock.calls[0][2])
  })

  // Dal revisore: con `adesso - il < 24h` un'ora futura dava sempre «già
  // presentata», e il tablet taceva fino a quella data.
  it('un\'ora segnata nel futuro (data del tablet avanti, poi corretta) non lo zittisce', async () => {
    localStorage.setItem('drink:presentata', '1.10.40-beta')
    localStorage.setItem('drink:presentata_il', String(ORA + 365 * 24 * 60 * 60 * 1000))
    const c = chiama()
    await presentaSeServe({ ...base, chiama: c, adesso: ORA })
    expect(c).toHaveBeenCalledTimes(1)
    await presentaSeServe({ ...base, chiama: c, adesso: ORA + 1000 })
    expect(c).toHaveBeenCalledTimes(1)
  })

  it('apertura e primo piano insieme: una chiamata sola, non due in volo', async () => {
    let rispondi
    const c = vi.fn(() => new Promise((r) => (rispondi = r)))
    const prima = presentaSeServe({ ...base, chiama: c, adesso: ORA })
    expect(await presentaSeServe({ ...base, chiama: c, adesso: ORA })).toBeNull()
    rispondi(RIUSCITA)
    expect(await prima).toEqual(RIUSCITA)
    expect(c).toHaveBeenCalledTimes(1)
  })

  it('un dispositivo con la memoria di prima (versione senza ora) si ripresenta una volta', async () => {
    localStorage.setItem('drink:presentata', '1.10.40-beta')
    const c = chiama()
    await presentaSeServe({ ...base, chiama: c, adesso: ORA })
    await presentaSeServe({ ...base, chiama: c, adesso: ORA + 1000 })
    expect(c).toHaveBeenCalledTimes(1)
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
