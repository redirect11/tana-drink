// @vitest-environment happy-dom
'use strict'

// IL RITAGLIO DELLA FOTO NELLA SCHEDA DEL PRODOTTO (REQ-MENU-039). Flavio,
// 12/11/2026: «quando si carica la foto dovrebbe apparire il selezionatore
// della foto… tagliare, ingrandire, rimpicciolire, e poi salvare le
// modifiche e poi dopo salvare proprio il prodotto». Prima la foto andava
// com'era: tre foto di siti diversi uscivano di tre misure diverse nel menù.
//
// Il browser di prova non disegna: la foto «si carica» a mano (le sue
// misure e l'evento) e il canvas che prepara la foto ritagliata è finto. I
// conti del ritaglio li prova tests/unit/ritaglioFoto.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
// Il prezzo consigliato della scheda legge le impostazioni del locale: qui
// non servono, e senza il database finto Firebase avvisa a metà di un test.
vi.mock('../../src/lib/api.js', () => ({
  subscribeSettings: (cb) => {
    cb({})
    return () => {}
  },
  DEFAULT_SETTINGS: {},
}))

import DrinkForm from '../../src/components/DrinkForm.jsx'
import RitaglioFoto from '../../src/components/RitaglioFoto.jsx'

const fotoAlta = () => new File(['x'], 'naked-and-famous.png', { type: 'image/png' })

// Il browser di prova non sa caricare un'immagine: gliela si dà a mano, con
// le misure della foto stretta e alta di Flavio.
function caricaLaFoto(larghezza = 400, altezza = 1200) {
  const img = document.querySelector('.ritaglio-cornice img')
  Object.defineProperty(img, 'naturalWidth', { value: larghezza, configurable: true })
  Object.defineProperty(img, 'naturalHeight', { value: altezza, configurable: true })
  fireEvent.load(img)
  return img
}

let disegnata
beforeEach(() => {
  let n = 0
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => `blob:prova-${++n}`), revokeObjectURL: vi.fn() })
  disegnata = null
  // Il canvas finto: ricorda cosa gli si disegna e restituisce un JPEG.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    fillRect: vi.fn(),
    set fillStyle(_v) {},
    drawImage: (...a) => (disegnata = a.slice(1)),
  }))
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb, tipo) {
    cb(new Blob(['ritagliata'], { type: tipo }))
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('il riquadro del ritaglio', () => {
  it('la foto parte riempiendo la cornice, centrata', () => {
    render(<RitaglioFoto file={fotoAlta()} onConferma={vi.fn()} onAnnulla={vi.fn()} />)
    const img = caricaLaFoto()
    // Cornice da 320: la foto larga 320, alta il triplo, metà sopra e metà sotto.
    expect(img.style.width).toBe('320px')
    expect(img.style.height).toBe('960px')
    expect(img.style.top).toBe('-320px')
  })

  it('il cursore rimpicciolisce fino a vedere la foto intera', () => {
    render(<RitaglioFoto file={fotoAlta()} onConferma={vi.fn()} onAnnulla={vi.fn()} />)
    const img = caricaLaFoto()
    fireEvent.change(screen.getByLabelText('Ingrandimento'), { target: { value: '1' } })
    expect(img.style.height).toBe('320px')
    expect(img.style.width).toMatch(/^106\.6/)
  })

  it('trascinando si inquadra, senza far scappare la foto', () => {
    render(<RitaglioFoto file={fotoAlta()} onConferma={vi.fn()} onAnnulla={vi.fn()} />)
    const img = caricaLaFoto()
    const cornice = screen.getByTestId('cornice-ritaglio')
    fireEvent.pointerDown(cornice, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(cornice, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(cornice, { pointerId: 1 })
    // Scesa di 100: si vede di più la parte alta del bicchiere.
    expect(img.style.top).toBe('-220px')
    // Ancora giù di molto: si ferma col bordo alto della foto sul bordo della cornice.
    fireEvent.pointerDown(cornice, { pointerId: 1, clientX: 100, clientY: 0 })
    fireEvent.pointerMove(cornice, { pointerId: 1, clientX: 100, clientY: 900 })
    expect(img.style.top).toBe('0px')
  })

  it('«Usa questa foto» dà la foto ritagliata, quadrata, in JPEG', async () => {
    const onConferma = vi.fn()
    render(<RitaglioFoto file={fotoAlta()} onConferma={onConferma} onAnnulla={vi.fn()} />)
    caricaLaFoto()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Usa questa foto' }))
    const data = onConferma.mock.calls[0][0]
    expect(data).toBeInstanceOf(File)
    expect(data.type).toBe('image/jpeg')
    // Disegnata alla misura dell'immagine salvata: 1000 di lato, il triplo in altezza.
    expect(disegnata).toEqual([0, -1000, 1000, 3000])
  })

  // Il ritaglio non deve mai impedire di salvare il prodotto.
  it('se il browser non sa preparare la foto ritagliata, si tiene quella scelta', async () => {
    HTMLCanvasElement.prototype.getContext.mockImplementation(() => null)
    const onConferma = vi.fn()
    const scelta = fotoAlta()
    render(<RitaglioFoto file={scelta} onConferma={onConferma} onAnnulla={vi.fn()} />)
    caricaLaFoto()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Usa questa foto' }))
    expect(onConferma).toHaveBeenCalledWith(scelta)
  })
})

describe('nella scheda del prodotto', () => {
  const mostra = (onSave = vi.fn()) => {
    render(
      <DrinkForm
        initial={{ name: 'Naked & Famous', price: 9, available: true, recipe_items: [] }}
        categories={[]}
        inventory={[]}
        onCreateCategory={vi.fn()}
        onCancel={vi.fn()}
        onSave={onSave}
      />
    )
    return onSave
  }
  const scegli = (file) => act(() => fireEvent.change(document.getElementById('photo'), { target: { files: [file] } }))

  it('scelta una foto si apre il ritaglio, e la foto ritagliata diventa l’anteprima', async () => {
    mostra()
    await scegli(fotoAlta())
    expect(screen.getByRole('dialog', { name: 'Ritaglia la foto' })).toBeInTheDocument()
    expect(screen.queryByAltText('Anteprima drink')).toBeNull()
    caricaLaFoto()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Usa questa foto' }))
    expect(screen.queryByRole('dialog', { name: 'Ritaglia la foto' })).toBeNull()
    expect(screen.getByAltText('Anteprima drink')).toBeInTheDocument()
  })

  it('«Annulla» lascia la scheda com’era', async () => {
    mostra()
    await scegli(fotoAlta())
    const ritaglio = screen.getByRole('dialog', { name: 'Ritaglia la foto' })
    await userEvent.setup().click(within(ritaglio).getByRole('button', { name: 'Annulla' }))
    expect(screen.queryByRole('dialog', { name: 'Ritaglia la foto' })).toBeNull()
    expect(screen.queryByAltText('Anteprima drink')).toBeNull()
  })

  it('«Ritaglia di nuovo» riparte dalla foto scelta, non da quella già tagliata', async () => {
    mostra()
    const scelta = fotoAlta()
    await scegli(scelta)
    caricaLaFoto()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Usa questa foto' }))
    await user.click(screen.getByRole('button', { name: 'Ritaglia di nuovo' }))
    // La foto nel ritaglio è di nuovo quella scelta: l'indirizzo creato per lei.
    expect(URL.createObjectURL).toHaveBeenLastCalledWith(scelta)
  })
})
