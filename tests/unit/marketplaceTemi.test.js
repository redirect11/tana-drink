// @vitest-environment happy-dom
'use strict'

// ── IL MARKETPLACE DEI TEMI (REQ-MENU-023) ────────────────────────────
//
// «Il tema quindi è composto da tavolozze e stile» (l'utente, 02/11/2026).
// Un tema è una ricetta, non codice: una base fra le tavolozze dell'app,
// qualche colore, uno stile che l'app sa disegnare. `leggiTema` decide che
// cosa è un tema, per l'app e per la regia che li pubblica.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  leggiTema,
  leggiCatalogo,
  CATALOGO_INIZIALE,
  catalogo,
  catalogoRicordato,
  scaricaCatalogo,
  urlCatalogo,
  temiInstallati,
  temaPerId,
  temaInProva,
  temaComeColori,
  patchInstallaTema,
  patchUsaTema,
  patchDisinstallaTema,
  temiSuMisura,
  suMisuraRitirati,
  stileDelTema,
} from '../../src/lib/marketplaceTemi.js'
import { ricordaStili, leggiStiliDelCatalogo } from '../../src/lib/stiliRicetta.js'
import { THEME_FIELDS, THEME_PRESETS } from '../../src/lib/themes.js'

beforeEach(() => {
  localStorage.clear()
})

const GRAND_HOTEL = {
  id: 'grand-hotel',
  nome: 'Grand Hotel',
  descrizione: 'Anni Venti sul blu',
  tavolozza: { base: 'notte-blu', colori: { '--accent-2': '#d4af37' } },
  stile: 'deco',
}

describe('che cosa è un tema', () => {
  it('una base dell’app, i colori validi, uno stile che l’app conosce', () => {
    expect(leggiTema(GRAND_HOTEL)).toEqual({
      ...GRAND_HOTEL,
      prezzo: 0,
      tavolozza: { base: 'notte-blu', colori: { '--accent-2': '#d4af37' } },
    })
  })

  it('i colori che non sono colori, o che non sono della tavolozza, si scartano', () => {
    const t = leggiTema({
      ...GRAND_HOTEL,
      tavolozza: { base: 'notte-blu', colori: { '--accent': 'red', '--bg': '#000000', '--z-index': '#111111' } },
    })
    expect(t.tavolozza.colori).toEqual({ '--bg': '#000000' })
  })

  it('una base o uno stile che l’app non ha, o un id storto: non è un tema che si sa disegnare', () => {
    expect(leggiTema({ ...GRAND_HOTEL, stile: 'vaporwave' })).toBeNull()
    expect(leggiTema({ ...GRAND_HOTEL, tavolozza: { base: 'inventata' } })).toBeNull()
    expect(leggiTema({ ...GRAND_HOTEL, id: 'Con Spazi' })).toBeNull()
    expect(leggiTema({ ...GRAND_HOTEL, nome: '' })).toBeNull()
    expect(leggiTema(null)).toBeNull()
  })

  it('il catalogo iniziale è tutto gratis, e fatto di quello che l’app ha già', () => {
    expect(CATALOGO_INIZIALE.length).toBeGreaterThanOrEqual(7)
    for (const t of CATALOGO_INIZIALE) {
      expect(t.prezzo).toBe(0)
      expect(leggiTema(t)).toEqual(t)
    }
  })
})

