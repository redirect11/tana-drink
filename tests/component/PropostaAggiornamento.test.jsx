// @vitest-environment happy-dom
'use strict'

// ── LA PROPOSTA DI AGGIORNAMENTO, AL TITOLARE (REQ-FLOTTA-020) ────────
//
// In modalità «a scelta» la regia non pubblica: propone. Il titolare vede
// prima le novità e risponde «Aggiorna», «Salta questa versione» o «Più
// tardi». Dal 31/10/2026 la risposta è una CHIAMATA alla regia
// (`licenza.aggiornamenti.scelta_url`, POST col token del titolare), non
// più un documento in Firestore che la regia leggeva ogni dieci minuti.
//
// Firestore è mockato come senza rete (ogni scrittura resta appesa), per
// provare che la scelta non passa più di lì; la regia è un `fetch` finto
// che risponde come il contratto in docs/aggiornamenti-dalla-regia.md.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const mai = () => new Promise(() => {})
const scritture = []

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'admin-1', getIdToken: async () => 'TOKEN-DEL-TITOLARE' } },
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
  addDoc: vi.fn((ref, data) => {
    scritture.push({ ref, data })
    return mai()
  }),
  setDoc: vi.fn((ref, data) => {
    scritture.push({ ref, data })
    return mai()
  }),
  updateDoc: vi.fn(() => mai()),
  deleteDoc: vi.fn(() => mai()),
  query: () => ({}),
  where: () => ({}),
  documentId: () => 'id',
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
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
const { ATTESA_SCELTA_MS } = await import('../../src/lib/api.js')

const URL_SCELTA = 'https://europe-west1-drink-regia.cloudfunctions.net/sceltaDallApp'
const AREA = 'https://regia.example/area'
const proposta = (extra = {}) => ({ tag: 'v99.0.0', note: '## 99.0.0 — novembre\n- **Il conto diviso** per persona', ...extra })
const aScelta = (extra = {}) => ({
  licenza: {
    piano: 'pro',
    regia_url: AREA,
    aggiornamenti: { modalita: 'a_scelta', inclusi: true, scelta_url: URL_SCELTA, proposta: proposta(), ...extra },
  },
})

// La regia finta. `chiamate` tiene quello che le arriva; `regiaRisponde`
// decide cosa risponde. Le Informazioni chiedono anche il changelog
// (`/changelog.md`), che qui non conta.
let chiamate = []
const regiaRisponde = (status, corpo) => {
  globalThis.fetch = vi.fn(async (url, opzioni) => {
    if (!String(url).startsWith('https://')) return mai()
    chiamate.push({ url, opzioni })
    return { status, json: async () => (corpo === undefined ? Promise.reject(new SyntaxError('non è JSON')) : corpo) }
  })
}
const corpi = () => chiamate.map((c) => JSON.parse(c.opzioni.body))
const box = () => screen.queryByRole('dialog', { name: 'Aggiornamento disponibile' })

