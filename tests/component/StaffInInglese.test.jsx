// @vitest-environment happy-dom
'use strict'

// LO STAFF E IL RESTO, IN INGLESE (REQ-UI-039). Daniele, 17/11/2026: la
// lingua del gestionale la sceglie chiunque, sul suo profilo. Qui si aprono
// in inglese le schermate di chi gestisce il personale — ore e paghe, le
// timbrature, utenti e ruoli, i buoni VIP — e quelle che compaiono sopra a
// tutto: la chiamata in arrivo, la proposta di aggiornamento, le novità, gli
// avvisi della licenza; più il marketplace e l'assistente AI. Per ognuna si
// chiede cosa è rimasto in italiano.
//
// Le prove in italiano di questi componenti (StaffHoursTab, UtentiTab,
// MarketplaceTab…) restano quelle di sempre: l'italiano è la lingua di
// partenza, e i loro testi non sono cambiati.
//
// I DATI FINTI NON HANNO PAROLE ITALIANE («Negroni», «Mario», numeri): il
// controllo cerca proprio quelle. I testi che arrivano da src/lib (le
// etichette dei turni di lib/ore.js, la scadenza dei buoni di
// lib/vouchers.js, i temi di lib/marketplaceTemi.js) sono tradotti lì, e
// qui si controllano come gli altri. Resta in italiano, apposta, solo la
// vetrina dei temi: è un pezzo del menù dei clienti (lang="it").

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from '../helpers/router.jsx'
import '@testing-library/jest-dom/vitest'
import { italianoRimasto } from '../helpers/nienteItaliano.js'

const OGGI = new Date().toISOString().slice(0, 10)

const st = vi.hoisted(() => ({
  impostazioni: {},
  ore: [],
  timbrature: [],
  tariffe: [],
  buoni: [],
  chiamate: [],
}))

const UTENTI = [
  { uid: 'a1', name: 'Mario', email: 'mario@bar.example', role: 'admin' },
  { uid: 'a2', name: 'Anna', email: 'anna@bar.example', role: 'admin' },
  { uid: 'b1', name: 'Tom', email: 'tom@bar.example', role: 'bartender' },
  { uid: 's1', name: 'Sara', email: 'sara@bar.example', role: 'staff' },
  { uid: 'c1', name: 'Jane Smith', email: 'jane@mail.example', role: 'cliente' },
]

vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => vi.fn() }))
vi.mock('../../src/lib/firebaseClient.js', () => ({
  auth: { currentUser: { uid: 'a1', email: 'mario@bar.example', displayName: 'Mario' } },
  db: {},
  functions: {},
  storage: {},
}))
vi.mock('../../src/lib/api.js', () => ({
  // impostazioni
  settingsIniziali: () => st.impostazioni,
  subscribeSettings: (cb) => {
    cb(st.impostazioni)
    return () => {}
  },
  updateSettings: vi.fn(() => Promise.resolve()),
  // ore, timbrature e paghe
  addStaffHours: vi.fn(() => Promise.resolve('h1')),
  deleteStaffHours: vi.fn(),
  subscribeStaffHoursRange: (from, to, cb) => {
    cb(st.ore)
    return () => {}
  },
  subscribeStaffShiftsRange: (from, to, cb) => {
    cb(st.timbrature)
    return () => {}
  },
  updateStaffShift: vi.fn(() => Promise.resolve()),
  deleteStaffShift: vi.fn(),
  clockIn: vi.fn(() => Promise.resolve()),
  clockOut: vi.fn(() => Promise.resolve()),
  subscribeStaffRates: (cb) => {
    cb(st.tariffe)
    return () => {}
  },
  saveStaffRates: vi.fn(() => Promise.resolve()),
  // utenti, chiamate, buoni
  createStaffCall: vi.fn(() => Promise.resolve()),
  subscribePendingCalls: (cb) => {
    cb([])
    return () => {}
  },
  subscribeMyCalls: (uid, cb) => {
    cb(st.chiamate)
    return () => {}
  },
  subscribeCallsAlBancone: (cb) => {
    cb([])
    return () => {}
  },
  ackStaffCall: vi.fn(() => Promise.resolve()),
  subscribeVouchers: (cb) => {
    cb(st.buoni)
    return () => {}
  },
  createVoucher: vi.fn(() => Promise.resolve()),
  topUpVoucher: vi.fn(() => Promise.resolve()),
  deleteVoucher: vi.fn(() => Promise.resolve()),
  // marketplace e aggiornamenti
  azioneModulo: vi.fn(() => Promise.resolve({ ok: true })),
  inviaSceltaAggiornamento: vi.fn(() => Promise.resolve({ ok: true })),
  // assistente AI
  fetchInventoryItems: async () => [{ id: 'i1', name: 'Gin Tanqueray', stock: 1400, unit: 'ml', low_threshold: 700 }],
  fetchDrinks: async () => [{ id: 'd1', name: 'Negroni', category_id: 'c1', price: 8 }],
  fetchCategories: async () => [{ id: 'c1', name: 'Cocktail' }],
  fetchInventoryCategories: async () => [],
  fetchOrdersRange: async () => [],
  fetchSuppliers: async () => [],
  fetchSupplierPrices: async () => [],
  updateDrink: vi.fn(async () => {}),
  saveStaffToken: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/lib/staffApi.js', () => ({
  listStaff: vi.fn(() => Promise.resolve(UTENTI.filter((u) => u.role !== 'cliente'))),
  listUtenti: vi.fn(() => Promise.resolve(UTENTI)),
  createStaff: vi.fn(() => Promise.resolve()),
  setStaffRole: vi.fn(() => Promise.resolve()),
  setStaffDisabled: vi.fn(() => Promise.resolve()),
  removeStaff: vi.fn(() => Promise.resolve()),
}))
const notify = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock('../../src/lib/notify.js', () => ({
  notify: (...a) => notify(...a),
  ensureNotificationPermission: () => Promise.resolve(false),
}))
vi.mock('../../src/lib/notifyStore.js', () => ({ recordNotif: vi.fn() }))
vi.mock('../../src/lib/push.js', () => ({
  statoPush: () => Promise.resolve('da-permettere'),
  getPushToken: () => Promise.resolve('tok'),
}))
vi.mock('../../src/lib/dispositivo.js', () => ({ idDispositivo: () => 'dev1' }))
vi.mock('../../src/lib/novita.js', () => ({
  caricaChangelog: () => Promise.resolve('## 99.0.0\n- **Split bill** by guest'),
  sezioneChangelog: (md) => md,
}))
const chiamataAI = vi.hoisted(() => vi.fn())
vi.mock('../../src/porte/funzioni.js', () => ({ chiamaFunzione: (_nome, dati) => chiamataAI(dati) }))
vi.mock('../../src/lib/limiti.js', async (originale) => ({ ...(await originale()), senzaFunctions: () => false }))
vi.mock('../../src/lib/storage.js', () => ({ fotoDiFatturaLeggibile: (f) => Promise.resolve(f) }))
vi.mock('../../src/components/BackupPanel.jsx', () => ({ default: () => <div>DATA PANEL</div> }))

import StaffHoursTab from '../../src/components/StaffHoursTab.jsx'
import UtentiTab from '../../src/components/UtentiTab.jsx'
import ChiamataInArrivo from '../../src/components/ChiamataInArrivo.jsx'
import MarketplaceTab from '../../src/components/MarketplaceTab.jsx'
import PropostaAggiornamento from '../../src/components/PropostaAggiornamento.jsx'
import PannelloChat from '../../src/components/PannelloChat.jsx'
import NovitaDialog from '../../src/components/NovitaDialog.jsx'
import InstallazioneSospesa from '../../src/components/InstallazioneSospesa.jsx'
import AvvisoCancellazione from '../../src/components/AvvisoCancellazione.jsx'
import AvvisiSpenti from '../../src/components/AvvisiSpenti.jsx'
import { subscribeSottosezioni } from '../../src/lib/sottosezioni.js'
import { _azzeraStatoAI } from '../../src/lib/statoAI.js'
import { impostaLingua } from '../../src/lib/lingua.js'

