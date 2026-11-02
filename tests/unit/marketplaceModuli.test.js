// @vitest-environment happy-dom
'use strict'

// ── IL MARKETPLACE DEI MODULI, LA LOGICA (REQ-LIC-012) ────────────────
//
// L'utente, 02/11/2026: «anche per i moduli aggiuntivi andrebbe fatto il
// marketplace». Al mese come nel listino della regia, con una prova
// gratuita, e li compra solo il titolare. Qui le regole pure: cosa dice il
// listino, in che stato è ogni modulo, quando l'app può comprare, come si
// legge la risposta della regia.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  leggiVoce,
  leggiListino,
  listinoRicordato,
  scaricaListino,
  schedeModuli,
  acquistiDallApp,
  prezzoAlMese,
  esitoAzione,
  urlRitorno,
  esitoRitorno,
  urlListino,
  urlAzioni,
} from '../../src/lib/marketplaceModuli.js'
import { urlFunzioneRegia } from '../../src/lib/funzioniRegia.js'

beforeEach(() => localStorage.clear())

const conLicenza = (licenza) => ({ licenza: { stato: 'attiva', ...licenza } })

describe('gli indirizzi della regia', () => {
  it('solo i due progetti della regia, per intero', () => {
    expect(urlListino('drink-regia')).toBe('https://europe-west1-drink-regia.cloudfunctions.net/catalogoModuli')
    expect(urlAzioni('drink-regia-test')).toBe('https://europe-west1-drink-regia-test.cloudfunctions.net/moduloDallApp')
    // Un progetto qualunque nella build non diventa un indirizzo a cui
    // l'app manda il token del titolare.
    expect(urlFunzioneRegia('moduloDallApp', 'foo-drink-regia')).toBeNull()
    expect(urlAzioni(undefined)).toBeNull()
  })
})

describe('il listino della regia', () => {
  it('tiene i moduli che l\'app conosce, col prezzo mensile e i giorni di prova', () => {
    expect(leggiVoce({ id: 'magazzino', prezzo: 15, prova_giorni: 14 })).toEqual({ id: 'magazzino', prezzo: 15, prova_giorni: 14 })
    // Un modulo nuovo arriva con l'app, non dal listino.
    expect(leggiVoce({ id: 'astronave', prezzo: 1 })).toBeNull()
    expect(leggiVoce({ id: 'staff', prezzo: 'boh', prova_giorni: -3 })).toEqual({ id: 'staff', prezzo: null, prova_giorni: 0 })
    expect(leggiListino({ moduli: [{ id: 'sumup', prezzo: 10 }, null, 'x'] })).toEqual([{ id: 'sumup', prezzo: 10, prova_giorni: 0 }])
    expect(leggiListino(null)).toEqual([])
  })

  it('si scarica all\'apertura e si ricorda: senza rete resta l\'ultimo letto', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ moduli: [{ id: 'clienti', prezzo: 6, prova_giorni: 7 }] }) }))
    expect(await scaricaListino('https://x/catalogoModuli', fetch)).toEqual([{ id: 'clienti', prezzo: 6, prova_giorni: 7 }])
    expect(listinoRicordato()).toEqual([{ id: 'clienti', prezzo: 6, prova_giorni: 7 }])

    const senzaRete = vi.fn(() => Promise.reject(new Error('offline')))
    expect(await scaricaListino('https://x/catalogoModuli', senzaRete)).toBeNull()
    expect(listinoRicordato()).toEqual([{ id: 'clienti', prezzo: 6, prova_giorni: 7 }])
    expect(await scaricaListino(null, fetch)).toBeNull()
  })
})

