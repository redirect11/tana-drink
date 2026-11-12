// IL RITAGLIO DELLA FOTO DI UN PRODOTTO (REQ-MENU-039), la parte di conti.
// Flavio, 12/11/2026: tre foto prese da siti diversi uscivano nel menù di
// misure e inquadrature diverse; «serve un qualche cosa che mi permette di
// ritagliarle… tagliare, ingrandire, rimpicciolire». Qui si prova come la
// foto sta dentro la cornice quadrata e cosa finisce nell'immagine salvata:
// i gesti (trascinare, ingrandire) li prova il test del componente.

import { describe, it, expect } from 'vitest'
import {
  zoomIniziale,
  zoomMinimo,
  ZOOM_MASSIMO,
  disposizione,
  trattieni,
  versoLaFoto,
} from '../../src/lib/ritaglioFoto.js'

const ALTA = { larghezza: 400, altezza: 1200 } // la foto stretta e alta di Naked & Famous
const LARGA = { larghezza: 1600, altezza: 800 }
const CORNICE = 300

describe('la foto nella cornice', () => {
  it('all’inizio la riempie tutta, centrata: è il taglio più probabile', () => {
    const z = zoomIniziale(ALTA)
    const d = disposizione(ALTA, { zoom: z, dx: 0, dy: 0 }, CORNICE)
    // Il lato corto riempie la cornice; quello lungo sborda, metà sopra e metà sotto.
    expect(d.w).toBeCloseTo(CORNICE)
    expect(d.h).toBeCloseTo(CORNICE * 3)
    expect(d.x).toBeCloseTo(0)
    expect(d.y).toBeCloseTo(-CORNICE)
  })

  // «Rimpicciolire»: si può tornare a vedere la foto intera.
  it('rimpicciolendo al minimo si vede la foto intera, centrata', () => {
    expect(zoomMinimo).toBe(1)
    const d = disposizione(ALTA, { zoom: 1, dx: 0, dy: 0 }, CORNICE)
    expect(d.h).toBeCloseTo(CORNICE)
    expect(d.w).toBeCloseTo(CORNICE / 3)
    expect(d.x).toBeCloseTo(CORNICE / 3)
    expect(d.y).toBeCloseTo(0)
  })

  it('ingrandire ha un tetto', () => {
    expect(ZOOM_MASSIMO).toBeGreaterThan(zoomIniziale(LARGA))
  })
})

describe('trascinando, la foto non scappa', () => {
  it('quando sborda, i suoi bordi non entrano nella cornice', () => {
    const z = zoomIniziale(LARGA) // alta quanto la cornice, larga il doppio
    // Spostata di molto a destra: si ferma quando il bordo sinistro tocca la cornice.
    const p = trattieni(LARGA, { zoom: z, dx: 1000, dy: 50 }, CORNICE)
    expect(p.dx).toBeCloseTo(CORNICE / 2)
    // In verticale non sborda: resta al centro.
    expect(p.dy).toBeCloseTo(0)
  })

  it('quando è più piccola della cornice, non ne esce', () => {
    const p = trattieni(ALTA, { zoom: 1, dx: 1000, dy: 0 }, CORNICE)
    const d = disposizione(ALTA, p, CORNICE)
    expect(d.x + d.w).toBeCloseTo(CORNICE)
  })

  it('lo zoom resta fra il minimo e il tetto', () => {
    expect(trattieni(ALTA, { zoom: 0.2, dx: 0, dy: 0 }, CORNICE).zoom).toBe(zoomMinimo)
    expect(trattieni(ALTA, { zoom: 99, dx: 0, dy: 0 }, CORNICE).zoom).toBe(ZOOM_MASSIMO)
  })
})

describe('l’immagine salvata', () => {
  // Quello che si vede nella cornice, alla misura dell'immagine salvata:
  // la cornice da 300 diventa un quadrato da 1000.
  it('è quello che si vede nella cornice, alla misura finale', () => {
    const z = zoomIniziale(ALTA)
    const d = versoLaFoto(ALTA, { zoom: z, dx: 0, dy: 0 }, CORNICE, 1000)
    expect(d.w).toBeCloseTo(1000)
    expect(d.h).toBeCloseTo(3000)
    expect(d.y).toBeCloseTo(-1000)
  })

  it('una foto non ancora caricata non dà niente da disegnare', () => {
    expect(disposizione({ larghezza: 0, altezza: 0 }, { zoom: 1, dx: 0, dy: 0 }, CORNICE)).toBeNull()
  })
})
