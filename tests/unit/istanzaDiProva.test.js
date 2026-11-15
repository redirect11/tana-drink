'use strict'

// ── IL PROGETTO DI PROVA DICE ALLA REGIA QUANDO GIRA (REQ-FLOTTA-032) ──
//
// Daniele, 15/11/2026: nel backoffice della regia `drinkpos-prova-e2e`
// risulta «Disattivata» quando gli e2e non girano. Interfaccia 15 del
// contratto con la regia: { attiva } col gettone d'identità dell'account di
// deploy del progetto di prova, destinatario `regia-prova:<regia>`. Nessun
// utente del locale chiama la regia (regia REQ-FLOTTA-115). Qui: la guardia
// sul progetto, il gettone chiesto a ogni chiamata (dura un'ora), e nessun
// errore che fermi il giro.

import { describe, it, expect, vi } from 'vitest'
import { segnalaIstanzaDiProva, destinatarioDelGettone } from '../../scripts/lib-istanza-di-prova.js'

const REGIA = 'https://europe-west1-drink-regia-test.cloudfunctions.net/istanzaDiProva'

const risposta = (status, corpo) => vi.fn(async () => ({ status, json: async () => corpo }))

// Un gettone nuovo a ogni richiesta, come fa google-auth-library.
function gettoni() {
  let n = 0
  return vi.fn(async () => `gettone-${++n}`)
}

const base = { progetto: 'drinkpos-prova-e2e' }

describe('lo stato del progetto di prova alla regia', () => {
  it('chiede il gettone per la regia di test e manda { attiva } con quello', async () => {
    const gettone = gettoni()
    const prendi = risposta(200, { ok: true, attiva: true })
    const esito = await segnalaIstanzaDiProva({ ...base, attiva: true, gettone, prendi })
    expect(esito).toEqual({ ok: true, status: 200, attiva: true })
    expect(gettone).toHaveBeenCalledWith('regia-prova:drink-regia-test')

    const [url, chiamata] = prendi.mock.calls[0]
    expect(url).toBe(REGIA)
    expect(chiamata.method).toBe('POST')
    expect(chiamata.headers.Authorization).toBe('Bearer gettone-1')
    expect(JSON.parse(chiamata.body)).toEqual({ attiva: true })
  })

  it('il destinatario porta il nome della regia, come lo vuole il contratto', () => {
    expect(destinatarioDelGettone()).toBe('regia-prova:drink-regia-test')
    expect(destinatarioDelGettone('drink-regia')).toBe('regia-prova:drink-regia')
  })

  // La regia, 15/11: il gettone dura un'ora, e su un giro lungo quello
  // dell'inizio alla fine prenderebbe 401.
  it('ogni chiamata chiede un gettone nuovo: la fine del giro non usa quello dell\'inizio', async () => {
    const gettone = gettoni()
    const prendi = risposta(200, { ok: true, attiva: false })
    await segnalaIstanzaDiProva({ ...base, attiva: true, gettone, prendi })
    await segnalaIstanzaDiProva({ ...base, attiva: false, gettone, prendi })
    expect(prendi.mock.calls.map(([, i]) => i.headers.Authorization)).toEqual(['Bearer gettone-1', 'Bearer gettone-2'])
    expect(JSON.parse(prendi.mock.calls[1][1].body)).toEqual({ attiva: false })
  })

  it('solo un progetto di prova: con un altro progetto non parte niente', async () => {
    const gettone = gettoni()
    const prendi = risposta(200, { ok: true })
    for (const progetto of ['tana-drink', 'tana-drink-test', 'drinkpos-demo', '', undefined]) {
      expect((await segnalaIstanzaDiProva({ progetto, attiva: true, gettone, prendi })).ok).toBe(false)
    }
    expect(gettone).not.toHaveBeenCalled()
    expect(prendi).not.toHaveBeenCalled()
  })

  it('attiva dev\'essere un sì o un no', async () => {
    const gettone = gettoni()
    const prendi = risposta(200, { ok: true })
    expect((await segnalaIstanzaDiProva({ ...base, attiva: 'true', gettone, prendi })).ok).toBe(false)
    expect((await segnalaIstanzaDiProva({ ...base, attiva: undefined, gettone, prendi })).ok).toBe(false)
    expect(prendi).not.toHaveBeenCalled()
  })

  // Finché la regia non segna il progetto come istanza di prova risponde
  // 403: è uno stato, non deve fermare le prove.
  it('un rifiuto della regia torna come esito, col suo testo, senza lanciare', async () => {
    const prendi = risposta(403, { errore: 'Istanza non segnata di prova' })
    expect(await segnalaIstanzaDiProva({ ...base, attiva: false, gettone: gettoni(), prendi })).toEqual({
      ok: false,
      status: 403,
      errore: 'Istanza non segnata di prova',
    })
  })

  it('gettone che non arriva, vuoto, o rete che manca: esito non riuscito, mai un\'eccezione', async () => {
    const prendi = risposta(200, { ok: true })
    const rotto = vi.fn(async () => {
      throw new Error('chiave non valida')
    })
    expect(await segnalaIstanzaDiProva({ ...base, attiva: true, gettone: rotto, prendi })).toMatchObject({ ok: false, status: 0 })
    expect(await segnalaIstanzaDiProva({ ...base, attiva: true, gettone: async () => '', prendi })).toMatchObject({ ok: false, status: 0 })
    expect(prendi).not.toHaveBeenCalled()

    const senzaRete = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await segnalaIstanzaDiProva({ ...base, attiva: true, gettone: gettoni(), prendi: senzaRete })).toMatchObject({
      ok: false,
      status: 0,
    })
  })
})

// I due passi nel giro (e2e.yml): l'inizio dopo la chiave e prima del
// deploy; la fine SEMPRE, anche con le prove rosse, e prima che la chiave
// se ne vada e che l'ambiente si smonti.
describe('i due passi in e2e.yml', () => {
  const passi = async () => {
    const { readFileSync } = await import('node:fs')
    const yml = readFileSync('.github/workflows/e2e.yml', 'utf8')
    return yml.split(/\r?\n(?=      - )/).map((p) => ({
      nome: /- name: (.+)/.exec(p)?.[1]?.trim() ?? '',
      testo: p,
    }))
  }
  const indice = (elenco, nome) => elenco.findIndex((p) => p.nome === nome)

  it('l\'inizio parte con la chiave pronta e prima del deploy', async () => {
    const p = await passi()
    const inizio = indice(p, 'La regia sa che le prove iniziano')
    expect(inizio).toBeGreaterThan(indice(p, 'Credenziali e guardia'))
    expect(inizio).toBeLessThan(indice(p, 'Regole, indici e Functions'))
    expect(p[inizio].testo).toContain('istanza-di-prova.mjs --attiva true')
  })

  it('la fine c\'è sempre, prima dello smontaggio e prima di togliere la chiave', async () => {
    const p = await passi()
    const fine = indice(p, 'La regia sa che le prove sono finite')
    expect(fine).toBeGreaterThan(indice(p, 'I casi d\'uso'))
    expect(fine).toBeLessThan(indice(p, 'Smonta l\'ambiente'))
    expect(fine).toBeLessThan(indice(p, 'Via la chiave'))
    expect(p[fine].testo).toMatch(/if: always\(\)/)
    expect(p[fine].testo).toContain('istanza-di-prova.mjs --attiva false')
  })
})
