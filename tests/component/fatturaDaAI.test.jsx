// @vitest-environment happy-dom
'use strict'

// IL DOCUMENTO LETTO DALL'AI (REQ-AI-001, FatturaDaAI.jsx). Si sceglie la
// foto o il PDF, la regia la legge, e la proposta si rivede campo per
// campo prima di «Registra il documento». Il carico a magazzino parte
// spento; il documento letto si allega da sé, e un allegato non riuscito
// non annulla la registrazione.
//
// La chiamata alla Function è finta (la prova tests/bdd/richiesta-ai.test.js),
// e così le scritture: qui si guarda cosa la schermata chiede di scrivere.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const chiamata = vi.fn()
vi.mock('../../src/porte/funzioni.js', () => ({ chiamaFunzione: (_nome, dati) => chiamata(dati) }))
vi.mock('../../src/lib/limiti.js', async (originale) => ({ ...(await originale()), senzaFunctions: () => false }))
vi.mock('../../src/lib/storage.js', () => ({ fotoDiFatturaLeggibile: (f) => Promise.resolve(f) }))
const createSupplierInvoice = vi.fn(async (d) => ({ id: 'f1', ...d }))
const aggiungiProdottiAFattura = vi.fn(async () => ({}))
const allegaDocumentoAFattura = vi.fn(async () => ({}))
vi.mock('../../src/lib/api.js', () => ({
  createSupplierInvoice: (...a) => createSupplierInvoice(...a),
  aggiungiProdottiAFattura: (...a) => aggiungiProdottiAFattura(...a),
  allegaDocumentoAFattura: (...a) => allegaDocumentoAFattura(...a),
}))

import FatturaDaAI from '../../src/components/FatturaDaAI.jsx'

const SUPPLIERS = [{ id: 's1', name: 'Rossi Bevande' }, { id: 's2', name: 'Caffè Bianchi' }]
const ITEMS = [{ id: 'i1', name: 'Gin Tanqueray', unit: 'ml', package_size: 700, vat: 22 }]
const LETTA = {
  ok: true,
  tipo: 'fattura',
  risultato: {
    fornitore: { ragione_sociale: 'ROSSI BEVANDE SRL', partita_iva: null },
    numero: '123',
    data: '2026-11-10',
    righe: [
      { descrizione: 'GIN TANQUERAY 70CL', codice: null, quantita: 6, unita: 'bt', prezzo_unitario: 20, sconto_percentuale: 10, aliquota_iva: 22, importo: 108 },
      { descrizione: 'TRASPORTO', codice: null, quantita: 1, unita: null, prezzo_unitario: 5, sconto_percentuale: null, aliquota_iva: 22, importo: 5 },
    ],
    imponibile: 113,
    iva: 24.86,
    totale: 137.86,
    da_verificare: ['il numero è poco leggibile'],
  },
  costo_eur: 0.04,
  credito_eur: 4.9,
}

beforeEach(() => {
  chiamata.mockReset()
  createSupplierInvoice.mockClear()
  aggiungiProdottiAFattura.mockClear()
  allegaDocumentoAFattura.mockReset()
  allegaDocumentoAFattura.mockResolvedValue({})
})

const mostra = () => {
  const onRegistrata = vi.fn()
  render(<FatturaDaAI suppliers={SUPPLIERS} items={ITEMS} listini={[]} onAnnulla={vi.fn()} onRegistrata={onRegistrata} />)
  return onRegistrata
}
const pdf = () => new File(['%PDF-1.4 fattura'], 'fattura.pdf', { type: 'application/pdf' })
const scegli = (user, file) => user.upload(screen.getByLabelText('La foto o il PDF della fattura'), file)

