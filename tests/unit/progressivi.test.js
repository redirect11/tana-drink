// @vitest-environment happy-dom
'use strict'

// I NUMERI DEGLI ORDINI, SENZA ASPETTARE NESSUNO. Prima di scrivere un
// ordine si facevano tre letture al server, e due creazioni ravvicinate
// leggevano lo stesso numero: al banco sono nati due conti #15 nella stessa
// serata. Il numero adesso si prende da quello che si ha già in memoria, e
// ci si ricorda cosa si è assegnato — anche se la scrittura del contatore è
// ancora per strada.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/firebaseClient.js', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: (_db, _col, id) => ({ id }),
  onSnapshot: () => () => {},
  setDoc: vi.fn(() => Promise.resolve()),
  increment: (n) => ({ inc: n }),
}))

const {
  prossimo,
  prendiNumero,
  contatoreCorrente,
  cassaCorrente,
  _azzeraProgressivi,
  _fingiServer,
} = await import('../../src/lib/progressivi.js')

beforeEach(() => {
  localStorage.clear()
  _azzeraProgressivi()
})

describe('il prossimo numero', () => {
  it('è il più grande fra server e nostro, più uno', () => {
    expect(prossimo(10, 0)).toBe(11)
    // La scrittura del contatore è ancora per strada: il server dice ancora
    // 10, ma noi il 11 l'abbiamo già dato.
    expect(prossimo(10, 11)).toBe(12)
    expect(prossimo(undefined, undefined)).toBe(1)
  })

  it('due conti di fila non prendono lo stesso numero', () => {
    _fingiServer({ contatori: { 'cash-1': 14 } })
    expect(prendiNumero('cash-1')).toBe(15)
    // Nessuna attesa nel mezzo: è il caso che ha creato due conti #15.
    expect(prendiNumero('cash-1')).toBe(16)
    expect(prendiNumero('cash-1')).toBe(17)
  })

  it('e nemmeno dopo un ricaricamento della pagina', () => {
    _fingiServer({ contatori: { 'cash-1': 14 } })
    expect(prendiNumero('cash-1')).toBe(15)
    // Quello che si è dato resta scritto: riaprendo l'app si riparte da lì,
    // non dal numero del server (che è ancora indietro).
    expect(JSON.parse(localStorage.getItem('tana:progressivi'))['cash-1']).toBe(15)
    expect(prossimo(14, 15)).toBe(16)
  })

  it('il server che si allinea non fa tornare indietro i numeri', () => {
    _fingiServer({ contatori: { 'cash-1': 14 } })
    expect(prendiNumero('cash-1')).toBe(15)
    // Un altro dispositivo ha battuto: il server ora dice 20.
    _fingiServer({ contatori: { 'cash-1': 20 } })
    expect(prendiNumero('cash-1')).toBe(21)
  })

  it('senza cassa aperta si conta per giornata, come prima', () => {
    expect(cassaCorrente()).toBe(null)
    expect(contatoreCorrente(5)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    _fingiServer({ sessione: 'cassa-1' })
    expect(contatoreCorrente(5)).toBe('cash-cassa-1')
  })
})