// Le sottosezioni stanno nella barra in alto (App.jsx): qui le si legge e le
// si sceglie dal loro registro, come fa la barra.
let sottosezioni = null
let smetti = null
const vaiA = (id) => act(() => sottosezioni.scegli(id))
const etichetteSottosezioni = () => sottosezioni.voci.map((v) => v.label)

beforeEach(() => {
  localStorage.clear()
  impostaLingua('en')
  st.impostazioni = {}
  st.ore = [
    { id: 'h1', staff_uid: 's1', staff_name: 'Sara', date: OGGI, hours: 5, kind: 'effettivo', start: '18:00', end: '23:00' },
    { id: 'h2', staff_uid: 'b1', staff_name: 'Tom', date: OGGI, hours: 6, kind: 'programmato', start: '18:00', end: '24:00' },
  ]
  st.timbrature = []
  st.tariffe = [{ id: 's1', name: 'Sara', rates: [{ from: '2026-01-01', rate: 10 }] }]
  st.buoni = []
  st.chiamate = []
  notify.mockClear()
  chiamataAI.mockReset()
  _azzeraStatoAI()
  smetti = subscribeSottosezioni((s) => {
    sottosezioni = s
  })
})
afterEach(() => {
  smetti?.()
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  impostaLingua('it')
})

describe('ore e paghe in inglese', () => {
  it('il calendario del mese, coi totali e il costo del personale', async () => {
    const { container } = render(<StaffHoursTab />)
    expect(await screen.findByText('Period total')).toBeInTheDocument()
    // 5 h × 10 €/h: gli importi restano col formato di sempre.
    await waitFor(() => expect(screen.getAllByText('50,00 €').length).toBeGreaterThan(0))
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(etichetteSottosezioni()).toEqual(['Calendar', 'Clock records', 'New shift', 'Hourly pay'])
    expect(italianoRimasto(container)).toEqual([])
  })

  it('la vista del giorno e quella della settimana', async () => {
    const user = userEvent.setup()
    const { container } = render(<StaffHoursTab />)
    await user.click(await screen.findByRole('button', { name: 'Day' }))
    expect(await screen.findByText('2 entries')).toBeInTheDocument()
    expect(screen.getAllByText('Assign to this day').length).toBeGreaterThan(0)
    expect(italianoRimasto(container)).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Week' }))
    expect(italianoRimasto(container)).toEqual([])
  })

  it('il nuovo turno, le paghe orarie e le timbrature', async () => {
    st.timbrature = [{ id: 't1', staff_uid: 's1', staff_name: 'Sara', date: OGGI, open: true, clock_in: `${OGGI}T17:00:00.000Z` }]
    for (const sezione of ['turno', 'paghe', 'timbrature']) {
      const { container, unmount } = render(<StaffHoursTab sezioneIniziale={sezione} />)
      await screen.findAllByText('Sara')
      expect(italianoRimasto(container)).toEqual([])
      unmount()
    }
  })
})