describe('la lettura', () => {
  it('manda il documento in base64 e mostra la proposta da rivedere', async () => {
    const user = userEvent.setup()
    chiamata.mockResolvedValue(LETTA)
    mostra()
    await scegli(user, pdf())
    expect(chiamata).toHaveBeenCalledWith({ tipo: 'fattura', file: btoa('%PDF-1.4 fattura'), media_type: 'application/pdf' })
    expect(await screen.findByRole('group', { name: 'Documento letto dall’AI' })).toBeInTheDocument()
    expect(screen.getByLabelText('Fornitore *')).toHaveValue('s1')
    expect(screen.getByText('Sul documento: ROSSI BEVANDE SRL')).toBeInTheDocument()
    expect(screen.getByLabelText('Numero doc.')).toHaveValue('123')
    expect(screen.getByText('il numero è poco leggibile')).toBeInTheDocument()
    expect(screen.getByText(/Costo della lettura 0,04 € · credito rimasto 4,90 €/)).toBeInTheDocument()
    // La riga riconosciuta è spuntata, quella senza prodotto no.
    expect(screen.getByLabelText('Prodotto per «GIN TANQUERAY 70CL»')).toHaveValue('i1')
    expect(screen.getByLabelText('Prodotto per «TRASPORTO»')).toHaveValue('')
  })

  it('un formato che il cassetto non legge non parte nemmeno', async () => {
    const user = userEvent.setup({ applyAccept: false })
    mostra()
    await scegli(user, new File(['ciao'], 'nota.txt', { type: 'text/plain' }))
    expect(await screen.findByRole('status')).toHaveTextContent('foto (JPEG, PNG, WEBP o GIF) o un PDF')
    expect(chiamata).not.toHaveBeenCalled()
  })

  // Si ferma solo l'AI, e lo dice: il resto del pannello lavora come sempre.
  it('senza credito lo dice, e non registra niente', async () => {
    const user = userEvent.setup()
    chiamata.mockResolvedValue({ ok: false, codice: 'credito', credito_eur: 0 })
    mostra()
    await scegli(user, pdf())
    expect(await screen.findByText(/Il credito AI del locale è finito/)).toBeInTheDocument()
    expect(createSupplierInvoice).not.toHaveBeenCalled()
  })
})

describe('la registrazione', () => {
  it('registra il documento, le righe spuntate senza carico, e allega il file letto', async () => {
    const user = userEvent.setup()
    chiamata.mockResolvedValue(LETTA)
    const onRegistrata = mostra()
    const file = pdf()
    await scegli(user, file)
    await user.click(await screen.findByRole('button', { name: 'Registra il documento' }))
    expect(createSupplierInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ supplier_id: 's1', supplier_name: 'Rossi Bevande', number: '123', doc_type: 'Fattura', amount: 137.86, paid: false })
    )
    expect(aggiungiProdottiAFattura).toHaveBeenCalledWith('f1', {
      righe: [expect.objectContaining({ item_id: 'i1', qty_packages: 6, unit_cost: 18, vat: 22 })],
      carica: false,
    })
    expect(allegaDocumentoAFattura).toHaveBeenCalledWith('f1', file)
    expect(onRegistrata).toHaveBeenCalledWith({ id: 'f1', avviso: null })
  })

  it('il carico a magazzino si accende a mano', async () => {
    const user = userEvent.setup()
    chiamata.mockResolvedValue(LETTA)
    mostra()
    await scegli(user, pdf())
    await user.click(await screen.findByLabelText('Carica le righe a magazzino'))
    await user.click(screen.getByRole('button', { name: 'Registra il documento' }))
    expect(aggiungiProdottiAFattura).toHaveBeenCalledWith('f1', expect.objectContaining({ carica: true }))
  })

  it('senza fornitore non si registra', async () => {
    const user = userEvent.setup()
    chiamata.mockResolvedValue({ ...LETTA, risultato: { ...LETTA.risultato, fornitore: { ragione_sociale: 'Sconosciuto', partita_iva: null } } })
    mostra()
    await scegli(user, pdf())
    expect(await screen.findByRole('button', { name: 'Registra il documento' })).toBeDisabled()
  })

  // Il documento c'è già: l'allegato si rifà dalla riga, come sempre.
  it('un allegato non riuscito non annulla la registrazione, e lo dice', async () => {
    const user = userEvent.setup()
    chiamata.mockResolvedValue(LETTA)
    allegaDocumentoAFattura.mockRejectedValue(new Error('rete assente'))
    const onRegistrata = mostra()
    await scegli(user, pdf())
    await user.click(await screen.findByRole('button', { name: 'Registra il documento' }))
    expect(createSupplierInvoice).toHaveBeenCalled()
    expect(onRegistrata).toHaveBeenCalledWith({ id: 'f1', avviso: expect.stringMatching(/allegato non è stato caricato: rete assente/) })
  })
})
