// @vitest-environment happy-dom
'use strict'

// ── L'AVVISO DELLA CANCELLAZIONE DEI DATI (REQ-LIC-009) ───────────────
//
// «Dobbiamo cancellare i suoi dati entro un tot e avvisarlo quando stiamo
// per cancellarli» (l'utente, 02/11/2026). La regia scrive nella licenza
// `cancellazione: { il, richiedente }`, e l'app lo dice a chi lavora, su
// ogni schermata: la data, il backup scaricabile, e cosa fare per
// evitarla, che cambia con chi l'ha chiesta.

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AvvisoCancellazione from '../../src/components/AvvisoCancellazione.jsx'
import { cancellazioneProgrammata } from '../../src/lib/licenza.js'

afterEach(cleanup)

const conCancellazione = (richiedente, extra = {}) => ({
  licenza: {
    piano: 'completo',
    stato: 'sospesa',
    moduli: {},
    regia_url: 'https://drink-regia.web.app/area',
    cancellazione: { il: '2027-01-31T12:00:00Z', richiedente },
    ...extra,
  },
})

describe('la cancellazione programmata', () => {
  it('si legge dalla licenza; senza, o con una data che non si legge, non c’è', () => {
    expect(cancellazioneProgrammata(conCancellazione('conservazione'))).toEqual({
      il: new Date('2027-01-31T12:00:00Z'),
      richiedente: 'conservazione',
    })
    expect(cancellazioneProgrammata({ licenza: { moduli: {} } })).toBeNull()
    expect(cancellazioneProgrammata(conCancellazione('titolare', { cancellazione: { il: 'presto' } }))).toBeNull()
  })
})

describe('l’avviso', () => {
  it('per la conservazione: la data, il backup, e che basta riattivare l’abbonamento', () => {
    render(<AvvisoCancellazione settings={conCancellazione('conservazione')} ruolo="admin" />)
    const avviso = screen.getByRole('alert')
    expect(avviso).toHaveTextContent('I dati del locale verranno cancellati il 31 gennaio 2027.')
    expect(avviso).toHaveTextContent(/backup scaricabile dall’area clienti per 180 giorni/)
    expect(avviso).toHaveTextContent(/riattivare l’abbonamento/)
    expect(screen.getByRole('link', { name: 'Vai all’area clienti' })).toHaveAttribute(
      'href',
      'https://drink-regia.web.app/area'
    )
  })

  it('chiesta dal titolare: si annulla dall’area clienti', () => {
    render(<AvvisoCancellazione settings={conCancellazione('titolare')} ruolo="bartender" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/chiesta dal titolare e si annulla dall’area clienti/)
  })

  it('disposta dal fornitore: lo dice', () => {
    render(<AvvisoCancellazione settings={conCancellazione('admin')} ruolo="staff" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/disposta dal fornitore del servizio/)
  })

  it('al cliente no, e senza cancellazione niente', () => {
    const { container } = render(<AvvisoCancellazione settings={conCancellazione('conservazione')} ruolo={null} />)
    expect(container).toBeEmptyDOMElement()
    cleanup()
    const vuoto = render(<AvvisoCancellazione settings={{ licenza: { moduli: {} } }} ruolo="admin" />)
    expect(vuoto.container).toBeEmptyDOMElement()
  })
})
