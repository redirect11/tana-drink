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
  entraDallaRegia,
  indirizzoAreaClienti,
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
  // Daniele, 14/11/2026: «non può portarlo semplicemente all'app dove lui
  // poi deve fare il login, ma se lo ha già fatto si ritrova già nella sua
  // area?». È un collegamento alla pagina della regia `/dashboard`: lì si
  // entra come sempre, e chi è già entrato ci si ritrova.
  it('porta alla pagina della regia della build, anche senza la regia nella licenza', () => {
    expect(indirizzoAreaClienti({ licenza: { moduli: {}, regia_url: null } }, 'drink-regia')).toBe(
      'https://drink-regia.web.app/dashboard'
    )
    expect(indirizzoAreaClienti({}, 'drink-regia-test')).toBe('https://drink-regia-test.web.app/dashboard')
  })

  it('se la licenza nomina la regia vale quella, ma solo il sito e solo in https', () => {
    const conRegia = (regia_url) => ({ licenza: { moduli: {}, regia_url } })
    expect(indirizzoAreaClienti(conRegia('https://regia.example/area?x=1'), PROGETTO)).toBe('https://regia.example/dashboard')
    // Un indirizzo che non è https non si apre: vale quello della build.
    expect(indirizzoAreaClienti(conRegia('http://regia.example'), 'drink-regia')).toBe('https://drink-regia.web.app/dashboard')
    expect(indirizzoAreaClienti(conRegia('javascript:alert(1)'), 'drink-regia')).toBe('https://drink-regia.web.app/dashboard')
  })

  // Un progetto qualunque nella build non diventa un indirizzo: solo i due
  // della regia (come le sue Functions).
  it('senza una regia conosciuta non c’è un indirizzo, e il tasto non c’è', () => {
    expect(indirizzoAreaClienti({}, 'un-altro-progetto')).toBeNull()
    expect(indirizzoAreaClienti({}, '')).toBeNull()
    expect(areaClientiVisibile({ admin: true, settings: {}, progetto: 'un-altro-progetto' })).toBe(false)
  })

  it('il tasto c’è per l’admin, e per gli altri no', () => {
    expect(areaClientiVisibile({ admin: true, settings: {}, progetto: 'drink-regia' })).toBe(true)
    expect(areaClientiVisibile({ admin: false, settings: {}, progetto: 'drink-regia' })).toBe(false)
  })
})
