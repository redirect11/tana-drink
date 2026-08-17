// @vitest-environment happy-dom
'use strict'

// LA PASSWORD, CON L'OCCHIO PER GUARDARLA. Al banco si entra da un tablet,
// spesso con le mani bagnate e una tastiera a schermo che sbaglia da sola:
// scritta a pallini, davanti a un «credenziali errate» non si sa mai se è
// sbagliata la password o una lettera partita male.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import CampoPassword from '../../src/components/CampoPassword.jsx'

describe('il campo password', () => {
  it('parte coperto: al bancone c’è sempre qualcuno dietro le spalle', () => {
    render(<CampoPassword id="p" value="segreta" onChange={() => {}} />)
    expect(document.getElementById('p')).toHaveAttribute('type', 'password')
  })

  it('l’occhio la mostra, e poi la ricopre', async () => {
    const user = userEvent.setup()
    render(<CampoPassword id="p" value="segreta" onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Mostra la password/ }))
    expect(document.getElementById('p')).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: /Nascondi la password/ }))
    expect(document.getElementById('p')).toHaveAttribute('type', 'password')
  })

  it('non ruba il turno alla tastiera: da password si va a «entra»', () => {
    render(<CampoPassword id="p" value="" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Mostra la password/ })).toHaveAttribute(
      'tabindex',
      '-1'
    )
  })

  it('resta un campo come gli altri: required e autocomplete passano', () => {
    render(<CampoPassword id="p" value="" onChange={() => {}} required autoComplete="new-password" />)
    const campo = document.getElementById('p')
    expect(campo).toBeRequired()
    expect(campo).toHaveAttribute('autocomplete', 'new-password')
  })
})
