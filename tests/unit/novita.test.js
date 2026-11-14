'use strict'

// LE NOVITÀ DI UNA VERSIONE. L'app si aggiorna da sé mentre la si usa, e chi
// lavora se ne accorge solo perché qualcosa "è cambiato di posto". Le note
// vanno portate davanti una volta, e poi mai più.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cosaFareAllAvvio, sezioneChangelog, caricaChangelog } from '../../src/lib/novita.js'

describe('cosaFareAllAvvio', () => {
  // Non importa COME si è arrivati qui: banner toccato, app riaperta da un
  // terminale rimasto indietro, pagina ricaricata da zero. Se la build è
  // cambiata, le note si mostrano. Legarlo al tocco sul banner voleva dire
  // che il tablet lasciato acceso, che si aggiorna da solo, non le vedeva
  // mai — ed è proprio quello dove nessuno va a leggerle.
  it('build cambiata: le note si mostrano, comunque ci si sia arrivati', () => {
    expect(cosaFareAllAvvio({ build: 'b2', vista: 'b1' })).toBe('box')
  })

  it('stessa build di prima: non succede niente', () => {
    expect(cosaFareAllAvvio({ build: 'b2', vista: 'b2' })).toBe('niente')
  })

  // Un box di benvenuto con le note di rilascio non lo vuole nessuno: alla
  // prima apertura su un dispositivo nuovo si registra e basta.
  it('prima volta su questo dispositivo: silenzio', () => {
    expect(cosaFareAllAvvio({ build: 'b2', vista: null })).toBe('niente')
  })

  it('senza id di build (sviluppo) non si inventa niente', () => {
    expect(cosaFareAllAvvio({ build: '', vista: null })).toBe('niente')
  })
})

describe('sezioneChangelog', () => {
  const md = `# Cosa è cambiato

Le note di ogni versione.

---

## 1.4.0 — 13 agosto 2026

### Al banco

- La cosa nuova.

---

## 1.3.0 — 12 agosto 2026

- La cosa vecchia.
`

  it('prende il pezzo della versione chiesta, e solo quello', () => {
    const s = sezioneChangelog(md, 'v1.4.0')
    expect(s).toMatch(/1\.4\.0/)
    expect(s).toMatch(/La cosa nuova/)
    expect(s).not.toMatch(/La cosa vecchia/)
  })

  it('il numero si riconosce anche senza la v davanti', () => {
    expect(sezioneChangelog(md, '1.3.0')).toMatch(/La cosa vecchia/)
  })

  // Meglio le note di ieri che una finestra vuota.
  it('versione non trovata: torna la più recente', () => {
    expect(sezioneChangelog(md, 'v9.9.9')).toMatch(/La cosa nuova/)
  })

  it('senza changelog non esplode', () => {
    expect(sezioneChangelog('', 'v1.4.0')).toBe('')
    expect(sezioneChangelog(null, 'v1.4.0')).toBe('')
    expect(sezioneChangelog('nessun titolo qui', 'v1.4.0')).toBe('')
  })
})

// BUG-149, 14/11/2026: al primo avvio della 1.10.43 in produzione il box ha
// detto «non sono arrivate» con il file al suo posto. La prima richiesta
// dell'app è caduta nel cambio del service worker; una sola richiesta non
// basta per dire che le note non ci sono.
describe('il caricamento delle note riprova prima di arrendersi', () => {
  const risposta = (testo, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 404, text: () => Promise.resolve(testo) })
  const aspetta = vi.fn(() => Promise.resolve())
  afterEach(() => {
    vi.unstubAllGlobals()
    aspetta.mockClear()
  })

  it('la prima richiesta cade, la seconda arriva: le note ci sono', async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockImplementation(() => risposta('## 1.0 — oggi'))
    vi.stubGlobal('fetch', f)
    await expect(caricaChangelog({ aspetta })).resolves.toBe('## 1.0 — oggi')
    expect(f).toHaveBeenCalledTimes(2)
    expect(f).toHaveBeenCalledWith('/changelog.md', { cache: 'no-store' })
    expect(aspetta).toHaveBeenCalledWith(1000)
  })

  it('una risposta di errore, un file vuoto o senza versioni contano come non arrivati', async () => {
    const f = vi
      .fn()
      .mockImplementationOnce(() => risposta('', false))
      .mockImplementationOnce(() => risposta('   '))
      .mockImplementation(() => risposta('## 1.0 — oggi'))
    vi.stubGlobal('fetch', f)
    await expect(caricaChangelog({ aspetta })).resolves.toBe('## 1.0 — oggi')
    expect(aspetta.mock.calls.map((c) => c[0])).toEqual([1000, 3000])
  })

  // L'hosting risponde con la pagina dell'app a un file che non c'è: è un
  // 200, ma di note non ce n'è, e il box resterebbe a caricare per sempre.
  it('la pagina dell’app al posto delle note non conta come note', async () => {
    vi.stubGlobal('fetch', vi.fn(() => risposta('<!doctype html><html><body><div id="root"></div></body></html>')))
    await expect(caricaChangelog({ aspetta })).rejects.toThrow('Note senza versioni')
  })

  it('tre tentativi andati a vuoto: allora non ci sono', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', f)
    await expect(caricaChangelog({ aspetta })).rejects.toThrow('Failed to fetch')
    expect(f).toHaveBeenCalledTimes(3)
  })
})
