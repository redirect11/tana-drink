'use strict'

// LO STILE DEL MENÙ DEI CLIENTI (REQ-MENU-021): «ovviamente il tema base
// lascialo». Senza scelta, o con una scelta che non esiste più, è il
// classico.

import { describe, it, expect } from 'vitest'
import {
  STILI_MENU,
  STILE_PREDEFINITO,
  stileMenu,
  stiliDisponibili,
  stileProvabile,
  stileInVista,
  vestePagine,
  temiInLicenza,
  disegniDelLocale,
  patchInstalla,
  patchDisinstalla,
  nomeStile,
  ricettaDelloStile,
  vesteDelloStile,
} from '../../src/lib/stileMenu.js'
import { leggiStile } from '../../src/lib/stiliRicetta.js'

describe('lo stile del menù', () => {
  it('il classico è il predefinito', () => {
    expect(STILE_PREDEFINITO).toBe('classico')
    expect(stileMenu({})).toBe('classico')
    expect(stileMenu(null)).toBe('classico')
    expect(stileMenu({ stile_menu: 'inesistente' })).toBe('classico')
  })

  // «Notte» è della licenza (REQ-LIC-010): l'utente, 02/11/2026, «sono
  // esclusive loro». Con `temi: ['notte']` si sceglie; senza, chi l'ha
  // scritto nelle impostazioni (anche dalla console) vede il classico.
  it('«Notte» si sceglie dove la licenza lo nomina', () => {
    expect(stileMenu({ stile_menu: 'notte', licenza: { moduli: {}, temi: ['notte'] } })).toBe('notte')
  })

  it('senza «Notte» nella licenza resta il classico', () => {
    expect(stileMenu({ stile_menu: 'notte' })).toBe('classico')
    expect(stileMenu({ stile_menu: 'notte', licenza: { moduli: {} } })).toBe('classico')
    expect(stileMenu({ stile_menu: 'notte', licenza: { moduli: {}, temi: 'notte' } })).toBe('classico')
  })

  it('gli stili disponibili: quelli di tutti, più quelli della licenza', () => {
    expect(stiliDisponibili({}).map((s) => s.id)).toEqual(['classico'])
    expect(stiliDisponibili({ licenza: { temi: ['notte'] } }).map((s) => s.id)).toEqual(['classico', 'notte'])
    expect(temiInLicenza({ licenza: { temi: ['notte', 3, null] } })).toEqual(['notte'])
  })
})

// I DISEGNI DEI DRINK SONO DEL LOCALE CHE HA «NOTTE» (REQ-LIC-013). L'utente,
// 04/11/2026: «sono solo per lo stile Notte che abbiamo fatto in esclusiva
// per la Tana», e «può riutilizzarli Flavio se cambia stile». Quindi la
// licenza decide, non lo stile in uso.
describe('i disegni dei drink', () => {
  const TANA = { licenza: { moduli: {}, temi: ['notte'] } }

  it('li ha il locale con «Notte» nella licenza, in qualunque stile', () => {
    expect(disegniDelLocale(TANA)).toBe(true)
    expect(disegniDelLocale({ ...TANA, stile_menu: 'giornale', stili_installati: ['giornale'] })).toBe(true)
    expect(disegniDelLocale({ ...TANA, stile_menu: 'classico' })).toBe(true)
  })

  it('gli altri locali no: né installando stili gratis né scrivendo «notte» a mano', () => {
    expect(disegniDelLocale({})).toBe(false)
    expect(disegniDelLocale(null)).toBe(false)
    expect(disegniDelLocale({ licenza: { moduli: {}, temi: [] } })).toBe(false)
    expect(disegniDelLocale({ stile_menu: 'notte', stili_installati: ['notte', 'giornale'] })).toBe(false)
  })
})

