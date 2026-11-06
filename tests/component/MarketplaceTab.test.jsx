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
import { useLocation } from 'react-router-dom'
import { MemoryRouter } from '../helpers/router.jsx'
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
})

// Dove si trova la pagina, letto dal router: è lì che il Marketplace legge
// la sezione e l'esito del ritorno dal pagamento.
let posizione
function Posizione() {
  posizione = useLocation()
  return null
}

function mostra(role = 'admin', indirizzo = '/bar?tab=marketplace') {
  const smetti = subscribeSottosezioni((s) => {
    sottosezioni = s
  })
  const r = render(
    <MemoryRouter initialEntries={[indirizzo]}>
      <MarketplaceTab role={role} />
      <Posizione />
    </MemoryRouter>
  )
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
    expect(await within(scheda('Gestione clienti')).findByText('6,00 € al mese + IVA')).toBeInTheDocument()
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
    vi.stubGlobal('location', { origin: 'https://tana.example', assign: vai })
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
    expect(screen.getByText(/Prova di «Gestione clienti» attivata/)).toBeInTheDocument()
  })

  it('la disdetta si conferma, e dice fino a quando il modulo resta', async () => {
    conRegia()
    st.risposta = { ok: true, checkout_url: null, dal: '2026-12-01' }
    const utente = userEvent.setup()
    mostra()
    vaiA('moduli')
    await utente.click(await screen.findByRole('button', { name: 'Disdici Magazzino e fornitori' }))
    expect(st.azioni).toEqual([])
    expect(screen.getByRole('heading', { name: 'Disdire «Magazzino e fornitori»?' })).toBeInTheDocument()
    await utente.click(screen.getByRole('button', { name: 'Disdici' }))
    expect(st.azioni.at(-1)).toMatchObject({ modulo: 'magazzino', azione: 'disdici' })
    expect(screen.getByText(/resta attivo fino al 1 dicembre 2026/)).toBeInTheDocument()
  })

  it('con un piano gestito a mano, aggiunta e disdetta sono richieste all\'assistenza', async () => {
    // L'utente, 02/11/2026: per i piani pagati fuori da Stripe il modulo lo
    // attiva o lo spegne lui, a pagamento ricevuto. «Aggiunto» sarebbe falso.
    conRegia()
    st.risposta = { ok: true, checkout_url: null, dal: null, in_attesa: true }
    const utente = userEvent.setup()
    mostra()
    vaiA('moduli')
    await utente.click(await screen.findByRole('button', { name: 'Aggiungi Gestione clienti' }))
    expect(st.azioni.at(-1)).toMatchObject({ modulo: 'clienti', azione: 'aggiungi' })
    expect(screen.getByText('Richiesta di «Gestione clienti» inviata all\'assistenza: il modulo si attiva alla conferma del pagamento.')).toBeInTheDocument()
    expect(screen.queryByText(/aggiunto/)).toBeNull()

    await utente.click(screen.getByRole('button', { name: 'Disdici Magazzino e fornitori' }))
    await utente.click(screen.getByRole('button', { name: 'Disdici' }))
    expect(screen.getByText('Richiesta di disdetta di «Magazzino e fornitori» inviata all\'assistenza.')).toBeInTheDocument()
  })

  it('un rifiuto della regia si legge col suo testo', async () => {
    conRegia()
    st.risposta = { ok: false, status: 409, errore: 'La prova di questo modulo è già stata usata.' }
    const utente = userEvent.setup()
    mostra()
    vaiA('moduli')
    await utente.click(await screen.findByRole('button', { name: 'Prova Gestione clienti gratis per 7 giorni' }))
    expect(screen.getByText('La prova di questo modulo è già stata usata.')).toBeInTheDocument()
  })

  it('chi non è il titolare li vede, ma non li compra', async () => {
    conRegia()
    mostra('bartender')
    vaiA('moduli')
    expect(await within(scheda('Gestione clienti')).findByText('6,00 € al mese + IVA')).toBeInTheDocument()
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
    mostra('admin', '/bar?tab=marketplace&sezione=moduli&esito=pagato')
    await listinoLetto()
    expect(screen.getByRole('heading', { name: 'Moduli', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(/Pagamento ricevuto/)).toBeInTheDocument()
    expect(posizione.search).toBe('?tab=marketplace&sezione=moduli')
  })
})

