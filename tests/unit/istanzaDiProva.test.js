'use strict'

// ── IL PROGETTO DI PROVA DICE ALLA REGIA QUANDO GIRA (REQ-FLOTTA-032) ──
//
// Daniele, 15/11/2026: nel backoffice della regia `drinkpos-prova-e2e`
// risulta «Disattivata» quando gli e2e non girano. Interfaccia 15 del
// contratto con la regia: { attiva } con l'ID token di un utente qualunque
// del progetto di prova. Qui: la guardia sul progetto, il token scambiato
// a ogni chiamata (dura un'ora), e nessun errore che fermi il giro.

import { describe, it, expect, vi } from 'vitest'
import { segnalaIstanzaDiProva, UTENTE_REGIA } from '../../scripts/lib-istanza-di-prova.js'

const REGIA = 'https://europe-west1-drink-regia-test.cloudfunctions.net/istanzaDiProva'

// Un fetch finto: lo scambio di Identity Toolkit dà un ID token nuovo a ogni
// giro, la regia risponde con `regia`.
function finto({ regia = { status: 200, corpo: { ok: true, attiva: true } }, scambio = 200 } = {}) {
  let n = 0
  return vi.fn(async (url, init) => {
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) {
      n += 1
      return { status: scambio, json: async () => (scambio === 200 ? { idToken: `id-${n}` } : { error: {} }) }
    }
    return { status: regia.status, json: async () => regia.corpo }
  })
}

const base = { progetto: 'drinkpos-prova-e2e', chiaveWeb: 'chiave-web', creaToken: vi.fn(async (uid) => `custom-${uid}`) }

describe('lo stato del progetto di prova alla regia', () => {
  it('conia il token per l\'utente fisso, lo scambia e manda { attiva } alla regia di test', async () => {
    const prendi = finto()
    const esito = await segnalaIstanzaDiProva({ ...base, attiva: true, prendi })
    expect(esito).toEqual({ ok: true, status: 200, attiva: true })
    expect(base.creaToken).toHaveBeenCalledWith(UTENTE_REGIA)

    const [urlScambio, scambio] = prendi.mock.calls[0]
    expect(urlScambio).toContain('accounts:signInWithCustomToken?key=chiave-web')
    expect(JSON.parse(scambio.body)).toEqual({ token: 'custom-e2e-regia', returnSecureToken: true })

    const [url, chiamata] = prendi.mock.calls[1]
    expect(url).toBe(REGIA)
    expect(chiamata.method).toBe('POST')
    expect(chiamata.headers.Authorization).toBe('Bearer id-1')
    expect(JSON.parse(chiamata.body)).toEqual({ attiva: true })
  })

  // La regia, 15/11: il token dura un'ora, e su un giro lungo quello
  // dell'inizio alla fine prenderebbe 401.
  it('ogni chiamata rifà lo scambio: la fine del giro non usa il token dell\'inizio', async () => {
    const prendi = finto()
    await segnalaIstanzaDiProva({ ...base, attiva: true, prendi })
    await segnalaIstanzaDiProva({ ...base, attiva: false, prendi })
    const allaRegia = prendi.mock.calls.filter(([u]) => u === REGIA)
    expect(allaRegia.map(([, i]) => i.headers.Authorization)).toEqual(['Bearer id-1', 'Bearer id-2'])
    expect(JSON.parse(allaRegia[1][1].body)).toEqual({ attiva: false })
  })

  it('solo un progetto di prova: con un altro progetto non parte niente', async () => {
    const prendi = finto()
    for (const progetto of ['tana-drink', 'tana-drink-test', 'drinkpos-demo', '', undefined]) {
      const esito = await segnalaIstanzaDiProva({ ...base, progetto, attiva: true, prendi })
      expect(esito.ok).toBe(false)
    }
    expect(prendi).not.toHaveBeenCalled()
  })

  it('attiva dev\'essere un sì o un no, e senza chiave web non si scambia niente', async () => {
    const prendi = finto()
    expect((await segnalaIstanzaDiProva({ ...base, attiva: 'true', prendi })).ok).toBe(false)
    expect((await segnalaIstanzaDiProva({ ...base, attiva: undefined, prendi })).ok).toBe(false)
    expect((await segnalaIstanzaDiProva({ ...base, chiaveWeb: '', attiva: true, prendi })).ok).toBe(false)
    expect(prendi).not.toHaveBeenCalled()
  })

  // Finché la regia non segna il progetto come istanza di prova risponde
  // 403: è uno stato, non deve fermare le prove.
  it('un rifiuto della regia torna come esito, col suo testo, senza lanciare', async () => {
    const prendi = finto({ regia: { status: 403, corpo: { errore: 'Istanza non segnata di prova' } } })
    expect(await segnalaIstanzaDiProva({ ...base, attiva: false, prendi })).toEqual({
      ok: false,
      status: 403,
      errore: 'Istanza non segnata di prova',
    })
  })

  it('scambio rifiutato, custom token che non nasce o rete che manca: esito non riuscito, mai un\'eccezione', async () => {
    expect((await segnalaIstanzaDiProva({ ...base, attiva: true, prendi: finto({ scambio: 400 }) })).status).toBe(400)

    const rotto = vi.fn(async () => {
      throw new Error('chiave senza firma')
    })
    const senzaToken = await segnalaIstanzaDiProva({ ...base, creaToken: rotto, attiva: true, prendi: finto() })
    expect(senzaToken).toMatchObject({ ok: false, status: 0 })

    const senzaRete = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await segnalaIstanzaDiProva({ ...base, attiva: true, prendi: senzaRete })).toMatchObject({ ok: false, status: 0 })
  })
})