// GLI STILI GRATIS (REQ-MENU-022). L'utente, 02/11/2026: «per ora metterei
// un tot di temi gratis, escludiamo lo stile Notte», e «su quelli gratis non
// facciamo partire stripe ovviamente. Facciamo solo installare il tema».
describe('il catalogo degli stili gratis', () => {
  const GRATIS = ['lavagna', 'deco', 'riviera', 'giornale']

  // Il catalogo sono gli stili gratis (il Marketplace, MarketplaceTab.jsx):
  // gli esclusivi degli altri non ci sono, non si possono prendere.
  it('di partenza sono tutti nel catalogo, e nessuno si applica', () => {
    expect(STILI_MENU.filter((s) => s.gratis).map((s) => s.id)).toEqual(GRATIS)
    expect(stileMenu({ stile_menu: 'lavagna' })).toBe('classico')
  })

  it('installato, uno stile si sceglie e si applica', () => {
    const s = { ...patchInstalla({}, 'lavagna'), stile_menu: 'lavagna' }
    expect(s.stili_installati).toEqual(['lavagna'])
    expect(stiliDisponibili(s).map((x) => x.id)).toEqual(['classico', 'lavagna'])
    expect(stileMenu(s)).toBe('lavagna')
  })

  it('disinstallando quello in uso si torna al classico', () => {
    const s = { stili_installati: ['lavagna', 'deco'], stile_menu: 'lavagna' }
    expect(patchDisinstalla(s, 'lavagna')).toEqual({ stili_installati: ['deco'], stile_menu: 'classico' })
    expect(patchDisinstalla(s, 'deco')).toEqual({ stili_installati: ['lavagna'] })
  })

  it('«Notte» non si installa: è della licenza, e non è nel catalogo', () => {
    expect(patchInstalla({}, 'notte')).toBeNull()
    expect(STILI_MENU.filter((s) => s.gratis).some((s) => s.id === 'notte')).toBe(false)
    expect(stileMenu({ stile_menu: 'notte', stili_installati: ['notte'] })).toBe('classico')
  })

  it('si prova quello che si ha o che si può installare; un esclusivo degli altri no', () => {
    expect(stileProvabile({}, 'giornale')).toBe(true)
    expect(stileProvabile({}, 'classico')).toBe(true)
    expect(stileProvabile({}, 'notte')).toBe(false)
    expect(stileProvabile({ licenza: { temi: ['notte'] } }, 'notte')).toBe(true)
    expect(stileProvabile({}, 'inventato')).toBe(false)
  })

  it('ogni stile ha nome e descrizione da mostrare nelle impostazioni', () => {
    expect(STILI_MENU.map((s) => s.id)).toEqual(['classico', 'notte', 'meraviglie', 'carte', 'lavagna', 'deco', 'riviera', 'giornale'])
    for (const s of STILI_MENU) {
      expect(s.nome).toBeTruthy()
      expect(s.desc).toBeTruthy()
    }
  })
})

// «MERAVIGLIE» (REQ-MENU-027): l'altro stile esclusivo della Tana, alla
// Lewis Carroll. Come «Notte» sta nella licenza e porta i disegni; in più
// veste tutte le pagine dei clienti, non solo il menù.
describe('lo stile «Meraviglie»', () => {
  const TANA = { licenza: { moduli: {}, temi: ['notte', 'meraviglie'] } }

  it('è della licenza: non si installa, e senza resta il classico', () => {
    expect(patchInstalla({}, 'meraviglie')).toBeNull()
    expect(stileMenu({ stile_menu: 'meraviglie' })).toBe('classico')
    expect(stileMenu({ ...TANA, stile_menu: 'meraviglie' })).toBe('meraviglie')
    expect(stileProvabile({}, 'meraviglie')).toBe(false)
  })

  it('porta i disegni dei drink, come «Notte»', () => {
    expect(disegniDelLocale({ licenza: { temi: ['meraviglie'] } })).toBe(true)
  })

  it('veste anche le altre pagine; gli altri stili solo il menù', () => {
    expect(vestePagine('meraviglie')).toBe(true)
    for (const id of ['classico', 'notte', 'lavagna', 'giornale', 'inventato', null]) expect(vestePagine(id), id).toBe(false)
  })

  // Lo stile che si vede lo decide una funzione sola, per il menù e per
  // l'app che veste le altre pagine: due conti separati avrebbero dato a
  // chi prova uno stile il menù in uno e la home in un altro.
  it('lo stile in vista: chi lavora il classico, chi prova quello che prova, i clienti quello del locale', () => {
    const s = { ...TANA, stile_menu: 'meraviglie' }
    expect(stileInVista(s)).toBe('meraviglie')
    expect(stileInVista(s, { lavoro: true })).toBe('classico')
    expect(stileInVista(s, { prova: 'giornale' })).toBe('giornale')
    expect(stileInVista({}, { prova: 'meraviglie' })).toBe('classico')
    expect(stileInVista({ stile_menu: 'notte' }, { prova: 'meraviglie' })).toBe('classico')
  })
})

