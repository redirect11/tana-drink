// @vitest-environment happy-dom
'use strict'

// ── LA PAGINA DEL MARKETPLACE (REQ-MENU-023) ──────────────────────────
//
// L'utente, 02/11/2026: «una sezione marketplace separata, una
// finestra/pagina nuova che apro per navigare i temi come se fosse un
// catalogo e poi li installo sulla mia istanza». Una pagina del menu
// laterale con tre sezioni — Temi, Stili del menù, Installati — e su ogni
// scheda la vetrina, «Prova sul menù», «Installa» e «Usa». E dal 02/11/2026
// una quarta, i Moduli (REQ-LIC-012): «anche per i moduli aggiuntivi
// andrebbe fatto il marketplace».

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const st = vi.hoisted(() => ({ impostazioni: {}, scritte: [], azioni: [], risposta: null }))

vi.mock('../../src/lib/api.js', () => ({
  subscribeSettings: (cb) => {
    cb(st.impostazioni)
    return () => {}
  },
  settingsIniziali: () => st.impostazioni,
  updateSettings: vi.fn((patch) => {
    st.scritte.push(patch)
    return Promise.resolve()
  }),
  azioneModulo: vi.fn((url, modulo, azione, ritorno) => {
    st.azioni.push({ url, modulo, azione, ritorno })
    return Promise.resolve(st.risposta)
  }),
}))

import MarketplaceTab from '../../src/components/MarketplaceTab.jsx'
import { subscribeSottosezioni } from '../../src/lib/sottosezioni.js'

// Le sottosezioni stanno nel menu a scomparsa: qui si scelgono da lì.
let sottosezioni
beforeEach(() => {
  st.impostazioni = {}
  st.scritte = []
  st.azioni = []
  st.risposta = { ok: true, checkout_url: null, dal: null }
  localStorage.clear()
  sottosezioni = null
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  history.replaceState(null, '', '/')
})

function mostra(role = 'admin') {
  const smetti = subscribeSottosezioni((s) => {
    sottosezioni = s
  })
  const r = render(<MarketplaceTab role={role} />)
  return { ...r, smetti }
}
const vaiA = (id) => act(() => sottosezioni.scegli(id))

