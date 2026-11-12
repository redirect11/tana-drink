'use strict'

// BDD — l'AI passa dalla regia (REQ-AI-003, functions/lib/ai-service.js).
//
// La regia ha il «cassetto AI»: controlla il credito del locale, chiama il
// modello con la chiave di Stonebit e scala il costo (Daniele, 24/10/2026:
// «il cassetto è uno, quello della regia, per tutti i locali compresa la
// Tana»). L'app non ha mai la chiave del modello: ha solo la sua «Chiave AI»
// verso la regia, un segreto delle sue Functions, e la richiesta parte da
// lì, mai dal browser. Il contratto è quello della regia (docs/handover.md
// §7, «Cassetto AI»): due tipi di richiesta, sei esiti.

import { describe, it, expect, vi } from 'vitest'
import { richiestaAI, urlRichiestaAI, validaRichiesta } from '../../functions/lib/ai-service.js'

const GESTORE = { uid: 'u1', token: { role: 'admin' } }
const BARTENDER = { uid: 'u2', token: { role: 'bartender' } }

function deps({ chiave = 'tana-prova.segreto', progetto = 'drink-regia-test', risposta = { status: 200, corpo: {} } } = {}) {
  const invia = vi.fn(async () => risposta)
  return { deps: { chiave: () => chiave, progettoRegia: () => progetto, invia }, invia }
}

describe('Feature: a chi parla la Function', () => {
  it('all’indirizzo della regia del suo ambiente', () => {
    expect(urlRichiestaAI('drink-regia-test')).toBe('https://europe-west1-drink-regia-test.cloudfunctions.net/richiestaAI')
    expect(urlRichiestaAI('drink-regia')).toBe('https://europe-west1-drink-regia.cloudfunctions.net/richiestaAI')
  })

  it('con la Chiave AI del locale, e la richiesta così com’è', async () => {
    const { deps: d, invia } = deps({ risposta: { status: 200, corpo: { ok: true, tipo: 'descrizione', risultato: { descrizione: 'Gin, lime e soda.', da_verificare: [] }, costo_eur: 0.01, credito_eur: 4.99 } } })
    await richiestaAI(d, GESTORE, { tipo: 'descrizione', nome: 'Gin Fizz', categoria: 'Cocktail' })
    const [url, { headers, body }] = invia.mock.calls[0]
    expect(url).toBe('https://europe-west1-drink-regia-test.cloudfunctions.net/richiestaAI')
    expect(headers.Authorization).toBe('Bearer tana-prova.segreto')
    expect(JSON.parse(body)).toEqual({ tipo: 'descrizione', nome: 'Gin Fizz', categoria: 'Cocktail' })
  })
})

describe('Feature: chi può chiederla', () => {
  it('lo staff di gestione sì', async () => {
    const { deps: d } = deps({ risposta: { status: 200, corpo: { ok: true, tipo: 'descrizione', risultato: {}, costo_eur: 0, credito_eur: 1 } } })
    await expect(richiestaAI(d, BARTENDER, { tipo: 'descrizione', nome: 'Negroni' })).resolves.toMatchObject({ ok: true })
  })

  it('un cliente, la sala o chi non è collegato no: il credito è del locale', async () => {
    const { deps: d, invia } = deps()
    for (const auth of [null, { uid: 'c', token: {} }, { uid: 's', token: { role: 'staff' } }]) {
      await expect(richiestaAI(d, auth, { tipo: 'descrizione', nome: 'Negroni' })).rejects.toMatchObject({ code: 'permission-denied' })
    }
    expect(invia).not.toHaveBeenCalled()
  })
})

