'use strict'

// GLI SPECIAL DELLA CASA (REQ-MENU-018). L'utente, 29/10/2026, per Flavio:
// un menù a tavola con un QR che apre «solo gli special drink», e il menù
// normale con «in alto a tutto un carousel degli special drink».

import { describe, it, expect } from 'vitest'
import {
  drinkSpeciali,
  illustrazioneUrl,
  immagineVoce,
  segnapostoDrink,
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

  // Tratto bianco sui temi scuri (di partenza), scuro sui chiari: l'utente,
  // 29/10/2026, «disegni bianchi su fondo scuro».
  it('sul tema chiaro si usa la versione col tratto scuro', () => {
    expect(illustrazioneUrl('rosa', '/', { chiaro: true })).toBe('/illustrazioni/alice/rosa-chiaro.svg')
    expect(immagineVoce({ illustrazione: 'rosa' }, '/', { chiaro: true, disegni: true })).toBe('/illustrazioni/alice/rosa-chiaro.svg')
    expect(immagineVoce({ image_url: 'https://x/foto.jpg', illustrazione: 'rosa' }, '/', { chiaro: true, disegni: true })).toBe('https://x/foto.jpg')
  })

  // Il disegno composto (REQ-MENU-018, 29/10/2026): bicchiere, colore e
  // decorazione diventano un'immagine generata.
  it('un disegno composto diventa un’immagine generata, nelle due versioni', () => {
    const d = { illustrazione: { bicchiere: 'coppa', colore: 'rosso', decorazione: 'cuori' } }
    const scuro = immagineVoce(d, '/', { disegni: true })
    expect(scuro).toMatch(/^data:image\/svg\+xml/)
    expect(immagineVoce(d, '/', { chiaro: true, disegni: true })).not.toBe(scuro)
    expect(immagineVoce({ ...d, image_url: 'https://x/foto.jpg' }, '/', { disegni: true })).toBe('https://x/foto.jpg')
  })

  it('la foto vince sull’illustrazione', () => {
    expect(immagineVoce({ image_url: 'https://x/foto.jpg', illustrazione: 'rosa' }, '/', { disegni: true })).toBe('https://x/foto.jpg')
    expect(immagineVoce({ illustrazione: 'rosa' }, '/', { disegni: true })).toBe('/illustrazioni/alice/rosa.svg')
    expect(immagineVoce({}, '/', { disegni: true })).toBeNull()
  })

  // I DISEGNI SONO DEL LOCALE CHE HA «NOTTE» (REQ-LIC-013, 04/11/2026). Chi
  // chiama senza dirlo non li regala: di partenza, niente disegni. Le foto
  // le carica chiunque e si vedono sempre.
  it('senza i disegni del locale resta solo la foto', () => {
    const composto = { illustrazione: { bicchiere: 'coppa', colore: 'rosso', decorazione: 'cuori' } }
    expect(immagineVoce(composto)).toBeNull()
    expect(immagineVoce({ illustrazione: 'rosa' }, '/', { disegni: false })).toBeNull()
    expect(immagineVoce({ ...composto, image_url: 'https://x/foto.jpg' })).toBe('https://x/foto.jpg')
  })

  // Al posto del logo, per chi non ha né foto né disegno: l'utente,
  // 04/11/2026, «un bicchiere neutro».
  it('il segnaposto è un bicchiere al tratto, nelle due versioni', () => {
    const scuro = segnapostoDrink()
    expect(scuro).toMatch(/^data:image\/svg\+xml/)
    expect(decodeURIComponent(scuro)).toContain('<path')
    expect(segnapostoDrink({ chiaro: true })).not.toBe(scuro)
    expect(segnapostoDrink()).toBe(scuro)
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
