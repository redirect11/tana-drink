// @vitest-environment happy-dom
'use strict'

// I PREZZI NEL MENÙ DEI CLIENTI (REQ-MENU-038). Flavio, 11/11/2026: «togliere
// il simbolo dell'euro dal menù dei clienti… 8 euro, 8. 3,50 euro, 3,5».
// Daniele: un'impostazione del locale, con quello di Flavio di partenza.
//
// Il prezzo di una voce compare in sette punti, in cinque componenti e tre
// stili: basta dimenticarne uno perché l'euro resti lì. Qui ogni componente
// che scrive un prezzo del menù si prova col formato del locale; la pagina
// intera, col carrello che resta in euro, è in MenuPage.test.jsx.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from '../helpers/router.jsx'
import { PrezzoMenu, prezzoInMenu } from '../../src/lib/prezzoMenu.js'
import FormatoPrezziMenu from '../../src/components/FormatoPrezziMenu.jsx'
import { VoceCarta } from '../../src/components/MenuCarte.jsx'
import { VoceGiornale } from '../../src/components/MenuGiornale.jsx'
import CaroselloSpeciali from '../../src/components/CaroselloSpeciali.jsx'
import DettaglioDrink from '../../src/components/DettaglioDrink.jsx'

const SPRITZ = { id: 'spritz', name: 'Spritz', price: 3.5, description: 'Aperol, prosecco e soda', ingredients: [] }

// Come li monta MenuPage: dentro il formato scelto dal locale.
const nelMenu = (formato, figlio) =>
  render(
    <MemoryRouter>
      <PrezzoMenu.Provider value={(v) => prezzoInMenu(v, formato)}>{figlio}</PrezzoMenu.Provider>
    </MemoryRouter>
  )

const PEZZI = [
  ['la voce di una carta («Carte»)', () => <VoceCarta d={SPRITZ} />],
  ['la voce del «Giornale»', () => <VoceGiornale d={SPRITZ} />],
  ['la slide del carosello degli Special', () => <CaroselloSpeciali voci={[SPRITZ]} link={() => '/menu/special'} />],
  ['il dettaglio del drink', () => <DettaglioDrink drink={SPRITZ} onClose={vi.fn()} />],
]

describe.each(PEZZI)('%s', (_nome, pezzo) => {
  it('col formato di partenza scrive il numero, senza euro', () => {
    nelMenu('numero', pezzo())
    expect(screen.getByText('3,5')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/€/)
  })

  it('con «centesimi» scrive i due decimali, sempre senza euro', () => {
    nelMenu('centesimi', pezzo())
    expect(screen.getByText('3,50')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/€/)
  })

  it('con «valuta» scrive l’importo in euro, com’era prima', () => {
    nelMenu('valuta', pezzo())
    expect(document.body.textContent).toMatch(/3,50\s€/)
  })
})

// Fuori dal menù dei clienti (la vetrina del Marketplace) non c'è un locale
// che abbia scelto: resta l'importo intero.
describe('fuori dal menù dei clienti', () => {
  it('una voce disegnata senza il formato del locale scrive l’importo in euro', () => {
    render(<VoceCarta d={SPRITZ} />)
    expect(document.body.textContent).toMatch(/3,50\s€/)
  })
})

describe('la scelta nelle Impostazioni', () => {
  const tasti = () => within(screen.getByRole('group', { name: 'Prezzi nel menù' })).getAllByRole('button')

  it('tre formati, ognuno col suo esempio; di partenza è scelto «Numero»', () => {
    render(<FormatoPrezziMenu settings={{}} onSave={vi.fn()} />)
    expect(tasti().map((t) => t.textContent)).toEqual(['Numero8 · 3,5', 'Numero con i centesimi8 · 3,50', 'Importo in euro8,00 € · 3,50 €'])
    expect(tasti().map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
  })

  it('scegliendone un altro lo scrive nelle impostazioni del locale', async () => {
    const onSave = vi.fn()
    render(<FormatoPrezziMenu settings={{}} onSave={onSave} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Importo in euro/ }))
    expect(onSave).toHaveBeenCalledWith({ formato_prezzi_menu: 'valuta' })
  })

  it('quello già scelto si legge scelto, e ritoccarlo non riscrive niente', async () => {
    const onSave = vi.fn()
    render(<FormatoPrezziMenu settings={{ formato_prezzi_menu: 'centesimi' }} onSave={onSave} />)
    expect(tasti().map((t) => t.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    await userEvent.setup().click(screen.getByRole('button', { name: /Numero con i centesimi/ }))
    expect(onSave).not.toHaveBeenCalled()
  })

  // Gli esempi a schermo sono quelli che la funzione scrive davvero.
  it('gli esempi dicono il vero', async () => {
    const { FORMATI_PREZZO_MENU } = await import('../../src/lib/prezzoMenu.js')
    for (const f of FORMATI_PREZZO_MENU) {
      expect(`${prezzoInMenu(8, f.id)} · ${prezzoInMenu(3.5, f.id)}`.replace(/ /g, ' ')).toBe(f.esempio)
    }
  })
})
