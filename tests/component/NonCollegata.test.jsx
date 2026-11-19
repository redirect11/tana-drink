// @vitest-environment happy-dom
'use strict'

// IL SITO CHE NON SA ANCORA DI CHE LOCALE È (REQ-FLOTTA-034). Il sito
// uguale per tutti prima del deploy, o un dispositivo che non ha ancora la
// configurazione del suo locale: niente backend. Al posto dell'app una
// schermata a parole comuni, non il banner per lo sviluppatore con le
// variabili d'ambiente, che al banco e al cliente non dice niente.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import NonCollegata from '../../src/components/NonCollegata.jsx'
import { impostaLingua } from '../../src/lib/lingua.js'

afterEach(() => {
  cleanup()
  impostaLingua('it')
})

describe('la schermata del sito non collegato', () => {
  it('dice cosa succede e che si collega da sola, senza gergo tecnico', () => {
    render(<NonCollegata />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'L’app non è ancora collegata al locale' })).toBeInTheDocument()
    expect(screen.getByText('Si collega da sola appena la connessione lo permette.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Firebase|VITE_|\.env|configurazione\.json/)
    // Nessun tasto: non c'è niente da fare, l'app riprova da sé.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('in inglese per chi ha scelto l’inglese su questo dispositivo', () => {
    impostaLingua('en')
    render(<NonCollegata />)
    expect(screen.getByRole('heading', { name: 'The app is not connected to the venue yet' })).toBeInTheDocument()
    expect(screen.getByText('It will connect automatically as soon as a connection is available.')).toBeInTheDocument()
  })
})
