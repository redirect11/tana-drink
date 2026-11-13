// @vitest-environment happy-dom
'use strict'

// IL PRODOTTO DELLA CASSA DA UNA BOTTIGLIA DEL MAGAZZINO (REQ-AI-002).
// «Crea il prodotto della cassa» apre nel Menù la scheda di un prodotto
// nuovo, già collegato a quella bottiglia: nome, categoria della cassa con
// lo stesso nome di quella di magazzino, ricetta con la riga della
// bottiglia. La quantità resta vuota e la scrive chi crea (Daniele,
// 13/11/2026: «non c'è una dose fissa»): una riga senza quantità non si
// salva più in silenzio. La descrizione AI parte da sola all'apertura.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const chiamata = vi.fn()
vi.mock('../../src/porte/funzioni.js', () => ({ chiamaFunzione: (_nome, dati) => chiamata(dati) }))
vi.mock('../../src/lib/limiti.js', async (originale) => ({ ...(await originale()), senzaFunctions: () => false }))
// Il prezzo consigliato ascolta le impostazioni: qui bastano quelle di partenza.
vi.mock('../../src/lib/api.js', () => ({
  subscribeSettings: (cb) => {
    cb({})
    return () => {}
  },
  DEFAULT_SETTINGS: {},
}))

import { prodottoDaMagazzino, mettiProdottoInArrivo, prendiProdottoInArrivo, ascoltaProdottoInArrivo } from '../../src/lib/prodottoDaMagazzino.js'
import { _azzeraStatoAI } from '../../src/lib/statoAI.js'
import DrinkForm from '../../src/components/DrinkForm.jsx'

const GIN = { id: 'i1', name: 'Tanqueray', unit: 'ml', package_size: 700, category_id: 'm1' }

beforeEach(() => {
  chiamata.mockReset()
  _azzeraStatoAI()
})

describe('la scheda dalla bottiglia', () => {
  it('nome, categoria della cassa con lo stesso nome, ricetta con la quantità vuota', () => {
    const p = prodottoDaMagazzino(GIN, { categorieMagazzino: [{ id: 'm1', name: 'GIN' }], categorieCassa: [{ id: 'c1', name: 'Gin' }, { id: 'c2', name: 'Cocktail' }] })
    expect(p).toMatchObject({
      name: 'Tanqueray',
      category_id: 'c1',
      price: '',
      available: true,
      recipe_items: [{ inventory_item_id: 'i1', qty: '', unit: 'ml', name: 'Tanqueray' }],
      da_magazzino: true,
    })
  })

  it('senza una categoria della cassa con quel nome, nessuna; il prezzo proposto dalla chat si prende', () => {
    const p = prodottoDaMagazzino(GIN, { categorieMagazzino: [{ id: 'm1', name: 'Distillati' }], categorieCassa: [{ id: 'c1', name: 'Gin' }], prezzo: 7 })
    expect(p.category_id).toBe('')
    expect(p.price).toBe(7)
  })

  // Dal magazzino o dalla chat al Menù, una volta sola; il Menù già aperto
  // la sente arrivare.
  it('passa al Menù una volta sola, e chi ascolta la sente', () => {
    const sente = vi.fn()
    const smetti = ascoltaProdottoInArrivo(sente)
    mettiProdottoInArrivo({ name: 'Tanqueray' })
    expect(sente).toHaveBeenCalledTimes(1)
    expect(prendiProdottoInArrivo()).toEqual({ name: 'Tanqueray' })
    expect(prendiProdottoInArrivo()).toBeNull()
    smetti()
  })
})

const scheda = (initial, onSave = vi.fn()) => {
  render(
    <DrinkForm initial={initial} categories={[{ id: 'c1', name: 'Gin' }]} inventory={[GIN]} onCreateCategory={vi.fn()} onCancel={vi.fn()} onSave={onSave} />
  )
  return onSave
}

describe('la scheda nel Menù', () => {
  it('senza la quantità della ricetta non si salva, e dice perché', async () => {
    chiamata.mockResolvedValue({ ok: false, codice: 'spento' })
    const onSave = scheda(prodottoDaMagazzino(GIN, { categorieCassa: [] }))
    fireEvent.submit(screen.getByRole('button', { name: /Salva/ }).closest('form'))
    expect(await screen.findByText(/Manca la quantità di «Tanqueray» nella ricetta: è la dose che si scala a ogni vendita\./)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText('Qta'), { target: { value: '4' } })
    fireEvent.submit(screen.getByRole('button', { name: /Salva/ }).closest('form'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
  })

  it('la descrizione AI parte da sola, con l’AI attiva', async () => {
    chiamata.mockImplementation(async (dati) =>
      dati.tipo === 'credito'
        ? { ok: true, tipo: 'credito', credito_eur: 5, tetto_mensile_eur: 20, speso_mese_eur: 0, attivo: true, motivo: null }
        : { ok: true, tipo: 'descrizione', risultato: { descrizione: 'London dry, ginepro deciso.', da_verificare: [] }, costo_eur: 0.002, credito_eur: 4.99 }
    )
    scheda(prodottoDaMagazzino(GIN, { categorieCassa: [] }))
    expect(await screen.findByText('London dry, ginepro deciso.')).toBeInTheDocument()
    expect(chiamata).toHaveBeenCalledWith({ tipo: 'descrizione', nome: 'Tanqueray' })
  })

  it('una scheda qualunque non chiede niente da sola', async () => {
    chiamata.mockResolvedValue({ ok: true, tipo: 'credito', credito_eur: 5, tetto_mensile_eur: 20, speso_mese_eur: 0, attivo: true, motivo: null })
    scheda({ name: 'Negroni', price: 8, available: true, recipe_items: [] })
    await waitFor(() => expect(chiamata).toHaveBeenCalled())
    expect(chiamata.mock.calls.map((c) => c[0].tipo)).toEqual(['credito'])
  })
})
