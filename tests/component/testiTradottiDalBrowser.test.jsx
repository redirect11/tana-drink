// @vitest-environment happy-dom
// LE PAGINE DEI CLIENTI TRADOTTE DAL BROWSER: I TESTI CHE CAMBIANO
// (REQ-CLI-010).
//
// Il traduttore di Chrome sostituisce ogni testo con un <font> che porta la
// traduzione. Un testo che React aggiorna SUL POSTO, accostato ad altri
// pezzi nello stesso elemento, col traduttore acceso restava fermo: React
// cambiava il nodo che non è più a schermo. La regola è scritta in
// lib/traduttoreBrowser.js — il testo che cambia è l'unico figlio del suo
// elemento — e qui la si prova sui testi che cambiano davanti al cliente a
// pagina aperta: il conto alla rovescia della modifica da confermare e il
// tasto del pagamento dopo un pagamento fallito. (Lo stato dell'ordine lo
// prova tests/sistema/menuTradotto.spec.js, in un browser vero.)
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/paymentsApi.js', () => ({
  createPaymentCheckout: vi.fn(),
  getPaymentStatus: vi.fn(),
}))
vi.mock('../../src/lib/sumupWidget.js', () => ({ mountCardWidget: vi.fn() }))

const { default: ModificaDaConfermare } = await import('../../src/components/ModificaDaConfermare.jsx')
const { default: PaymentPanel } = await import('../../src/components/PaymentPanel.jsx')

// Quello che fa il traduttore: ogni testo con delle parole diventa
// <font><font>EN …</font></font>, e il nodo originale esce dalla pagina.
function traduci(radice) {
  const giro = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT)
  const nodi = []
  while (giro.nextNode()) nodi.push(giro.currentNode)
  for (const n of nodi) {
    if (!/[A-Za-zÀ-ÿ]/.test(n.nodeValue)) continue
    const fuori = document.createElement('font')
    const dentro = document.createElement('font')
    dentro.textContent = `EN ${n.nodeValue}`
    fuori.appendChild(dentro)
    n.parentNode.replaceChild(fuori, n)
  }
}

describe('i testi che cambiano a pagina aperta seguono il conto anche tradotti', () => {
  it('il conto alla rovescia della modifica da confermare', () => {
    const conScadenza = (minuti) => ({
      id: 'o1',
      total: 8,
      attesa_cliente: {
        dal: new Date().toISOString(),
        scade: new Date(Date.now() + minuti * 60000 - 1000).toISOString(),
        totale_prima: 8,
      },
    })
    const { container, rerender } = render(<ModificaDaConfermare order={conScadenza(5)} onRispondi={() => {}} />)
    expect(container).toHaveTextContent('Restano 5 minuti per rispondere')
    traduci(container)
    rerender(<ModificaDaConfermare order={conScadenza(2)} onRispondi={() => {}} />)
    expect(container).toHaveTextContent('Restano 2 minuti per rispondere')
    expect(container).not.toHaveTextContent('5 minuti')
  })

  it('il tasto del pagamento, dopo un pagamento fallito', () => {
    const ordine = (stato) => ({ id: 'o1', total: 12, payment_status: stato, payment_required: false })
    const { container, rerender } = render(<PaymentPanel order={ordine('non_pagato')} />)
    expect(screen.getByRole('button')).toHaveTextContent('Paga ora 12,00 €')
    traduci(container)
    rerender(<PaymentPanel order={ordine('fallito')} />)
    expect(screen.getAllByRole('button').at(-1)).toHaveTextContent('Riprova il pagamento')
  })
})
