// @vitest-environment happy-dom
'use strict'

// BILANCIO: i conti del locale hanno una pagina loro, e la vede solo
// l'admin. Sono un'altra cosa dalle Statistiche — incassi, stipendi, spese
// e netto del mese sono di chi il locale lo paga, quanto ci mette un drink
// a uscire è il lavoro di chi sta al banco.
//
// E SENZA DIDASCALIE LA SCHERMATA NON È FINITA: una tabella di conti è
// piena di parole che a chi non fa il contabile non dicono niente. Sotto
// ogni tabella va una frase corta che dice che numero è e da dove viene,
// in parole da banco — e dove un numero ha un'avvertenza, l'avvertenza sta
// lì e non in un manuale.

import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import BilancioTab from '../../src/components/BilancioTab.jsx'
import { subscribeSottosezioni } from '../../src/lib/sottosezioni.js'

// Le sottosezioni non stanno in una riga di schede sopra il contenuto: la
// pagina le DICHIARA (lib/sottosezioni.js) e le mostra il menu laterale.
// Da qui le leggiamo dalla stessa parte in cui le legge la barra.
let sotto = { voci: [], attiva: null, scegli: null }
beforeEach(() => {
  sotto = { voci: [], attiva: null, scegli: null }
})
function ascolta() {
  return subscribeSottosezioni((s) => {
    sotto = s
  })
}

describe('la pagina Bilancio', () => {
  it('dichiara le sue tre sottosezioni, nel menu e non in pagina', () => {
    const stop = ascolta()
    render(<BilancioTab />)
    expect(sotto.voci.map((v) => v.label)).toEqual([
      'Mesi',
      'Acquisti × Fatturato',
      'Venduto × Incassato',
    ])
    // Si apre sui mesi: è la domanda di fine mese da cui si parte.
    expect(sotto.attiva).toBe('mesi')
    stop()
  })

  it('ogni sottosezione porta la sua didascalia, in parole da banco', async () => {
    const stop = ascolta()
    render(<BilancioTab />)

    // Mesi: il netto spiegato senza dire «netto».
    expect(screen.getByText(/quello che resta dopo aver pagato/i)).toBeInTheDocument()

    // Acquisti × Fatturato: l'avvertenza che pesa di più — dello storico
    // non si ricostruisce niente, e un totale basso lì dentro non vuol dire
    // che non si è comprato.
    act(() => sotto.scegli('acquisti'))
    expect(await screen.findByText(/dello storico non si ricostruisce niente/i)).toBeInTheDocument()

    act(() => sotto.scegli('venduto'))
    expect(await screen.findByText(/quanto ha incassato ogni gruppo del menù/i)).toBeInTheDocument()
    stop()
  })

  it('cambiando sottosezione cambia quello che si vede', async () => {
    const stop = ascolta()
    render(<BilancioTab />)
    expect(screen.getByText(/📅 Mesi/)).toBeInTheDocument()
    act(() => sotto.scegli('acquisti'))
    expect(await screen.findByText(/📥 Acquisti × Fatturato/)).toBeInTheDocument()
    expect(screen.queryByText(/📅 Mesi/)).toBeNull()
    stop()
  })
})

// Una pagina vuota si legge come rotta: finché le tabelle non ci sono, la
// schermata dice cosa sta arrivando.
describe('finché le tabelle non ci sono', () => {
  it('la schermata dice cosa sta arrivando, non resta bianca', () => {
    const stop = ascolta()
    render(<BilancioTab />)
    expect(screen.getByText(/sta arrivando/i)).toBeInTheDocument()
    stop()
  })
})