describe('il catalogo che si vede', () => {
  it('«Notte» c’è solo dove la licenza lo dà: è della Tana', () => {
    expect(catalogo({}).some((t) => t.id === 'notte')).toBe(false)
    expect(catalogo({ licenza: { temi: ['notte'] } }).some((t) => t.id === 'notte')).toBe(true)
  })

  it('anche «Meraviglie» (REQ-MENU-027)', () => {
    expect(catalogo({}).some((t) => t.id === 'meraviglie')).toBe(false)
    expect(catalogo({ licenza: { temi: ['notte'] } }).some((t) => t.id === 'meraviglie')).toBe(false)
    expect(catalogo({ licenza: { temi: ['meraviglie'] } }).some((t) => t.id === 'meraviglie')).toBe(true)
  })

  it('quello della regia si aggiunge, e con lo stesso id sostituisce l’iniziale', () => {
    const daRegia = leggiCatalogo({
      temi: [
        { ...GRAND_HOTEL, nome: 'Grand Hotel 2' },
        { id: 'aurora', nome: 'Aurora', tavolozza: { base: 'crema' }, stile: 'classico' },
        { id: 'rotto', nome: 'Rotto', tavolozza: { base: 'crema' }, stile: 'boh' },
      ],
    })
    const ids = catalogo({}, daRegia)
    expect(ids.find((t) => t.id === 'grand-hotel').nome).toBe('Grand Hotel 2')
    expect(ids.some((t) => t.id === 'aurora')).toBe(true)
    expect(ids.some((t) => t.id === 'rotto')).toBe(false)
  })

  it('i temi a pagamento, per ora, non si mostrano: «Compra» non c’è ancora', () => {
    const daRegia = leggiCatalogo([{ id: 'caro', nome: 'Caro', prezzo: 9, tavolozza: { base: 'crema' }, stile: 'classico' }])
    expect(catalogo({}, daRegia).some((t) => t.id === 'caro')).toBe(false)
  })
})

describe('il catalogo della regia', () => {
  it('solo dai due progetti della regia', () => {
    expect(urlCatalogo('drink-regia')).toBe('https://europe-west1-drink-regia.cloudfunctions.net/catalogoTemi')
    expect(urlCatalogo('drink-regia-test')).toMatch(/drink-regia-test/)
    expect(urlCatalogo(undefined)).toBeNull()
    expect(urlCatalogo('altro')).toBeNull()
  })

  it('si scarica, si ricorda, e senza rete resta quello di prima', async () => {
    const ok = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ temi: [GRAND_HOTEL] }) }))
    expect((await scaricaCatalogo('https://x', ok)).map((t) => t.id)).toEqual(['grand-hotel'])
    expect(catalogoRicordato().map((t) => t.id)).toEqual(['grand-hotel'])

    const giu = vi.fn(() => Promise.reject(new Error('rete')))
    expect(await scaricaCatalogo('https://x', giu)).toBeNull()
    expect(catalogoRicordato().map((t) => t.id)).toEqual(['grand-hotel'])
  })

  it('senza regia nella build non si chiama nessuno', async () => {
    const prendi = vi.fn()
    expect(await scaricaCatalogo(null, prendi)).toBeNull()
    expect(prendi).not.toHaveBeenCalled()
  })
})

