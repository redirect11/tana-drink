'use strict'

// IL PASSAGGIO FRA LA REGIA E L'APP (REQ-FLOTTA-030). L'utente, 02/11/2026:
// «se siamo loggati su backoffice o siamo loggati sulla nostra istanza
// tana, risulta loggato sia backoffice sia istanza per quell'utente», «mi
// serve qualcosa che sia sicuro e robusto». Il contratto con la regia è in
// docs/passaggio-dalla-regia.md: qui si prova la parte dell'app senza
// Firebase, con la rete e l'accesso finti.

import { describe, it, expect, vi } from 'vitest'
import {
  leggiFrammento,
  prendiCodiceDallIndirizzo,
  catturaCodiceRegia,
  codiceRegiaInAttesa,
  consumaCodiceRegia,
  esitoScambio,
  esitoVersoRegia,
  entraDallaRegia,
  versoLaRegia,
  areaClientiVisibile,
  urlScambio,
  MESSAGGI_PASSAGGIO,
} from '../../src/lib/passaggioRegia.js'

const PROGETTO = 'drink-regia-test'
const CODICE = 'abcDEF123_-xyz'
const risposta = (status, corpo) => ({ status, json: async () => corpo })

describe('il codice nell’indirizzo', () => {
  it('si legge dal frammento, e il resto del frammento resta', () => {
    expect(leggiFrammento(`#accesso-regia=${CODICE}`)).toEqual({ codice: CODICE, resto: '' })
    expect(leggiFrammento(`#accesso-regia=${CODICE}&altro=1`)).toEqual({ codice: CODICE, resto: '#altro=1' })
    expect(leggiFrammento('#altro=1')).toEqual({ codice: null, resto: null })
    expect(leggiFrammento('')).toEqual({ codice: null, resto: null })
  })

  it('un codice storto non parte verso la regia', () => {
    expect(leggiFrammento('#accesso-regia=<script>').codice).toBe('')
    expect(leggiFrammento('#accesso-regia=corto').codice).toBe('')
  })

  // Il codice non deve restare in cronologia, in un segnalibro, in una
  // schermata condivisa: si toglie prima di tutto il resto.
  it('si toglie subito dall’indirizzo, lasciando percorso e query', () => {
    const storia = { state: { k: 1 }, replaceState: vi.fn() }
    const luogo = { pathname: '/bar', search: '?tab=coda', hash: `#accesso-regia=${CODICE}` }
    expect(prendiCodiceDallIndirizzo(luogo, storia)).toBe(CODICE)
    expect(storia.replaceState).toHaveBeenCalledWith({ k: 1 }, '', '/bar?tab=coda')
  })

  it('senza codice l’indirizzo non si tocca', () => {
    const storia = { replaceState: vi.fn() }
    expect(prendiCodiceDallIndirizzo({ pathname: '/', search: '', hash: '#contatti' }, storia)).toBeNull()
    expect(storia.replaceState).not.toHaveBeenCalled()
  })

  // React in sviluppo monta due volte: il secondo scambio troverebbe il
  // codice già speso, e direbbe «scaduto» a chi è appena entrato.
  it('preso all’avvio, si consuma una volta sola', () => {
    catturaCodiceRegia({ pathname: '/', search: '', hash: `#accesso-regia=${CODICE}` }, { replaceState: () => {} })
    expect(codiceRegiaInAttesa()).toBe(true)
    expect(consumaCodiceRegia()).toBe(CODICE)
    expect(consumaCodiceRegia()).toBeNull()
    expect(codiceRegiaInAttesa()).toBe(false)
  })
})

