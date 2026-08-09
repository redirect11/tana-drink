// @vitest-environment happy-dom
'use strict'

// ZOOM DELLA PAGINA: due tasti + e − per stringere o allargare tutto.
// Nella PWA a tutto schermo il browser il suo zoom non lo offre, quindi
// senza questi tasti non c'è modo di cambiarlo.

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import ZoomControl from '../../src/components/ZoomControl.jsx'

const root = () => document.getElementById('root')
const livello = () => document.documentElement.style.getPropertyValue('--zoom')

describe('zoom della pagina', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="root"></div>'
    document.documentElement.style.removeProperty('--zoom')
  })

  it('parte dal 100% e non tocca la pagina', () => {
    render(<ZoomControl />)
    expect(screen.getByRole('button', { name: /100%/ })).toBeInTheDocument()
    expect(root().style.zoom).toBe('')
  })

  it('“+” allarga, “−” stringe, a passi del 10%', async () => {
    const user = userEvent.setup()
    render(<ZoomControl />)
    await user.click(screen.getByRole('button', { name: 'Ingrandisci' }))
    expect(root().style.zoom).toBe('1.1')
    expect(livello()).toBe('1.1')
    await user.click(screen.getByRole('button', { name: 'Rimpicciolisci' }))
    await user.click(screen.getByRole('button', { name: 'Rimpicciolisci' }))
    expect(root().style.zoom).toBe('0.9')
  })

  it('non si scende né si sale oltre i limiti', async () => {
    const user = userEvent.setup()
    render(<ZoomControl />)
    for (let i = 0; i < 12; i++) {
      const meno = screen.getByRole('button', { name: 'Rimpicciolisci' })
      if (meno.disabled) break
      await user.click(meno)
    }
    expect(Number(root().style.zoom)).toBe(0.7)
    expect(screen.getByRole('button', { name: 'Rimpicciolisci' })).toBeDisabled()
  })

  it('il livello riporta al 100% con un tocco', async () => {
    const user = userEvent.setup()
    render(<ZoomControl />)
    await user.click(screen.getByRole('button', { name: 'Ingrandisci' }))
    await user.click(screen.getByRole('button', { name: 'Ingrandisci' }))
    await user.click(screen.getByRole('button', { name: /1[23]0%/ }))
    expect(root().style.zoom).toBe('')
    expect(screen.getByRole('button', { name: /100%/ })).toBeDisabled()
  })

  it('lo zoom scelto si ricorda alla riapertura', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ZoomControl />)
    await user.click(screen.getByRole('button', { name: 'Ingrandisci' }))
    unmount()
    document.body.innerHTML = '<div id="root"></div>'
    render(<ZoomControl />)
    expect(root().style.zoom).toBe('1.1')
    expect(screen.getByRole('button', { name: /110%/ })).toBeInTheDocument()
  })

  it('i tasti stanno FUORI dalla pagina scalata, altrimenti rimpicciolirebbero', () => {
    render(<ZoomControl />)
    const gruppo = screen.getByRole('group', { name: /zoom/i })
    expect(root().contains(gruppo)).toBe(false)
    expect(document.body.contains(gruppo)).toBe(true)
  })
})