describe('le schede dei moduli', () => {
  it('lo stato viene dalla licenza, prezzo e prova dal listino', () => {
    const settings = conLicenza({
      moduli: { magazzino: true, statistiche: true },
      prove: { statistiche: '2026-11-16T10:00:00.000Z' },
    })
    const listino = [
      { id: 'magazzino', prezzo: 15, prova_giorni: 14 },
      { id: 'statistiche', prezzo: 15, prova_giorni: 14 },
      { id: 'clienti', prezzo: 6, prova_giorni: 7 },
    ]
    const perId = Object.fromEntries(schedeModuli(settings, listino).map((m) => [m.id, m]))
    expect(perId.magazzino).toMatchObject({ stato: 'incluso', prezzo: 15, in_vendita: true })
    expect(perId.statistiche.stato).toBe('prova')
    expect(perId.statistiche.prova_fino.toISOString()).toBe('2026-11-16T10:00:00.000Z')
    expect(perId.clienti).toMatchObject({ stato: 'non_incluso', prova_giorni: 7, in_vendita: true })
    // Le fatture non sono nel listino: si vedono, ma non si comprano da sole.
    expect(perId.fatture).toMatchObject({ stato: 'non_incluso', in_vendita: false, prezzo: null })
  })

  it('ci sono tutti i moduli dell\'app, anche senza listino', () => {
    expect(schedeModuli(conLicenza({ moduli: {} })).map((m) => m.id)).toContain('scadenzario')
  })
})

describe('chi può comprare dall\'app', () => {
  const url = 'https://europe-west1-drink-regia.cloudfunctions.net/moduloDallApp'
  it('solo con la regia nella build e una licenza che dice dov\'è la regia', () => {
    expect(acquistiDallApp(conLicenza({ regia_url: 'https://regia.example/area' }), url)).toBe(true)
    // La licenza della Tana è scritta dal deploy, senza regia: niente tasti.
    expect(acquistiDallApp(conLicenza({ regia_url: null }), url)).toBe(false)
    expect(acquistiDallApp(conLicenza({ regia_url: 'https://regia.example/area' }), null)).toBe(false)
  })
})

describe('le parole', () => {
  it('il prezzo è mensile, IVA esclusa, come nel listino; scritto come ogni prezzo dell\'app', () => {
    // formatPrice mette uno spazio che non va a capo prima di «€».
    expect(prezzoAlMese(15)).toMatch(/^15,00\s€ al mese \+ IVA$/)
    expect(prezzoAlMese(7.5)).toMatch(/^7,50\s€ al mese \+ IVA$/)
    expect(prezzoAlMese(null)).toBe('')
  })
})

describe('la risposta della regia', () => {
  it('con l\'acquisto, l\'indirizzo della pagina di pagamento; solo di Stripe', () => {
    expect(esitoAzione(200, { ok: true, checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_1' })).toEqual({
      ok: true,
      checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      dal: null,
    })
    // Un indirizzo che non è di Stripe non si apre: la licenza resta della regia.
    expect(esitoAzione(200, { ok: true, checkout_url: 'https://altro.example/paga' }).checkout_url).toBeNull()
    expect(esitoAzione(200, { ok: true, dal: '2026-12-01' })).toMatchObject({ ok: true, dal: '2026-12-01' })
  })

  it('un rifiuto porta il testo della regia, se c\'è', () => {
    expect(esitoAzione(409, { ok: false, errore: ' La prova di questo modulo è già stata usata. ' })).toEqual({
      ok: false,
      status: 409,
      errore: 'La prova di questo modulo è già stata usata.',
    })
    expect(esitoAzione(500, null)).toEqual({ ok: false, status: 500, errore: null })
  })
})

describe('il ritorno dalla pagina di pagamento', () => {
  it('torna sui moduli del marketplace, e l\'esito si legge dall\'indirizzo', () => {
    expect(urlRitorno('https://tana.example', '/')).toBe('https://tana.example/bar?tab=marketplace&sezione=moduli')
    expect(urlRitorno('https://x.example', '/demo/')).toBe('https://x.example/demo/bar?tab=marketplace&sezione=moduli')
    expect(esitoRitorno('?tab=marketplace&esito=pagato')).toBe('pagato')
    expect(esitoRitorno('?esito=annullato')).toBe('annullato')
    expect(esitoRitorno('?esito=boh')).toBeNull()
    expect(esitoRitorno('')).toBeNull()
  })
})
