// @vitest-environment happy-dom
'use strict'

// LA SEZIONE «ASPETTO» DELLE IMPOSTAZIONI.
//
// Ci stava solo il tema del gestionale. Poi l'utente ha dato la regola
// (20/08/2026): «tutto ciò che riguarda l'aspetto degli elementi, di
// qualsiasi sezione del sito, dovrebbe essere messo sotto Aspetto» — e la
// prima a nascerci dentro è la scelta di cosa dice la striscia colorata a
// sinistra delle card della coda.
//
// Quello che si prova qui è la SEDE e la CHIAVE, non il disegno: che
// l'interruttore stia in Aspetto e non in «Coda ordini» (sennò la regola
// muore al primo che non la conosce), e che scriva `bordo_colore_conto`,
// che è quella che tutte le viste della coda leggono.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import ThemeSettings from '../../src/components/ThemeSettings.jsx'

let salvato = null
const onSave = vi.fn((patch) => {
  salvato = patch
})

beforeEach(() => {
  onSave.mockClear()
  salvato = null
})

describe('la striscia delle card della coda, in «Aspetto»', () => {
  it('la scelta sta dentro Aspetto, con le due risposte scritte per intero', () => {
    render(<ThemeSettings settings={{}} onSave={onSave} />)

    // La sotto-sezione, dove chi cerca «come si vedono le card» va a
    // guardare adesso.
    expect(screen.getByText('Le card della coda')).toBeInTheDocument()
    // DUE RISPOSTE, non un acceso/spento: hanno lo stesso peso, e un
    // interruttore avrebbe costretto a scrivere nell'etichetta quale
    // delle due è il «no».
    expect(screen.getByRole('button', { name: /Com.è messo il conto/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Il colore del conto/ })).toBeInTheDocument()
  })

  it('di suo è acceso «com’è messo il conto»: chi non tocca niente non vede cambiare niente', () => {
    render(<ThemeSettings settings={{}} onSave={onSave} />)
    // Un'impostazione mai scritta arriva `undefined`, non `false`: se qui
    // non fosse acceso nessuno dei due, la coda di stasera sembrerebbe
    // diversa da quella di ieri sera senza che nessuno abbia toccato nulla.
    expect(screen.getByRole('button', { name: /Com.è messo il conto/ })).toHaveClass('active')
    expect(screen.getByRole('button', { name: /Il colore del conto/ })).not.toHaveClass('active')
  })

  it('scegliendo il colore del conto scrive la chiave che le viste leggono', async () => {
    const utente = userEvent.setup()
    render(<ThemeSettings settings={{}} onSave={onSave} />)

    await utente.click(screen.getByRole('button', { name: /Il colore del conto/ }))
    expect(salvato).toEqual({ bordo_colore_conto: true })
  })

  it('e si torna indietro: la striscia ridice lo stato', async () => {
    const utente = userEvent.setup()
    render(<ThemeSettings settings={{ bordo_colore_conto: true }} onSave={onSave} />)

    expect(screen.getByRole('button', { name: /Il colore del conto/ })).toHaveClass('active')
    await utente.click(screen.getByRole('button', { name: /Com.è messo il conto/ }))
    expect(salvato).toEqual({ bordo_colore_conto: false })
  })
})