// GLI STILI A RICETTA (REQ-MENU-031): non scritti qui ma arrivati dalla
// regia, e disegnati dal motore. Il locale li ha quando li installa (con la
// loro copia) o quando installa il tema su misura che ne porta uno.
describe('gli stili a ricetta', () => {
  const OSTERIA = leggiStile({
    id: 'osteria',
    nome: 'Osteria',
    ricetta: { versione: 1, caratteri: { titolo: 'libre-baskerville', voce: 'libre-baskerville', testo: 'georgia' }, sfondo: 'carta' },
  })

  it('installato, il locale lo ha e lo usa; non installato resta il classico', () => {
    const s = { stili_ricetta: [OSTERIA], stile_menu: 'osteria' }
    expect(stiliDisponibili(s).map((x) => x.id)).toContain('osteria')
    expect(stileMenu(s)).toBe('osteria')
    expect(nomeStile('osteria', s)).toBe('Osteria')
    expect(ricettaDelloStile(s, 'osteria')).toMatchObject({ sfondo: 'carta' })
    expect(stileMenu({ stile_menu: 'osteria' })).toBe(STILE_PREDEFINITO)
  })

  it('quello di un tema su misura installato, con l’id del tema', () => {
    const s = { temi_installati: [{ id: 'su-misura-bosco', nome: 'Bosco', su_misura: true, ricetta: OSTERIA.ricetta }], stile_menu: 'su-misura-bosco' }
    expect(stileMenu(s)).toBe('su-misura-bosco')
  })

  it('si installa dal catalogo con la sua copia, e si disinstalla tornando al classico', () => {
    const patch = patchInstalla({}, 'osteria', [OSTERIA])
    expect(patch).toEqual({ stili_ricetta: [OSTERIA] })
    expect(patchInstalla({}, 'inventato', [OSTERIA])).toBeNull()
    expect(patchInstalla({ stili_ricetta: [OSTERIA] }, 'osteria', [OSTERIA])).toBeNull()
    expect(patchDisinstalla({ stili_ricetta: [OSTERIA], stile_menu: 'osteria' }, 'osteria')).toEqual({
      stili_ricetta: [],
      stile_menu: STILE_PREDEFINITO,
    })
  })

  it('si prova se è del locale; uno sconosciuto no', () => {
    expect(stileProvabile({ stili_ricetta: [OSTERIA] }, 'osteria')).toBe(true)
    expect(stileProvabile({}, 'osteria')).toBe(false)
    expect(stileInVista({ stili_ricetta: [OSTERIA] }, { lavoro: true, prova: 'osteria' })).toBe('osteria')
  })

  // La stessa veste per il menù, le vetrine e l'assaggio.
  it('la veste: il motore con la ricetta, o la classe dello stile dell’app', () => {
    const conRicetta = vesteDelloStile({ stili_ricetta: [OSTERIA] }, 'osteria')
    expect(conRicetta.className).toBe('stile-ricetta')
    expect(conRicetta.attributi).toEqual({ 'data-sfondo': 'carta' })
    expect(conRicetta.style['--stile-titolo']).toMatch(/Libre Baskerville/)
    expect(vesteDelloStile({}, 'deco')).toEqual({ className: 'stile-deco', attributi: {}, style: {} })
    expect(vesteDelloStile({}, 'classico').className).toBe('')
  })
})
