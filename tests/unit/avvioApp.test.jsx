// @vitest-environment happy-dom
'use strict'

// L'AVVIO DELL'APP (src/main.jsx). Nei locali veri: progressivi, banner dei
// cookie e prima schermata, subito. Nella DEMO (REQ-FLOTTA-019) prima si
// caricano i dati di prova nella cache — così nessuna lista parte vuota —
// e solo dopo il resto; e il banner dei cookie non c'è, perché la demo non
// ha servizi di terzi.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { accendiDemo, spegniDemo } from '../helpers/demo.js'

let registro = []
vi.mock('react-dom/client', () => ({
  default: { createRoot: () => ({ render: () => registro.push('render') }) },
  createRoot: () => ({ render: () => registro.push('render') }),
}))
vi.mock('../../src/App.jsx', () => ({ default: () => null }))
vi.mock('../../src/lib/progressivi.js', () => ({ avviaProgressivi: () => registro.push('progressivi') }))
vi.mock('../../src/lib/cookieConsent.js', () => ({
  initCookieConsent: () => {
    registro.push('cookie')
    return Promise.resolve()
  },
}))
let finisciDati
vi.mock('../../src/demo/avvio.js', () => ({
  avviaDemo: () => {
    registro.push('dati di prova: inizio')
    return new Promise((r) => {
      finisciDati = () => {
        registro.push('dati di prova: caricati')
        r()
      }
    })
  },
}))

async function avvia(demo) {
  vi.resetModules()
  accendiDemo(demo)
  document.body.innerHTML = '<div id="root"></div>'
  await import('../../src/main.jsx')
}

beforeEach(() => {
  registro = []
  finisciDati = null
})
afterEach(() => spegniDemo())

describe('l’avvio dell’app', () => {
  it('in un locale vero: progressivi, cookie e prima schermata, subito', async () => {
    await avvia(false)
    expect(registro).toEqual(['progressivi', 'cookie', 'render'])
  })

  it('nella demo: prima i dati di prova, poi il resto, senza il banner dei cookie', async () => {
    await avvia(true)
    await vi.waitFor(() => expect(registro).toEqual(['dati di prova: inizio']))
    finisciDati()
    await vi.waitFor(() => expect(registro).toEqual(['dati di prova: inizio', 'dati di prova: caricati', 'progressivi', 'render']))
  })
})
