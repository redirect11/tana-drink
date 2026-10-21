// @vitest-environment happy-dom
'use strict'

// IMPOSTAZIONI → IL LOCALE (REQ-VENUE-001): l'admin scrive nome, contatti,
// intestazione e social; vuoto vuol dire «vale la build», e il segnaposto
// lo mostra. Si salva all'uscita dalla casella, una chiave alla volta.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import IdentitaLocale from '../../src/components/IdentitaLocale.jsx'

describe('Il locale', () => {
  it('le caselle vuote mostrano la build come segnaposto', () => {
    render(<IdentitaLocale settings={{}} onSave={vi.fn()} />)
    const nome = screen.getByLabelText('Nome del locale')
    expect(nome).toHaveValue('')
    expect(nome).toHaveAttribute('placeholder', 'La Tana del Coniglio')
    expect(screen.getByLabelText('Ragione sociale')).toHaveAttribute('placeholder', 'EFFEVI - SRLS')
    expect(screen.getByLabelText('Social')).toHaveAttribute('placeholder', expect.stringContaining('instagram https://www.instagram.com/'))
  })

  it('si salva una chiave alla volta, uscendo dalla casella, e solo se è cambiata', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<IdentitaLocale settings={{ venue_city: 'Nola' }} onSave={onSave} />)
    await user.type(screen.getByLabelText('Nome del locale'), 'Bar Mario')
    await user.tab()
    expect(onSave).toHaveBeenCalledWith({ venue_name: 'Bar Mario' })
    // Uscire da una casella non cambiata non scrive niente.
    await user.click(screen.getByLabelText('Città'))
    await user.tab()
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('i social si scrivono una riga per social e si salvano come elenco', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<IdentitaLocale settings={{}} onSave={onSave} />)
    const social = screen.getByLabelText('Social')
    await user.type(social, 'instagram https://instagram.com/mario{enter}https://mario.example')
    await user.tab()
    expect(onSave).toHaveBeenCalledWith({
      venue_socials: [
        { piattaforma: 'instagram', href: 'https://instagram.com/mario' },
        { piattaforma: 'link', href: 'https://mario.example' },
      ],
    })
  })
})