describe('il marketplace', () => {
  it('è un catalogo: le sezioni Temi, Stili del menù, Installati, Moduli', () => {
    mostra()
    expect(sottosezioni.voci.map((v) => v.label)).toEqual(['Temi', 'Stili del menù', 'Installati', 'Moduli'])
    expect(screen.getByRole('heading', { name: 'Temi', level: 2 })).toBeInTheDocument()
  })

  it('ogni tema ha la vetrina, la prova sul menù e «Installa»; «Notte» solo con la licenza', () => {
    const { container } = mostra()
    for (const nome of ['Classico', 'Lavagna', 'Grand Hotel', 'Riviera', 'Pastello', 'Gazzetta', 'Inchiostro']) {
      expect(screen.getByRole('button', { name: `Installa ${nome}` })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Installa Notte' })).toBeNull()
    expect(container.querySelector('.vetrina-tema.stile-deco')).not.toBeNull()
    const prove = screen.getAllByRole('link', { name: 'Prova sul menù' }).map((a) => a.getAttribute('href'))
    expect(prove).toContain('/menu?vista=cliente&tema=grand-hotel')
  })

  it('«Installa» e poi «Usa»: il tema va sul menù dei clienti', async () => {
    const utente = userEvent.setup()
    mostra()
    await utente.click(screen.getByRole('button', { name: 'Installa Gazzetta' }))
    expect(st.scritte.at(-1).temi_installati.map((t) => t.id)).toEqual(['gazzetta'])
    await utente.click(screen.getByRole('button', { name: 'Usa Gazzetta' }))
    expect(st.scritte.at(-1)).toMatchObject({ theme_client: { preset: 'chiaro' }, stile_menu: 'giornale', tema_menu: 'gazzetta' })
    expect(screen.getByText('In uso')).toBeInTheDocument()
  })

  it('gli stili da soli si installano e si usano sui colori del locale', async () => {
    const utente = userEvent.setup()
    mostra()
    vaiA('stili')
    await utente.click(screen.getByRole('button', { name: 'Installa lo stile Lavagna' }))
    expect(st.scritte.at(-1)).toEqual({ stili_installati: ['lavagna'] })
    await utente.click(screen.getByRole('button', { name: 'Usa lo stile Lavagna' }))
    expect(st.scritte.at(-1)).toEqual({ stile_menu: 'lavagna' })
  })

  it('Installati: quello che il locale ha, e lì si disinstalla', async () => {
    const utente = userEvent.setup()
    st.impostazioni = {
      temi_installati: [{ id: 'riviera', nome: 'Riviera', tavolozza: { base: 'crema' }, stile: 'riviera' }],
      stili_installati: ['deco'],
    }
    mostra()
    vaiA('installati')
    expect(screen.getByRole('heading', { name: 'Riviera' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Déco' })).toBeInTheDocument()
    await utente.click(screen.getByRole('button', { name: 'Disinstalla Riviera' }))
    expect(st.scritte.at(-1)).toEqual({ temi_installati: [] })
  })

  it('niente installato: lo dice', () => {
    mostra()
    vaiA('installati')
    expect(screen.getByText(/Nessun tema né stile installato/)).toBeInTheDocument()
  })
})

// REQ-MENU-024: la vetrina di uno stile con una struttura sua mostra
// quella — il «Giornale» è una testata con le sezioni, non le card.
describe('la vetrina del «Giornale»', () => {
  it('è un giornale in miniatura', () => {
    const { container } = mostra()
    const vetrina = container.querySelector('.vetrina-tema.stile-giornale')
    expect(vetrina.querySelector('.g-testata')).not.toBeNull()
    expect(vetrina.querySelector('.menu-item')).toBeNull()
  })
})

// ── I MODULI (REQ-LIC-012) ────────────────────────────────────────────
// Al mese come nel listino della regia, con una prova gratuita, e li
// compra solo il titolare (decisioni dell'utente, 02/11/2026). Lo stato
// viene dalla licenza, prezzi e prove dal listino; il pagamento sulla
// pagina di Stripe, e la regia riporta il titolare qui.
describe('i moduli', () => {
  const LISTINO = {
    moduli: [
      { id: 'magazzino', prezzo: 15, prova_giorni: 14 },
      { id: 'statistiche', prezzo: 15, prova_giorni: 14 },
      { id: 'clienti', prezzo: 6, prova_giorni: 7 },
      { id: 'sumup', prezzo: 10, prova_giorni: 0 },
    ],
  }
  const DELLA_REGIA = {
    licenza: {
      stato: 'attiva',
      piano: 'free',
      regia_url: 'https://regia.example/area',
      moduli: { magazzino: true, statistiche: true },
      prove: { statistiche: '2026-11-16T10:00:00.000Z' },
    },
  }

  function conRegia(impostazioni = DELLA_REGIA) {
    vi.stubEnv('VITE_REGIA_PROGETTO', 'drink-regia-test')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(LISTINO) }))
    )
    st.impostazioni = impostazioni
  }
  const scheda = (nome) => screen.getByRole('heading', { name: nome }).closest('article')
  const listinoLetto = () => waitFor(() => expect(screen.queryByText(/Aggiornamento del listino/)).toBeNull())

  it('ogni modulo col suo stato e, dal listino, prezzo e prova', async () => {
    conRegia()
    mostra()
    vaiA('moduli')
    expect(await within(scheda('Gestione clienti')).findByText('6 € al mese + IVA')).toBeInTheDocument()
    expect(within(scheda('Magazzino e fornitori')).getByText('Incluso')).toBeInTheDocument()
    expect(within(scheda('Statistiche e bilancio')).getByText('In prova fino al 16 novembre 2026')).toBeInTheDocument()
    expect(within(scheda('Gestione clienti')).getByText('Non incluso')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prova Gestione clienti gratis per 7 giorni' })).toBeInTheDocument()
    // Senza giorni di prova nel listino, solo l'acquisto.
    expect(within(scheda('Pagamenti con lettore SumUp')).queryByText(/Prova gratis/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Aggiungi Pagamenti con lettore SumUp' })).toBeInTheDocument()
    // In prova si può comprare; incluso si può disdire.
    expect(screen.getByRole('button', { name: 'Aggiungi Statistiche e bilancio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disdici Magazzino e fornitori' })).toBeInTheDocument()
    // Le fatture la regia non le vende da sole.
    expect(within(scheda('Fatture ai clienti')).getByText('Non acquistabile singolarmente')).toBeInTheDocument()
  })

  it('«Aggiungi» porta alla pagina di pagamento, col ritorno sui moduli', async () => {
    conRegia()
    st.risposta = { ok: true, checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_1', dal: null }
    const vai = vi.fn()
    vi.stubGlobal('location', {
      origin: 'https://tana.example',
      search: '',
      href: 'https://tana.example/bar',
      assign: vai,
    })
    const utente = userEvent.setup()
    mostra()
    vaiA('moduli')
    await utente.click(await screen.findByRole('button', { name: 'Aggiungi Gestione clienti' }))
    expect(st.azioni).toEqual([
      {
        url: 'https://europe-west1-drink-regia-test.cloudfunctions.net/moduloDallApp',
        modulo: 'clienti',
        azione: 'aggiungi',
        ritorno: 'https://tana.example/bar?tab=marketplace&sezione=moduli',
      },
    ])
    expect(vai).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1')
  })

  it('la prova gratuita parte senza pagamento, e lo dice', async () => {
    conRegia()
    const utente = userEvent.setup()
    mostra()
    vaiA('moduli')
    await utente.click(await screen.findByRole('button', { name: 'Prova Gestione clienti gratis per 7 giorni' }))
    expect(st.azioni.at(-1)).toMatchObject({ modulo: 'clienti', azione: 'prova' })
    expect(screen.getByRole('status')).toHaveTextContent('Prova di «Gestione clienti» attivata')
  })

  it('la disdetta si conferma, e dice fino a quando il modulo resta', async () => {
    conRegia()
    st.risposta = { ok: true, checkout_url: null, dal: '2026-12-01' }
    const utente = userEvent.setup()
    mostra()
    vaiA('moduli')
    await utente.click(await screen.findByRole('button', { name: 'Disdici Magazzino e fornitori' }))
    expect(st.azioni).toEqual([])
    await utente.click(screen.getByRole('button', { name: 'Conferma la disdetta di Magazzino e fornitori' }))
    expect(st.azioni.at(-1)).toMatchObject({ modulo: 'magazzino', azione: 'disdici' })
    expect(screen.getByRole('status')).toHaveTextContent('resta attivo fino al 1 dicembre 2026')
  })

  it('un rifiuto della regia si legge col suo testo', async () => {
    conRegia()
    st.risposta = { ok: false, status: 409, errore: 'La prova di questo modulo è già stata usata.' }
    const utente = userEvent.setup()
    mostra()
    vaiA('moduli')
    await utente.click(await screen.findByRole('button', { name: 'Prova Gestione clienti gratis per 7 giorni' }))
    expect(screen.getByRole('status')).toHaveTextContent('La prova di questo modulo è già stata usata.')
  })

  it('chi non è il titolare li vede, ma non li compra', async () => {
    conRegia()
    mostra('bartender')
    vaiA('moduli')
    expect(await within(scheda('Gestione clienti')).findByText('6 € al mese + IVA')).toBeInTheDocument()
    expect(screen.getByText('Moduli e abbonamenti li gestisce il titolare.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^(Aggiungi|Disdici|Prova) / })).toBeNull()
  })

  it('una licenza scritta a mano, come quella della Tana: si consulta soltanto', async () => {
    conRegia({ licenza: { stato: 'attiva', regia_url: null, moduli: { magazzino: true, clienti: true } } })
    mostra()
    vaiA('moduli')
    await listinoLetto()
    expect(screen.getByText(/si gestisce presso chi la amministra/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^(Aggiungi|Disdici|Prova) / })).toBeNull()
  })

  it("tornando dal pagamento si apre sui moduli, con l'esito, detto una volta sola", async () => {
    conRegia()
    history.replaceState(null, '', '/bar?tab=marketplace&sezione=moduli&esito=pagato')
    mostra()
    await listinoLetto()
    expect(screen.getByRole('heading', { name: 'Moduli', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Pagamento ricevuto')
    expect(location.search).toBe('?tab=marketplace&sezione=moduli')
  })
})
