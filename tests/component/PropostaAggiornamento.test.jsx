// @vitest-environment happy-dom
'use strict'

// ── LA PROPOSTA DI AGGIORNAMENTO, AL TITOLARE (REQ-FLOTTA-020) ────────
//
// In modalità «a scelta» la regia non pubblica: propone. Il titolare vede
// prima le novità e risponde «Aggiorna», «Salta questa versione» o «Più
// tardi»; la risposta va in `aggiornamenti/scelta`, che la regia legge.
//
// SENZA RETE, come al banco: si mocka solo Firestore, ogni scrittura resta
// appesa per sempre, e il box deve chiudersi lo stesso nell'istante del
// tocco. La scelta appena scritta torna dall'ascolto del documento, come
// fa la cache vera.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const mai = () => new Promise(() => {})
const scritture = []
let emettiScelta = null

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'admin-1' } },
  functions: {},
  storage: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: (_db, col, id) => ({ col, id }),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocFromCache: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn(() => mai()),
  setDoc: vi.fn((ref, data) => {
    scritture.push({ ref, data })
    // La cache vede la scrittura subito, il server mai.
    if (ref?.col === 'aggiornamenti') emettiScelta?.({ exists: () => true, data: () => data })
    return mai()
  }),
  updateDoc: vi.fn(() => mai()),
  deleteDoc: vi.fn(() => mai()),
  query: () => ({}),
  where: () => ({}),
  documentId: () => 'id',
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: (ref, cb) => {
    if (ref?.col === 'aggiornamenti') {
      emettiScelta = cb
      cb({ exists: () => false, data: () => null })
    }
    return () => {}
  },
  serverTimestamp: () => 'ORA-DEL-SERVER',
  increment: (n) => n,
  writeBatch: () => ({ update: vi.fn(), set: vi.fn(), commit: () => mai() }),
  Timestamp: class Timestamp {
    static fromDate(d) { return d }
    static fromMillis(m) { return m }
  },
}))

const recordNotif = vi.fn()
vi.mock('../../src/lib/notifyStore.js', () => ({ recordNotif: (...a) => recordNotif(...a) }))

const { default: PropostaAggiornamento } = await import('../../src/components/PropostaAggiornamento.jsx')
const { default: InfoTab } = await import('../../src/components/InfoTab.jsx')

const proposta = (extra = {}) => ({ tag: 'v99.0.0', note: '## 99.0.0 — novembre\n- **Il conto diviso** per persona', ...extra })
const aScelta = (extra = {}) => ({
  licenza: { piano: 'pro', regia_url: 'https://regia.example/area', aggiornamenti: { modalita: 'a_scelta', inclusi: true, proposta: proposta(), ...extra } },
})
const scelte = () => scritture.filter((s) => s.ref?.col === 'aggiornamenti').map((s) => s.data)

beforeEach(() => {
  cleanup()
  scritture.length = 0
  emettiScelta = null
  recordNotif.mockClear()
  localStorage.clear()
  globalThis.fetch = vi.fn(() => mai())
})