// «I TUOI TEMI» (REQ-MENU-030): i temi fatti dalla regia per questo locale,
// che arrivano con la licenza (`temi_su_misura`). La sezione c'è solo se ce
// n'è almeno uno: alla Tana, che non ne ha, non compare.
describe('i temi su misura', () => {
  const BOSCO = {
    id: 'su-misura-bosco',
    nome: 'Bosco',
    descrizione: 'Verde profondo e oro.',
    tavolozza: { base: 'tana-scuro', colori: { '--bg': '#10201a' } },
    stile: 'deco',
    ricetta: {
      versione: 1,
      caratteri: { titolo: 'abril-fatface', voce: 'oswald', testo: 'inter' },
      intestazione: 'doppio-filetto',
      impaginazione: 'per-categoria',
    },
  }

  it('senza temi su misura la sezione non c’è', () => {
    st.impostazioni = { licenza: { temi: ['notte'] } }
    mostra()
    expect(sottosezioni.voci.map((v) => v.id)).not.toContain('tuoi')
  })

  it('con la licenza che li porta: si provano, si installano e si usano, con la ricetta nella copia', async () => {
    const utente = userEvent.setup()
    st.impostazioni = { licenza: { temi_su_misura: [BOSCO] } }
    mostra()
    expect(sottosezioni.voci.map((v) => v.label)).toEqual(['I tuoi temi', 'Temi', 'Stili del menù', 'Installati', 'Moduli'])
    vaiA('tuoi')
    expect(screen.getByRole('heading', { name: 'I tuoi temi', level: 2 })).toBeInTheDocument()
    // Con la ricetta si disegna col motore: niente «Stile …» da dire.
    expect(screen.getByText('Su misura')).toBeInTheDocument()
    expect(document.querySelector('.vetrina-tema.stile-ricetta[data-intestazione="doppio-filetto"]')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Prova sul menù' })).toHaveAttribute('href', '/menu?vista=cliente&tema=su-misura-bosco')
    await utente.click(screen.getByRole('button', { name: 'Installa Bosco' }))
    expect(st.scritte.at(-1).temi_installati).toEqual([
      expect.objectContaining({ id: 'su-misura-bosco', su_misura: true, ricetta: expect.objectContaining(BOSCO.ricetta) }),
    ])
    await utente.click(screen.getByRole('button', { name: 'Usa Bosco' }))
    expect(st.scritte.at(-1)).toMatchObject({ stile_menu: 'su-misura-bosco', tema_menu: 'su-misura-bosco', theme_client: { preset: 'tana-scuro' } })
    // Non sono nel catalogo di tutti.
    vaiA('temi')
    expect(screen.queryByRole('heading', { name: 'Bosco' })).toBeNull()
  })

  it('tolto dalla licenza resta installato e in uso, e la scheda dice che non si reinstalla', () => {
    st.impostazioni = {
      licenza: { temi_su_misura: [] },
      temi_installati: [{ ...BOSCO, su_misura: true }],
      tema_menu: 'su-misura-bosco',
    }
    mostra()
    vaiA('tuoi')
    expect(screen.getByRole('heading', { name: 'Bosco' })).toBeInTheDocument()
    expect(screen.getByText(/Non più in licenza: una volta disinstallato non si reinstalla/)).toBeInTheDocument()
    expect(screen.getByText('In uso')).toBeInTheDocument()
  })
})

// GLI STILI A RICETTA DEL CATALOGO (REQ-MENU-031): arrivano dalla regia col
// catalogo dei temi, si ricordano sul dispositivo, e in «Stili del menù»
// si provano, si installano (con la loro copia) e si usano come quelli
// dell'app. La vetrina li disegna col motore.
describe('gli stili a ricetta', () => {
  const OSTERIA = {
    id: 'osteria',
    nome: 'Osteria',
    descrizione: 'La carta dell’osteria.',
    ricetta: { versione: 1, caratteri: { titolo: 'libre-baskerville', voce: 'libre-baskerville', testo: 'georgia' }, voce: { forma: 'riga' } },
  }

  it('dal catalogo ricordato: si provano, si installano con la copia, si usano e si disinstallano', async () => {
    const utente = userEvent.setup()
    localStorage.setItem('drink:catalogo-stili', JSON.stringify([OSTERIA]))
    const { unmount } = mostra()
    vaiA('stili')
    expect(screen.getByRole('heading', { name: 'Osteria' })).toBeInTheDocument()
    expect(document.querySelector('.vetrina-tema.stile-ricetta[data-voce-forma="riga"]')).not.toBeNull()
    expect(screen.getAllByRole('link', { name: 'Prova sul menù' }).map((a) => a.getAttribute('href'))).toContain(
      '/menu?vista=cliente&stile=osteria'
    )
    await utente.click(screen.getByRole('button', { name: 'Installa lo stile Osteria' }))
    const installato = st.scritte.at(-1)
    expect(installato.stili_ricetta).toEqual([expect.objectContaining({ id: 'osteria', ricetta: expect.objectContaining({ versione: 1 }) })])
    await utente.click(screen.getByRole('button', { name: 'Usa lo stile Osteria' }))
    expect(st.scritte.at(-1)).toEqual({ stile_menu: 'osteria' })
    unmount()

    // Ritirato dalla regia, resta a chi l'ha: la copia basta.
    localStorage.clear()
    st.impostazioni = { stili_ricetta: installato.stili_ricetta, stile_menu: 'osteria' }
    mostra()
    vaiA('installati')
    expect(screen.getByRole('heading', { name: 'Osteria' })).toBeInTheDocument()
    await utente.click(screen.getByRole('button', { name: 'Disinstalla lo stile Osteria' }))
    expect(st.scritte.at(-1)).toEqual({ stili_ricetta: [], stile_menu: 'classico' })
  })
})