describe('dalla regia all’app', () => {
  it('scambia il codice con la regia ed entra col token', async () => {
    const prendi = vi.fn(async () => risposta(200, { token: 'tok-1' }))
    const accedi = vi.fn(async () => {})
    expect(await entraDallaRegia(CODICE, { accedi, prendi, progetto: PROGETTO })).toEqual({ ok: true })
    const [url, opzioni] = prendi.mock.calls[0]
    expect(url).toBe(`https://europe-west1-${PROGETTO}.cloudfunctions.net/scambiaPassaggio`)
    expect(opzioni.method).toBe('POST')
    expect(JSON.parse(opzioni.body)).toEqual({ codice: CODICE })
    // Senza token: chi arriva non è ancora nessuno.
    expect(opzioni.headers.Authorization).toBeUndefined()
    expect(accedi).toHaveBeenCalledWith('tok-1')
  })

  // Il codice vale una volta: nessun nuovo tentativo, si dice in una riga e
  // resta il login normale.
  it('un rifiuto si dice in una riga, e si chiama una volta sola', async () => {
    const prendi = vi.fn(async () => risposta(403, null))
    const accedi = vi.fn()
    const esito = await entraDallaRegia(CODICE, { accedi, prendi, progetto: PROGETTO })
    expect(esito).toEqual({ ok: false, messaggio: MESSAGGI_PASSAGGIO.scaduto })
    expect(prendi).toHaveBeenCalledTimes(1)
    expect(accedi).not.toHaveBeenCalled()
  })

  it('le risposte della regia, una per una', () => {
    expect(esitoScambio(400, null).messaggio).toBe(MESSAGGI_PASSAGGIO.non_valido)
    expect(esitoScambio(503, null).messaggio).toBe(MESSAGGI_PASSAGGIO.non_disponibile)
    expect(esitoScambio(0, null).messaggio).toBe(MESSAGGI_PASSAGGIO.senza_rete)
    expect(esitoScambio(200, {}).ok).toBe(false)
    // La frase della regia, se c'è, vince.
    expect(esitoScambio(403, { errore: 'Codice già usato.' }).messaggio).toBe('Codice già usato.')
  })

  it('senza rete non resta appeso: lo dice', async () => {
    const prendi = vi.fn(async () => {
      throw new Error('offline')
    })
    expect(await entraDallaRegia(CODICE, { accedi: vi.fn(), prendi, progetto: PROGETTO })).toEqual({
      ok: false,
      messaggio: MESSAGGI_PASSAGGIO.senza_rete,
    })
  })

  // Solo i due progetti della regia: un progetto qualunque nella build non
  // diventa un indirizzo a cui l'app manda il codice.
  it('solo verso i progetti della regia', async () => {
    expect(urlScambio('un-altro-progetto')).toBeNull()
    const prendi = vi.fn()
    const esito = await entraDallaRegia(CODICE, { accedi: vi.fn(), prendi, progetto: 'un-altro-progetto' })
    expect(esito.ok).toBe(false)
    expect(prendi).not.toHaveBeenCalled()
  })

  it('un codice storto non si manda', async () => {
    const prendi = vi.fn()
    expect((await entraDallaRegia('', { accedi: vi.fn(), prendi, progetto: PROGETTO })).messaggio).toBe(
      MESSAGGI_PASSAGGIO.non_valido
    )
    expect(prendi).not.toHaveBeenCalled()
  })
})

describe('dall’app alla regia, «Area clienti»', () => {
  // La regia vuole un accesso di meno di cinque minuti: il token si rinnova
  // al tocco, e viaggia nell'intestazione.
  it('manda il token rinnovato e apre l’indirizzo che la regia risponde', async () => {
    const prendi = vi.fn(async () => risposta(200, { url: 'https://regia.example/area?t=1' }))
    const token = vi.fn(async () => 'id-token-fresco')
    expect(await versoLaRegia({ token, prendi, progetto: PROGETTO })).toEqual({ ok: true, url: 'https://regia.example/area?t=1' })
    const [url, opzioni] = prendi.mock.calls[0]
    expect(url).toBe(`https://europe-west1-${PROGETTO}.cloudfunctions.net/passaggioVersoRegia`)
    expect(opzioni.headers.Authorization).toBe('Bearer id-token-fresco')
  })

  it('chi non è il titolare, o ha un accesso vecchio, lo legge in una riga', () => {
    expect(esitoVersoRegia(403, null).messaggio).toBe(MESSAGGI_PASSAGGIO.non_titolare)
    expect(esitoVersoRegia(404, null).messaggio).toBe(MESSAGGI_PASSAGGIO.non_trovato)
    expect(esitoVersoRegia(401, null).messaggio).toBe(MESSAGGI_PASSAGGIO.da_rientrare)
  })

  // La risposta decide dove va il titolare: un `javascript:` non passa.
  it('si apre solo un indirizzo https', () => {
    expect(esitoVersoRegia(200, { url: 'javascript:alert(1)' }).ok).toBe(false)
    expect(esitoVersoRegia(200, { url: 'http://regia.example' }).ok).toBe(false)
    expect(esitoVersoRegia(200, { url: 'https://regia.example' }).ok).toBe(true)
  })

  it('senza accesso non chiama', async () => {
    const prendi = vi.fn()
    expect((await versoLaRegia({ token: async () => null, prendi, progetto: PROGETTO })).messaggio).toBe(
      MESSAGGI_PASSAGGIO.da_rientrare
    )
    expect(prendi).not.toHaveBeenCalled()
  })

  // I tasti verso la regia compaiono quando la licenza dice dov'è: prima
  // che la regia scriva quella della Tana, non ci sono.
  it('il tasto c’è per l’admin, con la regia nella build e nella licenza', () => {
    const settings = { licenza: { moduli: {}, regia_url: 'https://regia.example' } }
    expect(areaClientiVisibile({ admin: true, settings, progetto: PROGETTO })).toBe(true)
    expect(areaClientiVisibile({ admin: false, settings, progetto: PROGETTO })).toBe(false)
    expect(areaClientiVisibile({ admin: true, settings: { licenza: { moduli: {} } }, progetto: PROGETTO })).toBe(false)
    expect(areaClientiVisibile({ admin: true, settings, progetto: 'un-altro-progetto' })).toBe(false)
  })
})
