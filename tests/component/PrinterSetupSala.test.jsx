// @vitest-environment happy-dom
'use strict'

// LA STAMPANTE ANCHE ALLA SALA (REQ-STAMPA-020). Flavio, 30/10/2026:
// «bisogna dare allo staff, cioè ad un account staff, la possibilità di
// collegarsi alla stampante, perché sta disabilitato». Lo staff apre la
// pagina e vede il collegamento — indirizzo, porta, prova di stampa — e lo
// salva sul SUO telefono; i dati del locale sulla carta e la configurazione
// condivisa restano dei gestori.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const savePrinterConfig = vi.fn()
vi.mock('../../src/lib/api.js', () => ({ savePrinterConfig: (...a) => savePrinterConfig(...a) }))

const { default: PrinterSetup } = await import('../../src/components/PrinterSetup.jsx')
const { loadPrinterSettings } = await import('../../src/lib/printer.js')

beforeEach(() => {
  localStorage.clear()
  savePrinterConfig.mockClear()
})

describe('la pagina della stampante', () => {
  it('per la sala: il collegamento sì, i dati del locale no', () => {
    render(<PrinterSetup gestore={false} />)
    expect(screen.getByLabelText('IP stampante')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Test stampa/ })).toBeInTheDocument()
    expect(screen.queryByText('Dati del locale')).toBeNull()
    expect(screen.queryByLabelText('Nome locale')).toBeNull()
    expect(screen.getByText(/L’indirizzo vale per questo telefono/)).toBeInTheDocument()
  })

  it('la sala salva l’indirizzo sul suo telefono, senza toccare quello del locale', () => {
    render(<PrinterSetup gestore={false} />)
    fireEvent.change(screen.getByLabelText('IP stampante'), { target: { value: '192.168.1.50' } })
    fireEvent.click(screen.getByRole('button', { name: /Salva/ }))
    expect(loadPrinterSettings().ip).toBe('192.168.1.50')
    expect(savePrinterConfig).not.toHaveBeenCalled()
  })

  it('il gestore vede tutto, e salva anche per il locale', () => {
    render(<PrinterSetup />)
    expect(screen.getByText('Dati del locale')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('IP stampante'), { target: { value: '192.168.1.60' } })
    fireEvent.click(screen.getByRole('button', { name: /Salva/ }))
    expect(savePrinterConfig).toHaveBeenCalledWith(expect.objectContaining({ ip: '192.168.1.60' }))
  })
})