describe('installare e usare un tema', () => {
  const tema = leggiTema(GRAND_HOTEL)

  it('installato, il locale ne tiene una copia: il menù non dipende dal catalogo', () => {
    const s = patchInstallaTema({}, tema)
    expect(temiInstallati(s)).toEqual([tema])
    expect(temaPerId(s, 'grand-hotel', [])).toEqual(tema)
  })

  it('«Usa» scrive i colori del menù dei clienti e lo stile, e installa lo stile gratis', () => {
    expect(patchUsaTema({}, tema)).toEqual({
      temi_installati: [tema],
      theme_client: { preset: 'notte-blu', custom: { '--accent-2': '#d4af37' } },
      stile_menu: 'deco',
      tema_menu: 'grand-hotel',
      stili_installati: ['deco'],
    })
  })

  it('i colori del gestionale non si toccano', () => {
    expect(patchUsaTema({}, tema)).not.toHaveProperty('theme_staff')
  })

  it('una tavolozza senza colori in più è la base com’è', () => {
    expect(temaComeColori(leggiTema({ ...GRAND_HOTEL, tavolozza: { base: 'crema' } }))).toEqual({
      preset: 'crema',
      custom: null,
    })
  })

  // LA TAVOLOZZA LA PROPONE IL TEMA, MA RESTA LIBERA (REQ-MENU-027). «Usa»
  // scrive i colori dello stile in `theme_client`, come per ogni tema; dopo,
  // chi cambia la tavolozza cambia solo quella, e lo stile resta.
  it('«Lavagna» e «Meraviglie» propongono la loro tavolozza, che resta una tavolozza come le altre', () => {
    const t = (id) => CATALOGO_INIZIALE.find((x) => x.id === id)
    expect(t('lavagna').tavolozza.base).toBe('lavagna')
    expect(t('meraviglie').tavolozza.base).toBe('meraviglie')
    const s = { licenza: { temi: ['meraviglie'] } }
    const usato = { ...s, ...patchUsaTema(s, t('meraviglie')) }
    expect(usato.theme_client).toEqual({ preset: 'meraviglie', custom: null })
    expect(usato.stile_menu).toBe('meraviglie')
    // Nessuno stile in licenza da installare.
    expect(usato).not.toHaveProperty('stili_installati')
  })

  // I colori di quelle tavolozze si devono poter modificare dal selettore,
  // che lavora coi sette esadecimali di THEME_FIELDS.
  it('le tavolozze degli stili hanno tutti i colori, in esadecimale', () => {
    for (const id of ['lavagna', 'meraviglie']) {
      for (const { key } of THEME_FIELDS) expect(THEME_PRESETS[id].vars[key], `${id} ${key}`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('disinstallare toglie la copia; quello in uso smette di esserlo', () => {
    const s = { temi_installati: [tema], tema_menu: 'grand-hotel' }
    expect(patchDisinstallaTema(s, 'grand-hotel')).toEqual({ temi_installati: [], tema_menu: null })
  })
})

describe('la prova sul menù', () => {
  it('solo nella vista del cliente, e solo con un tema che c’è', () => {
    expect(temaInProva({}, '?vista=cliente&tema=gazzetta').id).toBe('gazzetta')
    expect(temaInProva({}, '?tema=gazzetta')).toBeNull()
    expect(temaInProva({}, '?vista=cliente&tema=inventato')).toBeNull()
    expect(temaInProva({}, '?vista=cliente&tema=notte')).toBeNull()
  })
})

// ── I TEMI SU MISURA (REQ-MENU-030) ──────────────────────────────────
// La regia li fa per un locale solo (dal mockup del titolare, o a mano dal
// fornitore) e li manda con la licenza, in `temi_su_misura`
// (docs/temi-su-misura.md). Nessuna chiamata in più: si vedono anche senza
// rete.
const RICETTA = {
  versione: 1,
  caratteri: { titolo: 'libre-baskerville', voce: 'libre-baskerville', testo: 'georgia' },
  titoli: { maiuscolo: false, corsivo: true, allineamento: 'centro', dimensione: 'grande', spaziatura: 'normale' },
  intestazione: 'fregio',
  voce: { forma: 'riga', prezzo: 'puntini', separatore: 'nessuno', immagine: 'nascosta' },
  cornice: 'doppia',
  angoli: 'vivi',
  sfondo: 'carta',
  impaginazione: 'per-categoria',
}

describe('i temi su misura, dalla licenza', () => {
  const BOSCO = {
    id: 'su-misura-mhz3k1a2',
    nome: 'Bosco',
    descrizione: 'Verde profondo e oro.',
    prezzo: 0,
    tavolozza: { base: 'tana-scuro', colori: { '--bg': '#10201a' } },
    stile: 'deco',
    ricetta: RICETTA,
  }
  const conLicenza = (temi, altro = {}) => ({ licenza: { temi_su_misura: temi }, ...altro })

  it('sono temi come quelli del catalogo, segnati su misura e con la loro ricetta', () => {
    const [t] = temiSuMisura(conLicenza([BOSCO]))
    expect(t).toMatchObject({ id: BOSCO.id, nome: 'Bosco', stile: 'deco', su_misura: true, ricetta: RICETTA })
    expect(t.tavolozza).toEqual({ base: 'tana-scuro', colori: { '--bg': '#10201a' } })
  })

  it('le licenze scritte prima non hanno la voce: nessun tema su misura', () => {
    expect(temiSuMisura({ licenza: { temi: ['notte'] } })).toEqual([])
    expect(temiSuMisura({})).toEqual([])
    expect(temiSuMisura(conLicenza('non è un elenco'))).toEqual([])
  })

  // Un tema su misura non apre un esclusivo: «Notte» resta di chi l'ha in
  // licenza, e uno stile sconosciuto non si sa disegnare.
  it('uno stile esclusivo o sconosciuto lo scarta', () => {
    const temi = temiSuMisura(conLicenza([{ ...BOSCO, stile: 'notte' }, { ...BOSCO, id: 'altro', stile: 'vaporwave' }, null]))
    expect(temi).toEqual([])
  })

  it('installato e poi tolto dalla licenza: resta, ma si sa che non si reinstalla', () => {
    const copia = temiSuMisura(conLicenza([BOSCO]))[0]
    const dopo = { licenza: { temi_su_misura: [] }, temi_installati: [copia] }
    expect(temiInstallati(dopo)[0]).toMatchObject({ id: BOSCO.id, su_misura: true, ricetta: RICETTA })
    expect(suMisuraRitirati(dopo).map((t) => t.id)).toEqual([BOSCO.id])
    expect(suMisuraRitirati({ ...dopo, licenza: { temi_su_misura: [BOSCO] } })).toEqual([])
  })

  it('si prova sul menù anche prima di installarlo', () => {
    expect(temaPerId(conLicenza([BOSCO]), BOSCO.id)?.nome).toBe('Bosco')
    expect(temaInProva(conLicenza([BOSCO]), `?vista=cliente&tema=${BOSCO.id}`)?.su_misura).toBe(true)
  })

  // CON LA RICETTA SI DISEGNA COL MOTORE (REQ-MENU-031): il tema è uno
  // stile a ricetta col suo stesso id; senza, o con una ricetta che l'app
  // non sa disegnare, si usa il suo `stile`.
  it('con la ricetta si disegna col motore, col suo id; senza, col suo stile', () => {
    const [conRicetta] = temiSuMisura(conLicenza([BOSCO]))
    expect(stileDelTema(conRicetta)).toBe(BOSCO.id)
    const [rotta] = temiSuMisura(conLicenza([{ ...BOSCO, ricetta: { ...RICETTA, sfondo: 'marmo' } }]))
    expect(rotta).not.toHaveProperty('ricetta')
    expect(stileDelTema(rotta)).toBe('deco')
    const usato = patchUsaTema(conLicenza([BOSCO]), conRicetta)
    expect(usato).toMatchObject({ stile_menu: BOSCO.id, tema_menu: BOSCO.id })
    expect(usato).not.toHaveProperty('stili_ricetta')
  })

  // La ricetta la portano solo i temi su misura: un tema del catalogo usa
  // uno stile, eventualmente a ricetta, per id.
  it('un tema del catalogo non porta una ricetta sua', () => {
    expect(leggiTema({ ...BOSCO, id: 'catalogo' })).not.toHaveProperty('ricetta')
  })
})

// UN TEMA DEL CATALOGO CON UNO STILE A RICETTA (REQ-MENU-031): la regia
// pubblica stili e temi insieme, e un tema può usare uno stile dello stesso
// catalogo. Un'app che non conosce lo stile scarta il tema.
describe('i temi con uno stile a ricetta', () => {
  const OSTERIA = { id: 'osteria', nome: 'Osteria', ricetta: RICETTA }
  const TRATTORIA = { id: 'trattoria', nome: 'Trattoria', tavolozza: { base: 'crema' }, stile: 'osteria' }

  it('lo stile dello stesso catalogo lo fa accettare; senza, si scarta', () => {
    expect(leggiCatalogo({ temi: [TRATTORIA], stili: [OSTERIA] }).map((t) => t.id)).toEqual(['trattoria'])
    expect(leggiCatalogo({ temi: [TRATTORIA] })).toEqual([])
  })

  it('«Usa» installa anche lo stile, con la sua copia', () => {
    ricordaStili(leggiStiliDelCatalogo({ stili: [OSTERIA] }))
    const [t] = leggiCatalogo({ temi: [TRATTORIA], stili: [OSTERIA] })
    const usato = patchUsaTema({}, t)
    expect(usato).toMatchObject({ stile_menu: 'osteria', tema_menu: 'trattoria' })
    expect(usato.stili_ricetta.map((s) => s.id)).toEqual(['osteria'])
    // Installato, il tema si legge anche dalle impostazioni.
    expect(temiInstallati(usato).map((x) => x.id)).toEqual(['trattoria'])
  })
})
