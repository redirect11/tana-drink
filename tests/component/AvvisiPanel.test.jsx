// @vitest-environment happy-dom
'use strict'

// GLI AVVISI SONO DI CHI GUARDA QUELLO SCHERMO. La scelta è per persona e
// per dispositivo: lo stesso account sul tablet della cassa e sul telefono
// in sala vuole cose diverse, e due che si passano il tablet nel cambio
// turno non devono sovrascriversi le impostazioni a vicenda.
//
// Perciò stanno nel PROFILO e non nelle impostazioni del locale — dove per
// giunta chi è in sala non entra nemmeno, ed erano fuori portata proprio
// per chi le usa di più.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

let uid = 'anna'
vi.mock('../../src/lib/firebaseClient.js', () => ({
  get auth() {
    return { currentUser: uid ? { uid } : null }
  },
}))

import AvvisiPanel from '../../src/components/AvvisiPanel.jsx'
import { avvisoAttivo, leggiAvvisi } from '../../src/lib/preferenzeNotifiche.js'

const interruttore = (nome) =>
  screen.getByText(nome).closest('.toggle-row').querySelector('input')

beforeEach(() => {
  uid = 'anna'
  localStorage.clear()
})

describe('quali avvisi voglio qui', () => {
  it('di partenza sono tutti accesi: nessuno deve scoprire di essersi perso un ordine', () => {
    render(<AvvisiPanel gestore />)
    expect(interruttore('Nuovo ordine')).toBeChecked()
    expect(interruttore('Diventa pronto')).toBeChecked()
  })

  it('le scorte le vede chi tiene il magazzino, in sala non servono', () => {
    render(<AvvisiPanel gestore={false} />)
    expect(screen.queryByText('Scorta esaurita')).toBeNull()
    // Quello che serve in sala c'è.
    expect(screen.getByText('Diventa pronto')).toBeInTheDocument()
  })

  it('spegnendone uno lo dice, invece di lasciare un silenzio inspiegato', async () => {
    const user = userEvent.setup()
    render(<AvvisiPanel gestore />)
    await user.click(interruttore('Nuovo ordine'))
    expect(screen.getByText(/Un avviso è spento/)).toBeInTheDocument()
  })

  it('la scelta è di quella persona: chi prende il turno dopo non se la trova addosso', async () => {
    const user = userEvent.setup()
    const primo = render(<AvvisiPanel gestore />)
    await user.click(interruttore('Nuovo ordine'))
    expect(avvisoAttivo(leggiAvvisi('anna'), 'nuovo_ordine')).toBe(false)
    primo.unmount()

    // Cambio turno sullo stesso tablet: Bruno trova tutto acceso.
    uid = 'bruno'
    render(<AvvisiPanel gestore />)
    expect(interruttore('Nuovo ordine')).toBeChecked()
    // …e ad Anna resta com'era.
    expect(avvisoAttivo(leggiAvvisi('anna'), 'nuovo_ordine')).toBe(false)
  })
})

// DOVE compaiono, non solo QUALI arrivano: stessa natura — una scelta di
// questo dispositivo — quindi stesso posto. La strisciolina non si perde ma
// interrompe anche chi sta contando la cassa; il fumetto sta solo nella
// coda, dove gli ordini si aspettano.
describe('dove compaiono gli avvisi', () => {
  it('si sceglie dal profilo, accanto a quali riceverne', async () => {
    const user = userEvent.setup()
    render(<AvvisiPanel gestore />)
    await user.click(screen.getByRole('button', { name: /Dalla campanella/ }))
    expect(screen.getByText(/Fuori dalla coda non compare niente/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /In alto, ovunque/ }))
    expect(screen.getByText(/compare su qualunque schermata/)).toBeInTheDocument()
  })
})
