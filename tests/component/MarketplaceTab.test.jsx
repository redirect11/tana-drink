// @vitest-environment happy-dom
'use strict'

// ── LA PAGINA DEL MARKETPLACE (REQ-MENU-023) ──────────────────────────
//
// L'utente, 02/11/2026: «una sezione marketplace separata, una
// finestra/pagina nuova che apro per navigare i temi come se fosse un
// catalogo e poi li installo sulla mia istanza». Una pagina del menu
// laterale con tre sezioni — Temi, Stili del menù, Installati — e su ogni
// scheda la vetrina, «Prova sul menù», «Installa» e «Usa».

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const st = vi.hoisted(() => ({ impostazioni: {}, scritte: [] }))

vi.mock('../../src/lib/api.js', () => ({
  subscribeSettings: (cb) => {
    cb(st.impostazioni)
    return () => {}
  },
  settingsIniziali: () => st.impostazioni,
  updateSettings: vi.fn((patch) => {
    st.scritte.push(patch)
    return Promise.resolve()
  }),
}))

import MarketplaceTab from '../../src/components/MarketplaceTab.jsx'
import { subscribeSottosezioni } from '../../src/lib/sottosezioni.js'

// Le sottosezioni stanno nel menu a scomparsa: qui si scelgono da lì.
let sottosezioni
beforeEach(() => {
  st.impostazioni = {}
  st.scritte = []
  localStorage.clear()
  sottosezioni = null
})
afterEach(cleanup)

function mostra() {
  const smetti = subscribeSottosezioni((s) => {
    sottosezioni = s
  })
  const r = render(<MarketplaceTab />)
  return { ...r, smetti }
}
const vaiA = (id) => act(() => sottosezioni.scegli(id))

describe('il marketplace', () => {
  it('è un catalogo: le sezioni Temi, Stili del menù, Installati', () => {
    mostra()
    expect(sottosezioni.voci.map((v) => v.label)).toEqual(['Temi', 'Stili del menù', 'Installati'])
    expect(screen.getByRole('heading', { name: 'Temi', level: 2 })).toBeInTheDocument()
  })

  it('ogni tema ha la vetrina, la prova sul menù e «Installa»; «Notte» solo con la licenza', () => {
    const { container } = mostra()
    for (const nome of ['Classico', 'Lavagna', 'Grand Hotel', 'Riviera', 'Pastello', 'Gazzetta', 'Inchiostro']) {
      expect(screen.getByRole('button', { name: `Installa ${nome}` })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Installa Notte' })).toBeNull()
    expect(container.querySelector('.vetrina-tema.stile-deco')).not.toBeNull()
    const prove = screen.getAllByRole('link', { name: 'Prova sul menù' }).map((a) => a.getAttribute('href'))
    expect(prove).toContain('/menu?vista=cliente&tema=grand-hotel')
  })

  it('«Installa» e poi «Usa»: il tema va sul menù dei clienti', async () => {
    const utente = userEvent.setup()
    mostra()
    await utente.click(screen.getByRole('button', { name: 'Installa Gazzetta' }))
    expect(st.scritte.at(-1).temi_installati.map((t) => t.id)).toEqual(['gazzetta'])
    await utente.click(screen.getByRole('button', { name: 'Usa Gazzetta' }))
    expect(st.scritte.at(-1)).toMatchObject({ theme_client: { preset: 'chiaro' }, stile_menu: 'giornale', tema_menu: 'gazzetta' })
    expect(screen.getByText('In uso')).toBeInTheDocument()
  })

  it('gli stili da soli si installano e si usano sui colori del locale', async () => {
    const utente = userEvent.setup()
    mostra()
    vaiA('stili')
    await utente.click(screen.getByRole('button', { name: 'Installa lo stile Lavagna' }))
    expect(st.scritte.at(-1)).toEqual({ stili_installati: ['lavagna'] })
    await utente.click(screen.getByRole('button', { name: 'Usa lo stile Lavagna' }))
    expect(st.scritte.at(-1)).toEqual({ stile_menu: 'lavagna' })
  })

  it('Installati: quello che il locale ha, e lì si disinstalla', async () => {
    const utente = userEvent.setup()
    st.impostazioni = {
      temi_installati: [{ id: 'riviera', nome: 'Riviera', tavolozza: { base: 'crema' }, stile: 'riviera' }],
      stili_installati: ['deco'],
    }
    mostra()
    vaiA('installati')
    expect(screen.getByRole('heading', { name: 'Riviera' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Déco' })).toBeInTheDocument()
    await utente.click(screen.getByRole('button', { name: 'Disinstalla Riviera' }))
    expect(st.scritte.at(-1)).toEqual({ temi_installati: [] })
  })

  it('niente installato: lo dice', () => {
    mostra()
    vaiA('installati')
    expect(screen.getByText(/Nessun tema né stile installato/)).toBeInTheDocument()
  })
})

// REQ-MENU-024: la vetrina di uno stile con una struttura sua mostra
// quella — il «Giornale» è una testata con le sezioni, non le card.
describe('la vetrina del «Giornale»', () => {
  it('è un giornale in miniatura', () => {
    const { container } = mostra()
    const vetrina = container.querySelector('.vetrina-tema.stile-giornale')
    expect(vetrina.querySelector('.g-testata')).not.toBeNull()
    expect(vetrina.querySelector('.menu-item')).toBeNull()
  })
})