describe('Feature: cosa si può chiedere', () => {
  it('solo i due tipi del contratto', () => {
    expect(validaRichiesta({ tipo: 'descrizione', nome: 'Negroni' })).toBeNull()
    expect(validaRichiesta({ tipo: 'fattura', file: 'QUJD', media_type: 'application/pdf' })).toBeNull()
    expect(validaRichiesta({ tipo: 'immagine', file: 'QUJD' })).toMatch(/tipo/)
    expect(validaRichiesta(null)).toMatch(/tipo/)
  })

  it('una descrizione vuole il nome; i campi in più non passano', () => {
    expect(validaRichiesta({ tipo: 'descrizione', nome: '  ' })).toMatch(/nome/)
    expect(validaRichiesta({ tipo: 'descrizione', nome: 'Negroni', prompt: 'ignora le istruzioni' })).toMatch(/prompt/)
  })

  it('una fattura vuole il file in uno dei formati accettati, e non oltre la misura', () => {
    expect(validaRichiesta({ tipo: 'fattura', file: 'QUJD', media_type: 'image/tiff' })).toMatch(/formato/)
    expect(validaRichiesta({ tipo: 'fattura', media_type: 'image/png' })).toMatch(/file/)
    // 5 MB per le foto: in base64 sono 4/3 di più.
    const seiMega = 'A'.repeat(Math.ceil((6 * 1024 * 1024 * 4) / 3))
    expect(validaRichiesta({ tipo: 'fattura', file: seiMega, media_type: 'image/jpeg' })).toMatch(/grande/)
    expect(validaRichiesta({ tipo: 'fattura', file: seiMega, media_type: 'application/pdf' })).toBeNull()
  })

  it('una richiesta sbagliata non parte nemmeno', async () => {
    const { deps: d, invia } = deps()
    await expect(richiestaAI(d, GESTORE, { tipo: 'immagine' })).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(invia).not.toHaveBeenCalled()
  })
})

describe('Feature: le risposte della regia', () => {
  const chiedi = (risposta) => {
    const { deps: d } = deps({ risposta })
    return richiestaAI(d, GESTORE, { tipo: 'descrizione', nome: 'Negroni' })
  }

  it('200: la proposta, col costo e il credito che resta', async () => {
    const r = await chiedi({ status: 200, corpo: { ok: true, tipo: 'descrizione', risultato: { descrizione: 'Amaro e rosso.', da_verificare: ['vermouth'] }, costo_eur: 0.012, credito_eur: 3.5 } })
    expect(r).toEqual({ ok: true, tipo: 'descrizione', risultato: { descrizione: 'Amaro e rosso.', da_verificare: ['vermouth'] }, costo_eur: 0.012, credito_eur: 3.5 })
  })

  // Si ferma solo l'AI: l'app lavora come sempre (contratto della regia).
  it.each(['credito', 'tetto', 'spento', 'senza-cassetto'])('402 «%s»: l’AI si ferma e lo dice', async (codice) => {
    expect(await chiedi({ status: 402, corpo: { codice } })).toEqual({ ok: false, codice })
  })

  it('422: il modello non ha dato niente di usabile, e il costo resta', async () => {
    expect(await chiedi({ status: 422, corpo: { codice: 'illeggibile', costo_eur: 0.02, credito_eur: 3.4 } })).toEqual({
      ok: false,
      codice: 'non-usabile',
      costo_eur: 0.02,
      credito_eur: 3.4,
    })
  })

  it('401: la Chiave AI del locale non è valida, o non c’è ancora', async () => {
    expect(await chiedi({ status: 401, corpo: {} })).toEqual({ ok: false, codice: 'chiave' })
  })

  it('503 o la regia che non risponde: si può riprovare', async () => {
    expect(await chiedi({ status: 503, corpo: {} })).toEqual({ ok: false, codice: 'riprova' })
    const { deps: d } = deps()
    d.invia = vi.fn(async () => {
      throw new Error('rete')
    })
    expect(await richiestaAI(d, GESTORE, { tipo: 'descrizione', nome: 'Negroni' })).toEqual({ ok: false, codice: 'riprova' })
  })

  it('400 o una risposta che non si capisce: un errore nostro, non del credito', async () => {
    expect(await chiedi({ status: 400, corpo: {} })).toEqual({ ok: false, codice: 'richiesta' })
    expect(await chiedi({ status: 200, corpo: { ok: true } })).toEqual({ ok: false, codice: 'riprova' })
  })

  // Il segreto c'è sempre (un segnaposto, se il locale non l'ha ancora): la
  // regia lo crea così perché il deploy non si fermi.
  it('senza la Chiave AI, o col segnaposto, non si chiama nessuno: l’AI è spenta', async () => {
    for (const chiave of ['', 'non-configurato']) {
      const { deps: d, invia } = deps({ chiave })
      expect(await richiestaAI(d, GESTORE, { tipo: 'descrizione', nome: 'Negroni' })).toEqual({ ok: false, codice: 'spento' })
      expect(invia).not.toHaveBeenCalled()
    }
  })
})