describe('utenti e ruoli in inglese', () => {
  const mostra = () => render(<UtentiTab role="admin" />)

  it('l’elenco, il cambio di ruolo e la chiamata', async () => {
    const user = userEvent.setup()
    const { container } = mostra()
    expect(await screen.findByText('Staff (4)')).toBeInTheDocument()
    expect(screen.getByText('Registered customers (1)')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])

    const riga = screen.getByText('Sara').closest('.toggle-row')
    await user.click(riga.querySelector('[title="Change role"]'))
    expect(await screen.findByText('Role of Sara')).toBeInTheDocument()
    // La descrizione del ruolo viene da lib/ruoli.js, già segnata.
    expect(screen.getByText('Only orders ready to serve and their own orders.')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(riga.querySelector('[title="Call (pager)"]'))
    expect(await screen.findByText(/Call Sara/)).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('chi apre la cassa, il nuovo account e i buoni VIP', async () => {
    st.buoni = [
      {
        id: 'v1',
        holder_name: 'Jane',
        balance: 20,
        initial: 30,
        movements: [{ type: 'uso', amount: -10 }],
        expiry_type: 'none',
      },
    ]
    const { container } = mostra()
    await screen.findByText('Staff (4)')
    expect(etichetteSottosezioni()).toEqual(['Registered users', 'Who opens the till', 'New account', 'VIP vouchers'])
    vaiA('cassa')
    expect(await screen.findByText('Logged in as Mario', { exact: false })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    vaiA('nuovo')
    expect(await screen.findByRole('button', { name: /Create account/ })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    vaiA('vip')
    expect(await screen.findByText('Total loaded: 30,00 € · used: 10,00 €')).toBeInTheDocument()
    expect(screen.getByText(/no expiry/)).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })
})

describe('la chiamata in arrivo in inglese', () => {
  it('il riquadro e la notifica di sistema', async () => {
    st.chiamate = [{ id: 'c1', from_name: 'Mario', message: 'Negroni' }]
    const { container } = render(<ChiamataInArrivo ruolo="bartender" />)
    expect(await screen.findByText('Call from the bar')).toBeInTheDocument()
    expect(screen.getByText('from Mario')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '✓ Answer' })).toBeInTheDocument()
    expect(String(notify.mock.calls[0][0])).toContain('Call from the bar')
    expect(italianoRimasto(container)).toEqual([])
  })
})

describe('il marketplace in inglese', () => {
  // Il listino della regia: prezzi e giorni di prova dei moduli.
  const LISTINO = { moduli: [{ id: 'clienti', prezzo: 6, prova_giorni: 7 }, { id: 'sumup', prezzo: 10, prova_giorni: 0 }] }

  it('gli stili, gli installati e i moduli', async () => {
    vi.stubEnv('VITE_REGIA_PROGETTO', 'drink-regia-test')
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(LISTINO) })))
    st.impostazioni = {
      licenza: { stato: 'attiva', piano: 'free', regia_url: 'https://regia.example/area', moduli: { magazzino: true } },
    }
    const { container } = render(
      <MemoryRouter initialEntries={['/bar?tab=marketplace&sezione=stili']}>
        <MarketplaceTab role="admin" />
      </MemoryRouter>
    )
    expect(await screen.findByRole('heading', { name: 'Menu styles' })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    // I temi: nomi e descrizioni del catalogo in inglese; la vetrina, che è
    // il menù dei clienti, resta italiana (lang="it") e il controllo la salta.
    vaiA('temi')
    expect(await screen.findByRole('heading', { name: 'Themes' })).toBeInTheDocument()
    expect(screen.getByText('The bistro chalkboard: chalk on green slate, handwritten lettering.')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    vaiA('installati')
    expect(await screen.findByRole('heading', { name: 'Installed' })).toBeInTheDocument()
    expect(screen.getByText('No themes or styles installed. They are chosen in “Themes” and “Menu styles”.')).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
    vaiA('moduli')
    expect(await screen.findByRole('button', { name: 'Try Customer management free for 7 days' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/Updating the price list/)).toBeNull())
    expect(screen.getAllByText('Included').length).toBeGreaterThan(0)
    expect(italianoRimasto(container)).toEqual([])
  })
})