beforeEach(() => {
  cleanup()
  scritture.length = 0
  chiamate = []
  recordNotif.mockClear()
  localStorage.clear()
  regiaRisponde(200, { ok: true, scelta: 'aggiorna' })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('il box della proposta', () => {
  it('al titolare mostra prima le novità, con i tre tasti', () => {
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    expect(box()).toBeInTheDocument()
    expect(screen.getByText('Versione 99.0.0 disponibile')).toBeInTheDocument()
    expect(screen.getByText('Il conto diviso')).toBeInTheDocument()
    for (const nome of ['Aggiorna', 'Salta questa versione', 'Più tardi']) {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument()
    }
  })

  it('«Aggiorna» chiama la regia col token del titolare, e con 200 dice che è partito', async () => {
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(await screen.findByText('Aggiornamento partito: arriva in pochi minuti.')).toBeInTheDocument()

    expect(chiamate).toHaveLength(1)
    const { url, opzioni } = chiamate[0]
    expect(url).toBe(URL_SCELTA)
    expect(opzioni.method).toBe('POST')
    expect(opzioni.headers).toEqual({ Authorization: 'Bearer TOKEN-DEL-TITOLARE', 'Content-Type': 'application/json' })
    expect(corpi()).toEqual([{ tag: 'v99.0.0', scelta: 'aggiorna' }])
    // Nel database non si scrive più niente.
    expect(scritture).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    // La regia l'ha presa: il box non la richiede, anche prima che la
    // proposta cambi nella licenza.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('un locale della regia di test chiama la regia di test', async () => {
    const TEST = 'https://europe-west1-drink-regia-test.cloudfunctions.net/sceltaDallApp'
    render(<PropostaAggiornamento settings={aScelta({ scelta_url: TEST })} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(await screen.findByText('Aggiornamento partito: arriva in pochi minuti.')).toBeInTheDocument()
    expect(chiamate.map((c) => c.url)).toEqual([TEST])
  })

  it('mentre aspetta la regia i tasti sono spenti, e un secondo tocco non rifà la chiamata', async () => {
    let rispondi
    globalThis.fetch = vi.fn((url, opzioni) => {
      chiamate.push({ url, opzioni })
      return new Promise((r) => (rispondi = r))
    })
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(screen.getByText('Invio della scelta…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aggiorna' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Salta questa versione' })).toBeDisabled()
    // «Più tardi» resta: chiudere il box non deve aspettare la rete.
    expect(screen.getByRole('button', { name: 'Più tardi' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    await act(async () => {})
    expect(chiamate).toHaveLength(1)
    await act(async () => rispondi({ status: 200, json: async () => ({ ok: true }) }))
    expect(screen.getByText('Aggiornamento partito: arriva in pochi minuti.')).toBeInTheDocument()
  })

  it('«Salta questa versione», con 200, chiude il box', async () => {
    regiaRisponde(200, { ok: true, scelta: 'salta' })
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Salta questa versione' }))
    await act(async () => {})
    expect(corpi()).toEqual([{ tag: 'v99.0.0', scelta: 'salta' }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    [400, 'Richiesta non valida.'],
    [401, 'Accesso scaduto: uscire e rientrare.'],
    [403, 'La scelta spetta al titolare.'],
    [404, 'Questo locale non risulta tra quelli gestiti.'],
    [409, 'La proposta è cambiata: la versione v99.0.0 non è più quella proposta.'],
    [502, 'L’aggiornamento non è partito: la pubblicazione non ha risposto.'],
  ])('con %i mostra il testo della regia e lascia i tasti', async (status, errore) => {
    regiaRisponde(status, { errore })
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(errore)
    expect(box()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aggiorna' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Salta questa versione' })).toBeEnabled()
  })

  it('una risposta senza testo (non JSON) ha una frase sua', async () => {
    regiaRisponde(500, undefined)
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La scelta non è stata registrata. Riprovare tra qualche minuto.')
  })

  it('senza rete dice che la scelta non è partita, e i tasti restano', async () => {
    // Il perché resta in console, per chi indaga: qui è previsto.
    const avviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/la scelta non è partita/)
    expect(screen.getByRole('button', { name: 'Aggiorna' })).toBeEnabled()
    expect(avviso).toHaveBeenCalledWith('[aggiornamenti] scelta:', 'Failed to fetch')
    avviso.mockRestore()
  })

  it('se la regia non risponde, dopo l’attesa massima lo dice', async () => {
    vi.useFakeTimers()
    const avviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    globalThis.fetch = vi.fn(
      (url, { signal }) =>
        new Promise((_, rifiuta) => signal.addEventListener('abort', () => rifiuta(new DOMException('fermato', 'AbortError'))))
    )
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    await act(async () => {})
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => vi.advanceTimersByTime(ATTESA_SCELTA_MS))
    expect(screen.getByRole('alert')).toHaveTextContent(/la scelta non è partita/)
    expect(avviso).toHaveBeenCalledTimes(1)
    avviso.mockRestore()
  })

  it('senza `scelta_url` (una licenza di prima) rimanda all’area clienti', () => {
    const { aggiornamenti } = aScelta().licenza
    const senza = { licenza: { ...aScelta().licenza, aggiornamenti: { ...aggiornamenti, scelta_url: undefined } } }
    render(<PropostaAggiornamento settings={senza} ruolo="admin" />)
    expect(screen.queryByRole('button', { name: 'Aggiorna' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salta questa versione' })).toBeNull()
    expect(screen.getByText('La scelta su questa versione si fa dall’area clienti.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apri l’area clienti' })).toHaveAttribute('href', AREA)
    expect(screen.getByRole('button', { name: 'Più tardi' })).toBeInTheDocument()
    expect(chiamate).toEqual([])
  })

  it('un `scelta_url` che non è della regia non riceve il token: si sceglie dall’area clienti', () => {
    // Finché la licenza sta in settings/bar (BUG-125) un bartender la può
    // riscrivere: un indirizzo suo si prenderebbe il token del titolare.
    for (const altrove of [
      'https://ruba-token.example/scelta',
      'http://europe-west1-drink-regia.cloudfunctions.net/sceltaDallApp',
      'https://europe-west1-drink-regia.cloudfunctions.net.example.com/sceltaDallApp',
      'https://europe-west1-altro.cloudfunctions.net/sceltaDallApp',
      'https://europe-west1-foo-drink-regia.cloudfunctions.net/sceltaDallApp',
    ]) {
      render(<PropostaAggiornamento settings={aScelta({ scelta_url: altrove })} ruolo="admin" />)
      expect(screen.queryByRole('button', { name: 'Aggiorna' })).toBeNull()
      expect(screen.getByRole('link', { name: 'Apri l’area clienti' })).toBeInTheDocument()
      cleanup()
    }
    expect(chiamate).toEqual([])
  })

  it('«Più tardi» non chiama nessuno: il box torna alla prossima apertura', () => {
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Più tardi' }))
    expect(chiamate).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    expect(box()).toBeInTheDocument()
  })

  it('sparisce da solo quando la regia cambia la proposta (scelta fatta altrove)', () => {
    const { rerender } = render(<PropostaAggiornamento settings={aScelta()} ruolo="admin" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    rerender(<PropostaAggiornamento settings={aScelta({ proposta: null })} ruolo="admin" />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a chi non è titolare non esce', () => {
    for (const ruolo of ['bartender', 'staff', null]) {
      render(<PropostaAggiornamento settings={aScelta()} ruolo={ruolo} />)
      expect(screen.queryByRole('dialog')).toBeNull()
      cleanup()
    }
  })

  it('la Tana, senza la voce nella licenza, non vede niente', () => {
    render(<PropostaAggiornamento settings={{}} ruolo="admin" />)
    expect(screen.queryByRole('dialog')).toBeNull()
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
    expect(box()).toBeInTheDocument()
  })
})

describe('Impostazioni → Informazioni', () => {
  const saltata = () => aScelta({ proposta: proposta({ saltata_il: '2026-11-02T10:00:00Z' }) })

  it('la proposta saltata resta, col suo «Aggiorna» che chiama la regia', async () => {
    render(<InfoTab settings={saltata()} role="admin" />)
    expect(screen.getByText('Aggiornamenti')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(await screen.findByText('Aggiornamento partito: arriva in pochi minuti.')).toBeInTheDocument()
    expect(chiamate.map((c) => c.url)).toEqual([URL_SCELTA])
    expect(corpi()).toEqual([{ tag: 'v99.0.0', scelta: 'aggiorna' }])
    expect(screen.queryByRole('button', { name: 'Aggiorna' })).toBeNull()
  })

  it('con un errore mostra il testo della regia e lascia «Aggiorna»', async () => {
    regiaRisponde(409, { errore: 'La proposta è cambiata.' })
    render(<InfoTab settings={saltata()} role="admin" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aggiorna' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La proposta è cambiata.')
    expect(screen.getByRole('button', { name: 'Aggiorna' })).toBeEnabled()
  })

  it('senza `scelta_url` rimanda all’area clienti', () => {
    render(<InfoTab settings={aScelta({ scelta_url: null })} role="admin" />)
    expect(screen.queryByRole('button', { name: 'Aggiorna' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Apri l’area clienti' })).toHaveAttribute('href', AREA)
  })

  it('a chi non è titolare dice che la decide il titolare', () => {
    render(<InfoTab settings={aScelta()} role="bartender" />)
    expect(screen.getByText(/lo decide il titolare/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aggiorna' })).toBeNull()
  })

  it('senza aggiornamenti nel piano dice perché, con i piani della regia', () => {
    render(<InfoTab settings={aScelta({ inclusi: false, motivo: 'non_pagato', proposta: null })} role="admin" />)
    expect(screen.getByText(/abbonamento non risulta pagato/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vedi i piani' })).toHaveAttribute('href', AREA)
  })

  it('la Tana non ha la scheda', () => {
    render(<InfoTab settings={{}} role="admin" />)
    expect(screen.queryByText('Aggiornamenti')).toBeNull()
  })
})
