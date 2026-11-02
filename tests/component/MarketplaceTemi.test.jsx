// @vitest-environment happy-dom
'use strict'

// ── LA PAGINA DEL MARKETPLACE (REQ-MENU-023) ──────────────────────────
//
// In Impostazioni → Aspetto: i temi del locale e quelli del catalogo, con
// l'assaggio, «Prova sul menù», «Installa» e «Usa». Tutto gratis per ora.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import MarketplaceTemi from '../../src/components/MarketplaceTemi.jsx'

let salvato
const onSave = (p) => {
  salvato = p
}

beforeEach(() => {
  salvato = null
  localStorage.clear()
})
afterEach(cleanup)

describe('il marketplace dei temi', () => {
  it('mostra il catalogo iniziale, tutto gratis, con la prova sul menù', () => {
    render(<MarketplaceTemi settings={{}} onSave={onSave} />)
    expect(screen.getByRole('heading', { name: 'Marketplace dei temi' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nel marketplace' })).toBeInTheDocument()
    for (const nome of ['Classico', 'Lavagna', 'Grand Hotel', 'Riviera', 'Gazzetta']) {
      expect(screen.getByRole('button', { name: `Installa ${nome}` })).toBeInTheDocument()
    }
    expect(screen.queryByText('Notte')).toBeNull()
    const prove = screen.getAllByRole('link', { name: 'Prova sul menù' }).map((a) => a.getAttribute('href'))
    expect(prove).toContain('/menu?vista=cliente&tema=grand-hotel')
  })

  it('«Installa» aggiunge il tema ai temi del locale', async () => {
    const utente = userEvent.setup()
    render(<MarketplaceTemi settings={{}} onSave={onSave} />)
    await utente.click(screen.getByRole('button', { name: 'Installa Gazzetta' }))
    expect(salvato.temi_installati.map((t) => t.id)).toEqual(['gazzetta'])
  })

  it('un tema installato si usa, e quello in uso lo dice', async () => {
    const utente = userEvent.setup()
    const gazzetta = { id: 'gazzetta', nome: 'Gazzetta', tavolozza: { base: 'chiaro' }, stile: 'giornale' }
    const riviera = { id: 'riviera', nome: 'Riviera', tavolozza: { base: 'crema' }, stile: 'riviera' }
    render(
      <MarketplaceTemi settings={{ temi_installati: [gazzetta, riviera], tema_menu: 'riviera' }} onSave={onSave} />
    )
    expect(screen.getByRole('heading', { name: 'I temi del locale' })).toBeInTheDocument()
    expect(screen.getByText('In uso')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Installa Gazzetta' })).toBeNull()
    await utente.click(screen.getByRole('button', { name: 'Usa Gazzetta' }))
    expect(salvato).toMatchObject({ theme_client: { preset: 'chiaro' }, stile_menu: 'giornale', tema_menu: 'gazzetta' })
  })

  it('«Notte» la vede solo chi ce l’ha in licenza', () => {
    render(<MarketplaceTemi settings={{ licenza: { temi: ['notte'] } }} onSave={onSave} />)
    expect(screen.getByRole('button', { name: 'Installa Notte' })).toBeInTheDocument()
  })

  it('senza regia nella build non si chiama nessun catalogo', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<MarketplaceTemi settings={{}} onSave={onSave} />)
    expect(fetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