describe('il box della proposta', () => {
  it('al titolare mostra prima le novità, con i tre tasti', () => {
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    expect(screen.getByRole('dialog', { name: 'Aggiornamento disponibile' })).toBeInTheDocument()
    expect(screen.getByText('Versione 99.0.0 disponibile')).toBeInTheDocument()
    expect(screen.getByText('Il conto diviso')).toBeInTheDocument()
    for (const nome of ['Aggiorna', 'Salta questa versione', 'Più tardi']) {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument()
    }
  })

  it('«Aggiorna» scrive la scelta e dice cosa succede, senza aspettare la rete', () => {
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(scelte()).toEqual([{ tag: 'v99.0.0', scelta: 'aggiorna', il: 'ORA-DEL-SERVER', da: 'admin-1' }])
    expect(screen.getByText('Aggiornamento chiesto: arriva entro una ventina di minuti.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    // La scelta c'è: il box non la richiede.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('«Salta questa versione» scrive la scelta e chiude subito', () => {
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Salta questa versione' }))
    expect(scelte()).toEqual([expect.objectContaining({ tag: 'v99.0.0', scelta: 'salta' })])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('«Più tardi» non scrive niente: il box torna alla prossima apertura', () => {
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Più tardi' }))
    expect(scelte()).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    expect(screen.getByRole('dialog', { name: 'Aggiornamento disponibile' })).toBeInTheDocument()
  })

  it('sparisce da solo quando la regia cambia la proposta (scelta fatta altrove)', () => {
    const { rerender } = render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    rerender(<PropostaAggiornamento settings={aScelta({ proposta: null })} ruolo="admin" />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('una scelta arrivata da un altro terminale lo chiude', () => {
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    act(() => emettiScelta({ exists: () => true, data: () => ({ tag: 'v99.0.0', scelta: 'aggiorna' }) }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a chi non è titolare non esce, e il documento della scelta non lo ascolta', () => {
    for (const ruolo of ['bartender', 'staff', null]) {
      render(<PropostaAggiornamento settings={aScelta()} ruolo={ruolo} />)
      expect(screen.queryByRole('dialog')).toBeNull()
      cleanup()
    }
    expect(emettiScelta).toBeNull()
  })

  it('la Tana, senza la voce nella licenza, non vede niente', () => {
    render(<PropostaAggiornamento settings={{}} ruolo="admin" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(emettiScelta).toBeNull()
  })

  it('non esce sopra il box delle novità', () => {
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" inPausa />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('l’avviso delle condizioni', () => {
  const conAvviso = aScelta({
    proposta: null,
    avviso: { id: 'condizioni-2026-11', testo: 'Le condizioni cambiano.', dal: '2026-12-01T12:00:00Z' },
  })

  it('esce una volta per id, e resta in campanella', () => {
    render(<PropostaAggiornamento settings={conAvviso} ruolo="admin" />)
    expect(screen.getByRole('dialog', { name: 'Avviso sulle condizioni del servizio' })).toBeInTheDocument()
    expect(screen.getByText('Le condizioni cambiano.')).toBeInTheDocument()
    expect(screen.getByText('In vigore dal 1 dicembre 2026.')).toBeInTheDocument()
    expect(recordNotif).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Ho letto' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    render(<PropostaAggiornamento settings={conAvviso} ruolo="admin" />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('prima l’avviso, poi la proposta', () => {
    const tutti = aScelta({ avviso: { id: 'a1', testo: 'Testo.' } })
    render(<PropostaAggiornamento settings={tutti} ruolo="admin" />)
    expect(screen.getByRole('dialog', { name: 'Avviso sulle condizioni del servizio' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ho letto' }))
    expect(screen.getByRole('dialog', { name: 'Aggiornamento disponibile' })).toBeInTheDocument()
  })
})

describe('Impostazioni → Informazioni', () => {
  it('la proposta saltata resta, col suo «Aggiorna»', () => {
    render(<InfoTab settings={aScelta({ proposta: proposta({ saltata_il: '2026-11-02T10:00:00Z' }) })} role="admin" />)
    expect(screen.getByText('Aggiornamenti')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(scelte()).toEqual([expect.objectContaining({ tag: 'v99.0.0', scelta: 'aggiorna' })])
    expect(screen.getByText('Aggiornamento chiesto: arriva entro una ventina di minuti.')).toBeInTheDocument()
  })

  it('a chi non è titolare dice che la decide il titolare', () => {
    render(<InfoTab settings={aScelta()} role="bartender" />)
    expect(screen.getByText(/lo decide il titolare/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aggiorna' })).toBeNull()
  })

  it('senza aggiornamenti nel piano dice perché, con i piani della regia', () => {
    render(<InfoTab settings={aScelta({ inclusi: false, motivo: 'non_pagato', proposta: null })} role="admin" />)
    expect(screen.getByText(/abbonamento non risulta pagato/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vedi i piani' })).toHaveAttribute('href', 'https://regia.example/area')
  })

  it('la Tana non ha la scheda', () => {
    render(<InfoTab settings={{}} role="admin" />)
    expect(screen.queryByText('Aggiornamenti')).toBeNull()
  })
})