describe('gli avvisi sopra a tutto, in inglese', () => {
  it('la proposta di aggiornamento', () => {
    const settings = {
      licenza: {
        piano: 'pro',
        regia_url: 'https://regia.example/area',
        aggiornamenti: {
          modalita: 'a_scelta',
          inclusi: true,
          scelta_url: 'https://europe-west1-drink-regia.cloudfunctions.net/sceltaDallApp',
          proposta: { tag: 'v99.0.0', note: '## 99.0.0\n- **Split bill** by guest' },
        },
      },
    }
    const { container } = render(<PropostaAggiornamento settings={settings} ruolo="admin" />)
    expect(screen.getByRole('dialog', { name: 'Update available' })).toBeInTheDocument()
    expect(screen.getByText('Version 99.0.0 available')).toBeInTheDocument()
    for (const nome of ['Update', 'Skip this version', 'Later']) expect(screen.getByRole('button', { name: nome })).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })

  it('le novità, gli avvisi spenti, la licenza ferma e la cancellazione', async () => {
    const novita = render(<NovitaDialog onClose={vi.fn()} />)
    expect(await screen.findByText('Split bill')).toBeInTheDocument()
    expect(italianoRimasto(novita.container)).toEqual([])
    novita.unmount()

    const spenti = render(<AvvisiSpenti ruolo="bartender" />)
    expect(await screen.findByText(/Alerts are off/)).toBeInTheDocument()
    expect(italianoRimasto(spenti.container)).toEqual([])
    spenti.unmount()

    const licenza = { stato: 'sospesa', dal: '2026-10-22T10:00:00Z', motivo: 'payment not received', regia_url: 'https://regia.example' }
    const sospesa = render(<InstallazioneSospesa ruolo="admin" licenza={licenza} venue={{ venue_name: 'Bar Mario' }} />)
    expect(screen.getByText('App suspended')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('The app for Bar Mario has been suspended since 22/10/2026. Reason: payment not received.')
    expect(italianoRimasto(sospesa.container)).toEqual([])
    sospesa.unmount()

    // La scadenza è un giorno preciso: «expired on», non «since».
    const scaduta = render(
      <InstallazioneSospesa ruolo="admin" licenza={{ stato: 'scaduta', scaduta_il: '2026-11-30T04:00:00Z' }} venue={{ venue_name: 'Bar Mario' }} />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('The app for Bar Mario has been stopped: the licence expired on 30/11/2026.')
    expect(italianoRimasto(scaduta.container)).toEqual([])
    scaduta.unmount()

    const ferma = render(<InstallazioneSospesa ruolo="staff" licenza={licenza} venue={{ venue_name: 'Bar Mario' }} />)
    expect(screen.getByText('Venue suspended')).toBeInTheDocument()
    expect(italianoRimasto(ferma.container)).toEqual([])
    ferma.unmount()

    const cancellazione = {
      licenza: {
        stato: 'sospesa',
        moduli: {},
        regia_url: 'https://regia.example/area',
        cancellazione: { il: '2027-01-31T12:00:00Z', richiedente: 'conservazione' },
      },
    }
    const avviso = render(<AvvisoCancellazione settings={cancellazione} ruolo="admin" />)
    expect(screen.getByRole('link', { name: 'Go to the customer area' })).toBeInTheDocument()
    expect(italianoRimasto(avviso.container)).toEqual([])
  })
})

describe('l’assistente AI in inglese', () => {
  it('il pannello e una domanda con la sua risposta', async () => {
    const user = userEvent.setup()
    chiamataAI.mockImplementation(async (dati) => {
      if (dati.tipo === 'credito') {
        return { ok: true, tipo: 'credito', credito_eur: 5, tetto_mensile_eur: 20, speso_mese_eur: 0, attivo: true, motivo: null }
      }
      return {
        ok: true,
        tipo: 'chat',
        turno: { role: 'assistant', content: [{ type: 'text', text: 'Negroni: 12.' }] },
        testo: 'Negroni: 12.',
        strumenti_richiesti: [],
        costo_eur: 0.001,
        credito_eur: 4.99,
      }
    })
    const { container } = render(
      <MemoryRouter>
        <PannelloChat ruolo="admin" onChiudi={vi.fn()} />
      </MemoryRouter>
    )
    const campo = screen.getByLabelText('Message for the assistant')
    await waitFor(() => expect(campo).not.toBeDisabled())
    expect(italianoRimasto(container)).toEqual([])
    // Le parole di chi scrive e quelle dell'AI sono dati: restano come sono.
    await user.type(campo, 'Negroni sold?')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Negroni: 12.')).toBeInTheDocument()
    expect(screen.getByText(/Conversation cost/)).toBeInTheDocument()
    expect(italianoRimasto(container)).toEqual([])
  })
})
