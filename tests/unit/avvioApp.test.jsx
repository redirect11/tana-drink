// @vitest-environment happy-dom
'use strict'

// L'AVVIO DELL'APP (src/main.jsx). Nei locali veri: progressivi, banner dei
// cookie, la configurazione riletta in sottofondo (REQ-FLOTTA-021) e prima
// schermata, subito: nessuno aspetta il file. Nella DEMO (REQ-FLOTTA-019) prima si
// caricano i dati di prova nella cache — così nessuna lista parte vuota —
// e solo dopo il resto; e il banner dei cookie non c'è, perché la demo non
// ha servizi di terzi.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { accendiDemo, spegniDemo } from '../helpers/demo.js'

let registro = []
let disegnato = null
const disegna = (el) => {
  disegnato = el
  registro.push('render')
}
vi.mock('react-dom/client', () => ({
  default: { createRoot: () => ({ render: disegna }) },
  createRoot: () => ({ render: disegna }),
}))
vi.mock('../../src/App.jsx', () => ({ default: () => null }))
vi.mock('../../src/lib/progressivi.js', () => ({ avviaProgressivi: () => registro.push('progressivi') }))
vi.mock('../../src/lib/cookieConsent.js', () => ({
  initCookieConsent: () => {
    registro.push('cookie')
    return Promise.resolve()
  },
}))
let senza = false
vi.mock('../../src/porte/configurazione.js', () => ({
  // Il file non arriva mai: la prima schermata non lo aspetta.
  seguiConfigurazione: () => {
    registro.push('configurazione')
    return () => {}
  },
  senzaBackend: () => senza,
}))
vi.mock('../../src/lib/passaggioRegia.js', () => ({ catturaCodiceRegia: () => registro.push('codice della regia') }))
vi.mock('../../src/components/NonCollegata.jsx', () => ({ default: () => null }))
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
  senza = false
  disegnato = null
})
afterEach(() => {
  spegniDemo()
  vi.unstubAllEnvs()
})

describe('l’avvio dell’app', () => {
  it('in un locale vero: progressivi, cookie, configurazione e prima schermata, subito', async () => {
    await avvia(false)
    expect(registro).toEqual(['codice della regia', 'progressivi', 'cookie', 'configurazione', 'render'])
  })

  // IL SITO SENZA BACKEND (REQ-FLOTTA-034): il sito uguale per tutti prima
  // del deploy, o un tablet che non ha ancora la configurazione. Niente
  // progressivi (si iscriverebbero a un progetto finto e cancellerebbero la
  // memoria della cassa aperta) e niente banner dei cookie; al posto
  // dell'app la schermata del sito non collegato; la configurazione si
  // segue, perché è da lì che arriva il collegamento. Il codice della regia
  // resta nell'indirizzo: la ricarica che arriva lo perderebbe.
  it('senza backend: solo la configurazione e la schermata del sito non collegato, niente che legga o scriva', async () => {
    senza = true
    vi.stubEnv('DEV', false)
    await avvia(false)
    expect(registro).toEqual(['configurazione', 'render'])
    const { default: NonCollegata } = await import('../../src/components/NonCollegata.jsx')
    expect(disegnato.props.children.type).toBe(NonCollegata)
  })

  it('nella demo: prima i dati di prova, poi il resto, senza il banner dei cookie né la configurazione', async () => {
    await avvia(true)
    await vi.waitFor(() => expect(registro).toEqual(['codice della regia', 'dati di prova: inizio']))
    finisciDati()
    await vi.waitFor(() => expect(registro).toEqual(['codice della regia', 'dati di prova: inizio', 'dati di prova: caricati', 'progressivi', 'render']))
  })
})
