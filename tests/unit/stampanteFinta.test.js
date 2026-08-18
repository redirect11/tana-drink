// @vitest-environment happy-dom
'use strict'

// LA STAMPANTE FINTA, SOLO IN LOCALE. Da un computer di sviluppo
// l'apparecchio del bar non si raggiunge, e ogni modifica a comande e
// scontrini si provava a occhio nel codice. Sull'ambiente di TEST invece
// non si accende: lì ci si collega alla stampante vera, ed è il posto dove
// provarla davvero.

import { describe, it, expect, vi } from 'vitest'
import { stampanteFintaAttiva, creaStampanteFinta } from '../../src/lib/stampanteFinta.js'

describe('quando si accende la stampante finta', () => {
  it('col server di sviluppo', () => {
    expect(stampanteFintaAttiva({ DEV: true })).toBe(true)
  })

  it('con l’app compilata «come il server», in locale', () => {
    expect(stampanteFintaAttiva({ MODE: 'locale' })).toBe(true)
  })

  it('con gli emulatori: se il database è finto, lo è anche il bar', () => {
    expect(stampanteFintaAttiva({ VITE_USE_FIREBASE_EMULATOR: 'true' })).toBe(true)
  })

  it('NON sull’ambiente di test: lì si prova la stampante vera', () => {
    expect(stampanteFintaAttiva({ VITE_APP_ENV: 'test', PROD: true })).toBe(false)
  })

  it('NON in produzione', () => {
    expect(stampanteFintaAttiva({ VITE_APP_ENV: 'production', PROD: true })).toBe(false)
  })

  it('si può forzare, in un verso e nell’altro', () => {
    expect(stampanteFintaAttiva({ VITE_STAMPANTE_FINTA: 'true', PROD: true })).toBe(true)
    expect(stampanteFintaAttiva({ VITE_STAMPANTE_FINTA: 'false', DEV: true })).toBe(false)
  })
})

describe('quello che esce dalla stampante finta', () => {
  // LA FINESTRA SI GUARDA, NON SI STAMPA. Prima partiva da sola la stampa
  // in PDF: per leggere una comanda si passava ogni volta da una finestra
  // di sistema, con un file da buttare a ogni prova. Chi vuole la carta ha
  // il suo tasto dentro la pagina.
  it('mostra il facsimile e NON fa partire la stampa da sola', () => {
    const stampa = vi.fn()
    const doc = { write: vi.fn(), close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue({ document: doc, focus: vi.fn(), print: stampa })
    vi.useFakeTimers()

    const p = creaStampanteFinta('Comanda')
    p.addTextAlign(p.ALIGN_CENTER)
    p.addText('LA TANA\n')
    p.addTextAlign(p.ALIGN_LEFT)
    p.addText('2  Negroni\n')
    p.addCut()
    p.send()

    vi.runAllTimers()
    const scritto = doc.write.mock.calls[0][0]
    expect(scritto).toContain('LA TANA')
    expect(scritto).toContain('Negroni')
    expect(scritto).toContain('facsimile')
    expect(stampa).not.toHaveBeenCalled()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('il logo, se c’è, sta in cima al facsimile', () => {
    const doc = { write: vi.fn(), close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue({ document: doc, focus: vi.fn(), print: vi.fn() })
    const p = creaStampanteFinta('Scontrino')
    p.addImageUrl('/logo.png')
    p.addText('LA TANA\n')
    p.send()
    const scritto = doc.write.mock.calls[0][0]
    expect(scritto).toContain('<img src="/logo.png"')
    vi.restoreAllMocks()
  })

  it('avvisa chi ascolta, come farebbe quella vera', () => {
    vi.spyOn(window, 'open').mockReturnValue(null) // finestra bloccata
    const p = creaStampanteFinta('Scontrino')
    const visto = vi.fn()
    p.onreceive = visto
    p.addText('prova\n')
    p.send()
    expect(visto).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    vi.restoreAllMocks()
  })

  it('dopo l’invio riparte pulita: due comande non si sommano', () => {
    const doc = { write: vi.fn(), close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue({ document: doc, focus: vi.fn(), print: vi.fn() })
    vi.useFakeTimers()
    const p = creaStampanteFinta('Comanda')
    p.addText('prima\n')
    p.send()
    p.addText('seconda\n')
    p.send()
    vi.runAllTimers()
    expect(doc.write.mock.calls[1][0]).not.toContain('prima')
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
})
