// @vitest-environment happy-dom
'use strict'

// ── LA COMPOSIZIONE DEL MENÙ (REQ-MENU-025) ───────────────────────────
//
// L'utente, 04/11/2026: «la carta dei clienti è il menù stesso, non è una
// versione diversa del menù, e rientra nello stile del menù. Possiamo
// proporre varie carte, dove quella di default è il menù che già c'è», e
// «facciamo un metodo di selezione come per il marketplace». I nomi li ha
// scelti lui: la VESTE è tavolozza, stile e composizione; la composizione
// è «Classica» (il catalogo per categorie) o «Di sala» (la carta scritta per
// il cliente).

import { describe, it, expect } from 'vitest'
import {
  COMPOSIZIONI_MENU,
  composizioneMenu,
  composizioniDisponibili,
  composizioneProvabile,
  patchInstallaComposizione,
  patchDisinstallaComposizione,
  patchUsaComposizione,
  nomeComposizione,
} from '../../src/lib/composizioneMenu.js'
import { leggiTema, patchUsaTema, catalogo } from '../../src/lib/marketplaceTemi.js'

describe('le composizioni', () => {
  it('oggi sono due: la classica di tutti, «Di sala» gratis', () => {
    expect(COMPOSIZIONI_MENU.map((c) => [c.id, c.nome])).toEqual([
      ['classica', 'Classica'],
      ['sala', 'Di sala'],
    ])
    expect(nomeComposizione('sala')).toBe('Di sala')
  })

  it('di suo il menù è composto alla classica, come è sempre stato', () => {
    expect(composizioneMenu({})).toBe('classica')
    expect(composizioneMenu(null)).toBe('classica')
    expect(composizioniDisponibili({}).map((c) => c.id)).toEqual(['classica'])
  })

  // Scritta a mano senza installarla, o con un id che non esiste: resta la
  // classica, invece di un menù composto da niente.
  it('«Di sala» vale solo installata; un id sconosciuto è la classica', () => {
    expect(composizioneMenu({ composizione_menu: 'sala' })).toBe('classica')
    expect(composizioneMenu({ composizioni_installate: ['sala'], composizione_menu: 'sala' })).toBe('sala')
    expect(composizioneMenu({ composizioni_installate: ['sala', 'boh'], composizione_menu: 'boh' })).toBe('classica')
  })

  it('si prova anche senza averla installata', () => {
    expect(composizioneProvabile({}, 'sala')).toBe(true)
    expect(composizioneProvabile({}, 'classica')).toBe(true)
    expect(composizioneProvabile({}, 'boh')).toBe(false)
  })
})

describe('installare, usare, disinstallare', () => {
  it('«Usa» la installa e la mette in uso in un gesto', () => {
    expect(patchUsaComposizione({}, 'sala')).toEqual({ composizioni_installate: ['sala'], composizione_menu: 'sala' })
    expect(patchInstallaComposizione({ composizioni_installate: ['sala'] }, 'sala')).toEqual({
      composizioni_installate: ['sala'],
    })
  })

  it('la classica non si installa né si toglie: c’è sempre', () => {
    expect(patchInstallaComposizione({}, 'classica')).toBeNull()
    expect(patchUsaComposizione({}, 'classica')).toEqual({ composizione_menu: 'classica' })
  })

  // Le sezioni e le voci di sala restano scritte: reinstallandola si ritrova
  // la carta com'era.
  it('disinstallando quella in uso si torna alla classica', () => {
    const settings = { composizioni_installate: ['sala'], composizione_menu: 'sala' }
    expect(patchDisinstallaComposizione(settings, 'sala')).toEqual({
      composizioni_installate: [],
      composizione_menu: 'classica',
    })
  })
})

// LA VESTE PORTA ANCHE LA COMPOSIZIONE, se la dice. Una veste che non la
// dice lascia quella scelta dal locale: le vesti di prima non devono
// rimettere la classica a chi ha compilato la carta di sala.
describe('la composizione nella veste', () => {
  const base = { id: 'sala-notturna', nome: 'Sala notturna', tavolozza: { base: 'chiaro' }, stile: 'classico' }

  it('si legge se è conosciuta, e scarta la veste se non lo è', () => {
    expect(leggiTema({ ...base, composizione: 'sala' }).composizione).toBe('sala')
    expect(leggiTema(base)).not.toHaveProperty('composizione')
    expect(leggiTema({ ...base, composizione: 'a-sorpresa' })).toBeNull()
  })

  it('«Usa» mette in uso anche la composizione, installandola', () => {
    const patch = patchUsaTema({}, leggiTema({ ...base, composizione: 'sala' }))
    expect(patch).toMatchObject({ composizioni_installate: ['sala'], composizione_menu: 'sala', stile_menu: 'classico' })
  })

  it('una veste senza composizione non tocca quella del locale', () => {
    const patch = patchUsaTema({ composizioni_installate: ['sala'], composizione_menu: 'sala' }, leggiTema(base))
    expect(patch).not.toHaveProperty('composizione_menu')
  })

  it('nel catalogo, una veste con una composizione provabile si vede', () => {
    const v = leggiTema({ ...base, composizione: 'sala' })
    expect(catalogo({}, [v]).map((t) => t.id)).toContain('sala-notturna')
  })
})
