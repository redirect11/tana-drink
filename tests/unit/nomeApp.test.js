'use strict'

// IL NOME DELL'APP SEGUE CHI LA USA. Sul telefono di chi lavora l'icona in
// home deve dire di chi è: fra dieci app aperte «La Tana del Coniglio -
// bartender» si riconosce, e chi tiene due profili non li confonde.

import { describe, it, expect } from 'vitest'
import { nomeApp, nomeAppCorto, manifestConNome, NOME_BASE } from '../../src/lib/nomeApp.js'

describe('nomeApp', () => {
  it('a chi lavora aggiunge il suffisso del ruolo', () => {
    expect(nomeApp('admin')).toBe('La Tana del Coniglio - admin')
    expect(nomeApp('bartender')).toBe('La Tana del Coniglio - bartender')
    expect(nomeApp('staff')).toBe('La Tana del Coniglio - staff')
  })

  it('il cliente ha il nome nudo, e così chi non ha fatto accesso', () => {
    expect(nomeApp('cliente')).toBe(NOME_BASE)
    expect(nomeApp(null)).toBe(NOME_BASE)
    expect(nomeApp(undefined)).toBe(NOME_BASE)
    // Un ruolo mai visto è un cliente, come dice ruoli.js.
    expect(nomeApp('capo-supremo')).toBe(NOME_BASE)
  })

  it('il nome corto tiene il suffisso: sotto l’icona è l’unica parte che distingue', () => {
    expect(nomeAppCorto('staff')).toBe('La Tana - staff')
    expect(nomeAppCorto(null)).toBe('La Tana')
  })
})

describe('manifestConNome', () => {
  const pubblicato = {
    name: 'La Tana del Coniglio',
    short_name: 'La Tana',
    start_url: './',
    scope: './',
    icons: [{ src: 'icon-192.png', sizes: '192x192' }],
    theme_color: '#0e0e15',
  }

  it('riscrive nome e nome corto, lasciando stare il resto', () => {
    const m = manifestConNome(pubblicato, 'bartender', 'https://tana.example/app/manifest.webmanifest')
    expect(m.name).toBe('La Tana del Coniglio - bartender')
    expect(m.short_name).toBe('La Tana - bartender')
    expect(m.theme_color).toBe('#0e0e15')
  })

  // Il manifest riscritto viaggia come blob: un indirizzo relativo verrebbe
  // risolto contro blob:… e l'app installata partirebbe da nessuna parte.
  it('scrive per esteso avvio, ambito e icone', () => {
    const m = manifestConNome(pubblicato, 'staff', 'https://tana.example/app/manifest.webmanifest')
    expect(m.start_url).toBe('https://tana.example/app/')
    expect(m.scope).toBe('https://tana.example/app/')
    expect(m.icons[0].src).toBe('https://tana.example/app/icon-192.png')
  })

  it('regge un manifest senza icone', () => {
    const m = manifestConNome({ start_url: './' }, null, 'https://tana.example/')
    expect(m.icons).toEqual([])
    expect(m.name).toBe(NOME_BASE)
  })
})
