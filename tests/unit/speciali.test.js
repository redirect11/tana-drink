'use strict'

// GLI SPECIAL DELLA CASA (REQ-MENU-018). L'utente, 29/10/2026, per Flavio:
// un menù a tavola con un QR che apre «solo gli special drink», e il menù
// normale con «in alto a tutto un carousel degli special drink».

import { describe, it, expect } from 'vitest'
import {
  drinkSpeciali,
  illustrazioneUrl,
  immagineVoce,
  conParametri,
  ILLUSTRAZIONI,
  PERCORSO_SPECIALI,
} from '../../src/lib/speciali.js'

describe('gli special', () => {
  it('sono le voci col segno, in ordine di nome', () => {
    const d = [
      { id: 'a', name: 'Tè dei matti', speciale: true },
      { id: 'b', name: 'Negroni' },
      { id: 'c', name: 'Bevimi', speciale: true },
      { id: 'd', name: 'Spritz', speciale: false },
    ]
    expect(drinkSpeciali(d).map((x) => x.id)).toEqual(['c', 'a'])
  })

  it('il menù Special sta sotto /menu', () => {
    expect(PERCORSO_SPECIALI).toBe('/menu/special')
  })
})

describe('le immagini', () => {
  it('un’illustrazione pronta ha il suo indirizzo, un id sbagliato no', () => {
    expect(illustrazioneUrl('stregatto')).toBe('/illustrazioni/alice/stregatto.svg')
    expect(illustrazioneUrl('stregatto', '/app/')).toBe('/app/illustrazioni/alice/stregatto.svg')
    expect(illustrazioneUrl('drago')).toBeNull()
    expect(illustrazioneUrl(null)).toBeNull()
  })

  it('la foto vince sull’illustrazione', () => {
    expect(immagineVoce({ image_url: 'https://x/foto.jpg', illustrazione: 'rosa' })).toBe('https://x/foto.jpg')
    expect(immagineVoce({ illustrazione: 'rosa' })).toBe('/illustrazioni/alice/rosa.svg')
    expect(immagineVoce({})).toBeNull()
  })

  it('ci sono otto illustrazioni, ognuna con un nome', () => {
    expect(ILLUSTRAZIONI).toHaveLength(8)
    for (const i of ILLUSTRAZIONI) expect(i.nome).toBeTruthy()
  })
})

describe('da un menù all’altro', () => {
  it('passano il tavolo e il gruppo del QR, e l’anteprima del cliente', () => {
    const p = new URLSearchParams('tavolo=5&group=g1&vista=cliente&utm=x')
    expect(conParametri('/menu/special', p)).toBe('/menu/special?tavolo=5&group=g1&vista=cliente')
    expect(conParametri('/menu', new URLSearchParams(''))).toBe('/menu')
  })
})
