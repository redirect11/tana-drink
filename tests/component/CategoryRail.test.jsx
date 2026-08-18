// @vitest-environment happy-dom
'use strict'

// STRINGERE LA BARRA VUOL DIRE «A ICONE» — ma solo se le icone ci sono.
// Dove le voci non hanno né icona né colore (le categorie del magazzino)
// stringendo restava una colonna di pastiglie grigie tutte uguali: brutte,
// e per giunta mute, perché non c'era modo di sapere quale fosse quale.

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import CategoryRail from '../../src/components/CategoryRail.jsx'

const SENZA_SEGNO = [
  { key: 'a', label: 'Liquori e Amari' },
  { key: 'b', label: 'Freschi e Garnish' },
]
const CON_ICONE = [
  { key: 'a', label: 'Aspetto', icon: '🎨' },
  { key: 'b', label: 'Stampante', icon: '🖨️' },
]

beforeEach(() => {
  cleanup()
  localStorage.clear()
})

const monta = (items, chiave) =>
  render(
    <CategoryRail items={items} selected="a" onSelect={() => {}} chiave={chiave}>
      <p>contenuto</p>
    </CategoryRail>
  )

describe('la barra delle categorie, stretta', () => {
  it('senza icone le voci si tolgono di mezzo del tutto', async () => {
    const user = userEvent.setup()
    monta(SENZA_SEGNO, 'magazzino')
    expect(screen.getByText('Liquori e Amari')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Nascondi le sezioni/ }))
    expect(screen.queryByText('Liquori e Amari')).toBeNull()
    // Ma si torna indietro con un clic: le sezioni non si perdono.
    expect(screen.getByRole('button', { name: /Mostra le sezioni/ })).toBeInTheDocument()
  })

  it('con le icone restano: lì stringere serve davvero', async () => {
    const user = userEvent.setup()
    monta(CON_ICONE, 'impostazioni')
    await user.click(screen.getByRole('button', { name: /Nascondi le sezioni/ }))
    // Il nome resta nel documento (torna sfiorando la voce), l'icona si vede.
    expect(screen.getByText('🎨')).toBeInTheDocument()
    expect(screen.getByText('Aspetto')).toBeInTheDocument()
  })

  it('la scelta si ricorda, e ogni pagina ha la sua', async () => {
    const user = userEvent.setup()
    monta(SENZA_SEGNO, 'magazzino')
    await user.click(screen.getByRole('button', { name: /Nascondi le sezioni/ }))
    expect(localStorage.getItem('tana:barra-stretta:magazzino')).toBe('1')
    cleanup()
    monta(SENZA_SEGNO, 'altra-pagina')
    expect(screen.getByText('Liquori e Amari')).toBeInTheDocument()
  })
})
