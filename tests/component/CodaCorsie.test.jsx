// @vitest-environment happy-dom
'use strict'

// LA CODA A CORSIE (Impostazioni → Coda ordini → «Corsie di stato»).
//
// La stessa vista mostra due cose diverse a seconda di CHI guarda, perché
// sono due mestieri:
//
//   AL BANCO (bartender) le colonne sono i passi del servizio — da fare,
//   al banco, al ritiro, da incassare — e dentro ci stanno le COMANDE, una
//   card per ticket: chi sta allo shaker prepara un ticket per volta, e un
//   conto con tre comande in tre passi diversi disegnato come una card sola
//   direbbe una cosa sbagliata comunque la si metta. Il tasto fa avanzare
//   QUELLA comanda, non tutto il conto.
//
//   A CHI GUARDA LA SERATA (admin, sala) le colonne sono le tre cose che un
//   CONTO può essere: in corso, chiusi, annullati.
//
// Le altre cose che si provano qui sono quelle che al banco costano un
// drink sbagliato:
//   · le colonne ci sono tutte, sempre, anche vuote: la posizione di una
//     colonna si impara a memoria e non deve ballare;
//   · il tasto fa la STESSA cosa delle altre viste — chiama le funzioni
//     dell'app, non una scorciatoia sua;
//   · la ricerca filtra dentro le corsie, tutte insieme;
//   · chi è al banco può spegnere le colonne che in quel momento non gli
//     servono, e al ricarico le ritrova come le aveva lasciate.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

// Dove si va toccando una card: la spia dice se si apre il conto giusto.
const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const vera = await orig()
  return { ...vera, useNavigate: () => navigateSpy }
})

// Le impostazioni del locale: ogni test le prepara prima di montare.
let impostazioni = {}
// Gli ordini che il server manda alla coda.
let ordini = []
// I conti battuti al POS e non ancora arrivati dal server.
let inVolo = []

vi.mock('../../src/lib/firebaseClient.js', () => ({
  isFirebaseConfigured: true,
  auth: { currentUser: { uid: 'u1', email: 'capo@bar.it', displayName: 'Capo' } },
  db: {},
}))
// CHI GUARDA DECIDE COSA VEDE: all'admin le corsie dei CONTI, a chi sta al
// banco quelle delle COMANDE. Ogni test dice chi è collegato.
let ruolo = 'admin'
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    cb({
      uid: 'u1',
      email: 'capo@bar.it',
      displayName: 'Capo',
      getIdTokenResult: async () => ({ claims: { role: ruolo } }),
    })
    return () => {}
  },
}))

vi.mock('../../src/lib/api.js', () => ({
  DEFAULT_SETTINGS: {},
  settingsIniziali: () => ({ ...impostazioni }),
  subscribeSettings: (cb) => {
    cb({ ...impostazioni })
    return () => {}
  },
  subscribeActiveOrders: (cb) => {
    cb(ordini)
    return () => {}
  },
  subscribeOpenCashSession: (cb) => {
    cb({ id: 'cassa-1', status: 'open', opened_at: '2026-08-16T18:00:00.000Z' })
    return () => {}
  },
  updateOrderStatus: vi.fn(() => Promise.resolve()),
  advanceComanda: vi.fn(() => Promise.resolve()),
  markOrderPaid: vi.fn(() => Promise.resolve()),
  cancelOrder: vi.fn(() => Promise.resolve()),
  restoreOrder: vi.fn(() => Promise.resolve()),
  createOrder: vi.fn(() => Promise.resolve({})),
  saveStaffToken: vi.fn(() => Promise.resolve()),
  rimuoviStaffToken: vi.fn(() => Promise.resolve()),
  clockOut: vi.fn(() => Promise.resolve()),
}))

// Hardware e contorno: al banco ci sono, in un test no.
vi.mock('../../src/lib/push.js', () => ({ getPushToken: vi.fn(async () => null) }))
vi.mock('../../src/lib/notify.js', () => ({
  ensureNotificationPermission: vi.fn(async () => false),
  notify: vi.fn(),
}))
vi.mock('../../src/lib/beep.js', () => ({ beep: vi.fn(), installAudioUnlock: vi.fn() }))
vi.mock('../../src/lib/printer.js', () => ({
  printComanda: vi.fn(async () => {}),
  printScontrino: vi.fn(async () => {}),
  loadPrinterSettings: vi.fn(() => ({})),
  claimReceiptPrint: vi.fn(() => false),
}))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  readerCheckout: vi.fn(async () => ({})),
  readerTerminate: vi.fn(async () => {}),
}))
vi.mock('../../src/lib/sumupApi.js', () => ({
  syncSumUpProducts: vi.fn(async () => ({ synced: 0 })),
  isSumUpEnabled: false,
}))
vi.mock('../../src/lib/staffApi.js', () => ({ preloadStaff: vi.fn() }))
vi.mock('../../src/lib/pendingOrders.js', () => ({
  subscribePending: (cb) => {
    cb({ pending: inVolo, banners: [] })
    return () => {}
  },
  dismissPending: vi.fn(),
  dismissBanner: vi.fn(),
}))

// Il resto del gestionale non è in prova qui: sezioni, pannelli e menu
// laterale diventano segnaposto, altrimenti montare la coda vorrebbe dire
// montare mezza app (e mezza app di finzioni).
vi.mock('../../src/components/MenuManager.jsx', () => ({ default: () => <div>menu</div> }))
vi.mock('../../src/components/PrinterSetup.jsx', () => ({ default: () => <div>stampante</div> }))
vi.mock('../../src/components/InventoryManager.jsx', () => ({ default: () => <div>inventario</div> }))
vi.mock('../../src/components/SettingsTab.jsx', () => ({ default: () => <div>impostazioni</div> }))
vi.mock('../../src/components/StatsTab.jsx', () => ({ default: () => <div>statistiche</div> }))
vi.mock('../../src/components/StaffHoursTab.jsx', () => ({ default: () => <div>ore</div> }))
vi.mock('../../src/components/UtentiTab.jsx', () => ({ default: () => <div>utenti</div> }))
vi.mock('../../src/components/VipTab.jsx', () => ({ default: () => <div>vip</div> }))
vi.mock('../../src/components/ServiceQueue.jsx', () => ({ default: () => <div>servizio</div> }))
vi.mock('../../src/components/StaffCallList.jsx', () => ({ default: () => <div>chiamate</div> }))
vi.mock('../../src/components/CassaTab.jsx', () => ({ default: () => <div>cassa</div> }))
vi.mock('../../src/components/InvoicesTab.jsx', () => ({ default: () => <div>fatture</div> }))
vi.mock('../../src/components/DevTools.jsx', () => ({ default: () => <div>dev</div> }))
vi.mock('../../src/components/StaffDrawer.jsx', () => ({ default: () => <div>menu laterale</div> }))
vi.mock('../../src/components/GroupsPanel.jsx', () => ({ default: () => <div>gruppi</div> }))
vi.mock('../../src/components/GroupView.jsx', () => ({ default: () => <div>gruppo</div> }))
vi.mock('../../src/components/ApriCassaBox.jsx', () => ({ default: () => <div>apri cassa</div> }))
vi.mock('../../src/components/ChiudiCassaBox.jsx', () => ({ default: () => <div>chiudi cassa</div> }))
vi.mock('../../src/components/PallinoStampante.jsx', () => ({ default: () => <div>pallino</div> }))
vi.mock('../../src/components/StatusBell.jsx', () => ({ default: () => <div>campanella</div> }))

import BartenderPage from '../../src/pages/BartenderPage.jsx'
import { updateOrderStatus, advanceComanda } from '../../src/lib/api.js'

const ORA = '2026-08-16T21:00:00.000Z'

// Un conto come arriva dalla coda: comande allineate allo stato, così le
// regole di chiusura (comande.js) rispondono come in produzione. Le righe
// stanno DENTRO la comanda, che è dove stanno davvero: al banco la card è
// il ticket, e senza righe nella comanda non ci sarebbe niente da leggere.
const conto = (patch) => ({
  daily_number: 1,
  status: 'aperto',
  payment_status: 'non_richiesto',
  created_at: ORA,
  order_date: '2026-08-16',
  cash_session_id: 'cassa-1',
  total: 10,
  order_items: [],
  comande: [
    {
      id: `c-${patch.id}`,
      seq: 1,
      status: patch.workflow_status ?? 'ricevuto',
      created_at: ORA,
      items: patch.order_items || [],
    },
  ],
  placed_by: { email: 'marta@bar.it', name: 'Marta', role: 'bartender' },
  ...patch,
})

const CODA = [
  conto({
    id: 'o41',
    daily_number: 41,
    workflow_status: 'ricevuto',
    table_label: '4',
    total: 24,
    order_items: [
      { id: 'i1', name: 'Negroni', qty: 2, unit_price: 9 },
      { id: 'i2', name: 'Gin tonic', qty: 1, unit_price: 6 },
    ],
  }),
  conto({
    id: 'o42',
    daily_number: 42,
    workflow_status: 'ricevuto',
    service_mode: 'banco',
    note: 'Poco ghiaccio',
    total: 9,
    order_items: [{ id: 'i3', name: 'Espresso Martini', qty: 1, unit_price: 9 }],
  }),
  conto({
    id: 'o39',
    daily_number: 39,
    workflow_status: 'in_preparazione',
    customer_name: 'Ciro',
    total: 30,
    order_items: [{ id: 'i4', name: 'Old Fashioned', qty: 2, unit_price: 15 }],
  }),
  conto({
    id: 'o37',
    daily_number: 37,
    workflow_status: 'pronto',
    total: 18,
    order_items: [{ id: 'i6', name: 'Americano', qty: 2, unit_price: 9 }],
  }),
  // pagato ma non ancora consegnato: resta al ritiro, col bollo «Pagato»
  conto({
    id: 'o36',
    daily_number: 36,
    workflow_status: 'pronto',
    payment_status: 'pagato',
    total: 40,
    order_items: [{ id: 'i7', name: 'Margarita', qty: 4, unit_price: 10 }],
  }),
  conto({
    id: 'o33',
    daily_number: 33,
    workflow_status: 'ritirato',
    table_label: '9',
    total: 58,
    order_items: [{ id: 'i5', name: 'Spritz', qty: 6, unit_price: 9 }],
  }),
]

// La colonna che ha per testata quel titolo.
const corsia = (titolo) => document.querySelector(`.corsia-${titolo}`)?.closest('.corsia')

function montaCoda() {
  return render(
    <MemoryRouter>
      <BartenderPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  ordini = CODA
  inVolo = []
  ruolo = 'admin'
  impostazioni = {
    queue_view: 'corsie',
    queue_search: 'filtra',
    workflow_enabled: true,
    groups_enabled: false,
    business_day_cutoff_hour: 6,
  }
})

// LE CORSIE DI CHI GUARDA LA SERATA. Erano quattro anche per lui, coi
// passi del servizio: ma «a che punto sta la preparazione» è una domanda
// del banco — a chi tiene la cassa serve sapere quanti conti sono aperti,
// quanti incassati e quanti saltati.
describe('le corsie di chi guarda la serata (admin)', () => {
  it('sono le tre del conto: in corso, chiusi, annullati', async () => {
    montaCoda()
    await screen.findByText('In corso')
    for (const titolo of ['In corso', '💶 Chiusi', '✖️ Annullati']) {
      expect(screen.getByText(titolo)).toBeInTheDocument()
    }
    // niente passi del servizio, e niente comande: la card è il conto
    expect(screen.queryByText('Da fare')).not.toBeInTheDocument()
    expect(screen.queryByText(/comanda 1/)).not.toBeInTheDocument()
    expect(within(corsia('attivi')).getByText('#41')).toBeInTheDocument()
    expect(
      within(corsia('attivi')).getAllByRole('button', { name: 'Incassa' })[0]
    ).toBeInTheDocument()
  })

  // IL LUCCHETTO SENZA NOME. Sugli schermi larghi la voce della cassa era
  // un'icona grigia in fondo alla barra: nessuno sapeva cosa fosse, e
  // quando era spenta non si capiva perché. È la cosa che chiude la
  // serata: si scrive, e il motivo sta attaccato al suo tasto — in fondo
  // alla riga finiva accanto al «+» e sembrava una nota del nuovo ordine.
  it('la cassa si chiama per nome, e dice perché non si può chiudere', async () => {
    montaCoda()
    await screen.findByText('In corso')
    const tasto = screen.getByRole('button', { name: /Chiudi cassa/ })
    expect(tasto).toBeDisabled()
    const dentro = within(tasto.closest('.board-cassa-box'))
    expect(dentro.getByText(/Prima chiudi \d+ cont/)).toBeInTheDocument()
  })

  it('niente tasto «Colonne»: tre corsie ci stanno tutte, non c’è niente da spegnere', async () => {
    montaCoda()
    await screen.findByText('In corso')
    expect(screen.queryByRole('button', { name: /Colonne/ })).not.toBeInTheDocument()
  })

  // LE DUE DOMANDE. Chi guarda la serata se le fa tutte e due: «come sta
  // andando» (i conti) e «a che punto è la preparazione» (le comande).
  // L'interruttore passa dall'una all'altra e si ricorda su questo
  // terminale; al banco non c'è, lì la risposta è sempre il lavoro.
  it('può passare alle comande, e al ricarico ci resta — ma non è il suo default', async () => {
    const utente = userEvent.setup()
    const vista = montaCoda()
    await screen.findByText('In corso')

    await utente.click(screen.getByRole('button', { name: /Comande/ }))
    expect(await screen.findByText('Da fare')).toBeInTheDocument()
    expect(screen.queryByText('In corso')).not.toBeInTheDocument()

    vista.unmount()
    montaCoda()
    expect(await screen.findByText('Da fare')).toBeInTheDocument()

    // e si torna indietro dallo stesso tasto
    await utente.click(screen.getByRole('button', { name: /Comande/ }))
    expect(await screen.findByText('In corso')).toBeInTheDocument()
  })
})

// A DECIDERE CHE AL BANCO SI VEDANO LE COMANDE SONO GLI STATI DEL
// SERVIZIO, non la vista scelta per la coda: quei passi sono ciò che dà
// senso alla vista del banco, e senza non c'è niente da mostrare. COME
// disegnarla lo dice `settings.bartender_view`, sorella di `queue_view`.
describe('la vista del banco si accende da sé', () => {
  beforeEach(() => {
    ruolo = 'bartender'
  })

  it('col servizio acceso il bartender apre sulle comande, qualunque vista abbia la coda', async () => {
    impostazioni = { ...impostazioni, queue_view: 'griglia' }
    montaCoda()
    await screen.findByText('Da fare')
    expect(within(corsia('da-fare')).getByText('#41')).toBeInTheDocument()
  })

  it('col servizio spento la vista del banco non esiste: si vede la coda come tutti', async () => {
    // Senza i passi del servizio non ci sarebbe niente da mostrare.
    impostazioni = { ...impostazioni, queue_view: 'griglia', workflow_enabled: false }
    montaCoda()
    await screen.findByText(/In servizio/)
    expect(screen.queryByText('Da fare')).not.toBeInTheDocument()
    // nessuna colonna: è la griglia, quella che sceglie l'impostazione
    expect(document.querySelector('.corsia')).toBe(null)
    expect(document.querySelector('.order-grid')).toBeTruthy()
  })

  it('la vista si sceglie dalle impostazioni del locale, e senza scelta è «corsie di stato»', async () => {
    // È una lista di viste possibili, non un interruttore: quando se ne
    // aggiungerà un'altra il valore già salvato resta buono.
    impostazioni = { ...impostazioni, queue_view: 'lista', bartender_view: undefined }
    montaCoda()
    await screen.findByText('Da fare')
  })
})

describe('le corsie del banco: una card per comanda', () => {
  beforeEach(() => {
    ruolo = 'bartender'
  })

  it('mostra le corsie del banco, con una card per COMANDA e i totali di ognuna', async () => {
    montaCoda()
    await screen.findByText('Da fare')
    // I nomi sono gli STATI del servizio, non dove sta il drink: la stessa
    // parola sul tasto che ci porta e sulla colonna dove finisce.
    // Il titolo si cerca nella TESTA della colonna: «In preparazione» è
    // anche il tasto della colonna accanto, ed e' voluto — il tasto dice
    // dove va a finire il conto.
    const titoli = [...document.querySelectorAll('.corsia-titolo')].map((n) => n.textContent)
    for (const titolo of [
      'Da fare',
      'In preparazione',
      'Ritiro/Servizio',
      'Ritirato/Servito',
      'Da incassare',
    ]) {
      expect(titoli.some((t) => t.startsWith(titolo))).toBe(true)
    }

    // Da fare: le due comande appena arrivate, col totale della colonna —
    // che è quello delle RIGHE che ci stanno dentro, non dei conti interi.
    const daFare = corsia('da-fare')
    expect(within(daFare).getByText('#41')).toBeInTheDocument()
    expect(within(daFare).getByText('#42')).toBeInTheDocument()
    // UNA COMANDA SOLA: nessun numero di ticket. Di base la comanda è una e
    // esce tutta per l'intero ordine — dividerla è la deroga — e finché
    // resta così questa vista è indistinguibile da quella dei conti.
    expect(within(daFare).queryByText(/comanda 1/)).not.toBeInTheDocument()
    expect(within(daFare).getByText('33,00 €')).toBeInTheDocument()

    // Ritiro/Servizio: il pronto e quello già pagato, che resta lì col bollo
    const alRitiro = corsia('al-ritiro')
    expect(within(alRitiro).getByText('#36')).toBeInTheDocument()
    expect(within(alRitiro).getByText('Pagato')).toBeInTheDocument()

    // Da incassare: il conto consegnato e non saldato, con la cifra grande
    const daIncassare = corsia('da-incassare')
    expect(within(daIncassare).getByText('#33')).toBeInTheDocument()
    expect(within(daIncassare).getByText('Tavolo 9 · 6 drink')).toBeInTheDocument()
    expect(daIncassare.querySelector('.corsia-cifra')).toHaveTextContent('58,00 €')
  })

  it('il tasto fa avanzare QUELLA comanda, non tutto il conto', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('Da fare')

    const daFare = corsia('da-fare')
    await utente.click(within(daFare).getAllByRole('button', { name: 'In preparazione' })[0])
    // advanceComanda, con l'id della comanda: è la stessa strada del
    // dettaglio del conto, non una scorciatoia di questa vista.
    expect(advanceComanda).toHaveBeenCalledWith('o41', 'c-o41', 'in_preparazione')
    expect(updateOrderStatus).not.toHaveBeenCalled()

    // e la card è già passata di corsia, senza aspettare il server: al
    // banco un gesto che non si vede subito è un gesto che si ripete.
    expect(within(corsia('al-banco')).getByText('#41')).toBeInTheDocument()

    // ogni corsia ha il verbo del suo passo
    expect(
      within(corsia('al-banco')).getAllByRole('button', { name: 'È pronto' })[0]
    ).toBeInTheDocument()
    expect(
      within(corsia('al-ritiro')).getAllByRole('button', { name: 'Ritirato/Servito' })[0]
    ).toBeInTheDocument()
    expect(
      within(corsia('da-incassare')).getByRole('button', { name: 'Incassa' })
    ).toBeInTheDocument()
  })

  it('toccando la card (non il tasto) si apre il conto', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('Da fare')

    await utente.click(within(corsia('da-fare')).getByText('#41'))
    expect(navigateSpy).toHaveBeenCalledWith('/ordine/o41')

    // «Incassa» invece porta dritto al pagamento del conto, che è il flusso
    // esistente: sconto, conto diviso, contanti, carta e lettore stanno lì.
    await utente.click(within(corsia('da-incassare')).getByRole('button', { name: 'Incassa' }))
    expect(navigateSpy).toHaveBeenCalledWith('/ordine/o33?pagamento=1')
  })

  it('la ricerca filtra dentro le corsie, tutte insieme', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('Da fare')

    await utente.type(screen.getByPlaceholderText(/Cerca numero/), '41')

    expect(screen.getByText('#41')).toBeInTheDocument()
    expect(screen.queryByText('#42')).not.toBeInTheDocument()
    expect(screen.queryByText('#33')).not.toBeInTheDocument()
    // le colonne restano tutte, anche svuotate: la loro posizione si
    // impara a memoria
    const titoli = [...document.querySelectorAll('.corsia-titolo')].map((n) => n.textContent)
    for (const titolo of ['Da fare', 'In preparazione', 'Ritiro/Servizio', 'Da incassare']) {
      expect(titoli.some((t) => t.startsWith(titolo))).toBe(true)
    }
  })

  it('due comande dello stesso conto stanno in due colonne diverse', async () => {
    // È il motivo per cui questa vista esiste: un conto con una comanda
    // pronta e un'aggiunta ancora da fare, disegnato come una card sola,
    // direbbe una cosa sbagliata comunque la si metta.
    ordini = [
      {
        ...CODA[0],
        id: 'o44',
        daily_number: 44,
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'pronto',
            created_at: ORA,
            items: [{ id: 'a', name: 'Negroni', qty: 2, unit_price: 9 }],
          },
          {
            id: 'c2',
            seq: 2,
            status: 'ricevuto',
            created_at: ORA,
            items: [{ id: 'b', name: 'Gin tonic', qty: 1, unit_price: 6 }],
          },
        ],
      },
    ]
    montaCoda()
    await screen.findByText('Da fare')

    expect(within(corsia('al-ritiro')).getByText('· comanda 1')).toBeInTheDocument()
    expect(within(corsia('al-ritiro')).getByText(/Negroni/)).toBeInTheDocument()
    expect(within(corsia('da-fare')).getByText('· comanda 2')).toBeInTheDocument()
    expect(within(corsia('da-fare')).getByText(/Gin tonic/)).toBeInTheDocument()
  })

  // CHI STA AL BANCO SPEGNE LE COLONNE CHE NON GLI SERVONO. A metà serata
  // guarda «Da fare» e «In preparazione»: le altre gli mangiano mezzo schermo
  // per roba che in quel momento non lo riguarda. La scelta è di QUESTO
  // terminale — al banco e alla cassa non si guardano le stesse cose — e
  // deve sopravvivere a un ricaricamento della pagina.
  it('le colonne si spengono e si riaccendono, e si ricordano al ricarico', async () => {
    const utente = userEvent.setup()
    const vista = montaCoda()
    await screen.findByText('Da fare')

    await utente.click(screen.getByRole('button', { name: /Colonne/ }))
    await utente.click(screen.getByRole('button', { name: 'Ritiro/Servizio', pressed: true }))
    expect(corsia('al-ritiro')).toBeFalsy()
    expect(corsia('da-fare')).toBeTruthy()

    // ricaricando la pagina la colonna è ancora spenta: è una preferenza
    // di chi sta a questo schermo, non un capriccio di questa sessione
    vista.unmount()
    montaCoda()
    await screen.findByText('Da fare')
    expect(corsia('al-ritiro')).toBeFalsy()

    // e si riaccende dallo stesso posto
    await utente.click(screen.getByRole('button', { name: /Colonne/ }))
    await utente.click(screen.getByRole('button', { name: 'Ritiro/Servizio', pressed: false }))
    expect(corsia('al-ritiro')).toBeTruthy()
  })

  it('un conto appena battuto si vede subito, prima ancora del server', async () => {
    // Altrimenti chi batte al POS torna in coda, non lo trova e lo ribatte.
    inVolo = [
      { tempId: 't1', state: 'sending', order: { table_label: '7', customer_name: 'Giulia' } },
    ]
    montaCoda()
    await screen.findByText('Da fare')

    const daFare = corsia('da-fare')
    expect(within(daFare).getByText('#…')).toBeInTheDocument()
    expect(within(daFare).getByText('Tavolo 7 · Giulia')).toBeInTheDocument()
  })

  // PAGATO MA ANCORA DA FARE. È il caso strano — i soldi li hai già presi,
  // il drink lo devi ancora fare — e la comanda resta dov'è: una comanda
  // diventa chiusa quando è stata SERVITA, non quando arrivano i soldi.
  it('il conto pagato in anticipo resta al banco col bollo, e non risulta chiuso', async () => {
    const utente = userEvent.setup()
    ordini = [
      {
        ...CODA[0],
        id: 'o45',
        daily_number: 45,
        payment_status: 'pagato',
        workflow_status: 'ricevuto',
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'ricevuto',
            created_at: ORA,
            items: [{ id: 'a', name: 'Negroni', qty: 1, unit_price: 9 }],
          },
        ],
      },
    ]
    montaCoda()
    await screen.findByText('Da fare')

    const daFare = corsia('da-fare')
    expect(within(daFare).getByText('#45')).toBeInTheDocument()
    expect(within(daFare).getByText('Pagato')).toBeInTheDocument()
    // la card si nota: non è una voce archiviata sbiadita
    expect(daFare.querySelector('.corsia-card')).toHaveClass('pagato-da-servire')
    // e non chiede soldi a nessuno: è già saldato
    expect(within(corsia('da-incassare')).queryByText('#45')).not.toBeInTheDocument()

    // «Chiuse» non ingombra il banco, ma si accende dal filtro — e lì
    // dentro questo conto NON c'è: il drink è ancora da fare.
    expect(corsia('chiusi')).toBeFalsy()
    await utente.click(screen.getByRole('button', { name: /Colonne/ }))
    await utente.click(screen.getByRole('button', { name: '💶 Chiuse', pressed: false }))
    expect(within(corsia('chiusi')).queryByText('#45')).not.toBeInTheDocument()
  })

  // CHI STA ALLO SHAKER NON INCASSA: quella colonna gli ruba spazio, e si
  // spegne come tutte le altre. Chi sta in cassa la tiene.
  it('anche «Da incassare» si nasconde dal filtro', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('Da fare')
    expect(corsia('da-incassare')).toBeTruthy()

    await utente.click(screen.getByRole('button', { name: /Colonne/ }))
    await utente.click(screen.getByRole('button', { name: 'Da incassare', pressed: true }))
    expect(corsia('da-incassare')).toBeFalsy()
    expect(corsia('da-fare')).toBeTruthy()
  })

  // ACCONTO: una parte incassata e il conto ancora aperto. Se la card non
  // lo dice, chi la porta al tavolo chiede l'intero — e succede.
  it('il conto con un acconto lo dice, e la card cambia colore', async () => {
    ordini = [
      {
        ...CODA[0],
        id: 'o47',
        daily_number: 47,
        payment_status: 'parziale',
        payments: [{ amount: 10, method: 'banco', at: ORA }],
      },
    ]
    montaCoda()
    await screen.findByText('Da fare')

    const daFare = corsia('da-fare')
    expect(within(daFare).getByText('💳 Acconto')).toBeInTheDocument()
    expect(daFare.querySelector('.corsia-card')).toHaveClass('acconto')
  })

  it('le comande di un conto annullato si ritrovano sotto «Annullate»', async () => {
    const utente = userEvent.setup()
    ordini = [
      {
        ...CODA[0],
        id: 'o46',
        daily_number: 46,
        status: 'annullato',
        workflow_status: 'annullato',
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'ricevuto',
            created_at: ORA,
            items: [{ id: 'a', name: 'Negroni', qty: 1, unit_price: 9 }],
          },
        ],
      },
    ]
    montaCoda()
    await screen.findByText('Da fare')
    // quella roba non si fa: non è lavoro
    expect(within(corsia('da-fare')).queryByText('#46')).not.toBeInTheDocument()

    await utente.click(screen.getByRole('button', { name: /Colonne/ }))
    await utente.click(screen.getByRole('button', { name: '✖️ Annullate', pressed: false }))
    expect(within(corsia('annullati')).getByText('#46')).toBeInTheDocument()
  })

  it('senza stati di servizio le corsie diventano tre: in corso, chiusi, annullati', async () => {
    impostazioni = { ...impostazioni, workflow_enabled: false }
    montaCoda()
    await screen.findByText('In corso')

    for (const titolo of ['In corso', '💶 Chiusi', '✖️ Annullati']) {
      expect(screen.getByText(titolo)).toBeInTheDocument()
    }
    expect(screen.queryByText('Da fare')).not.toBeInTheDocument()
    // Niente avanzamenti: senza gli stati l'unica cosa da fare a un conto
    // in corso è incassarlo.
    expect(screen.queryByRole('button', { name: 'In preparazione' })).not.toBeInTheDocument()
    expect(
      within(corsia('attivi')).getAllByRole('button', { name: 'Incassa' })[0]
    ).toBeInTheDocument()
  })

  // IL VERSO DELLA CODA VALE PER TUTTE LE CORSIE. Il «↕» girava solo la
  // griglia: nelle corsie premerlo non faceva niente di visibile, e un
  // tasto che non risponde fa dubitare dell'app.
  it('il tasto «↕» inverte l’ordine delle card in ogni corsia', async () => {
    const user = userEvent.setup()
    montaCoda()
    // I numeri corsia per corsia: l'ordine si gira DENTRO ogni colonna, non
    // fra colonne diverse — le corsie restano dove sono.
    const perCorsia = () =>
      [...document.querySelectorAll('.corsia')].map((c) =>
        [...c.querySelectorAll('.corsia-num')].map((n) => n.textContent.trim().split(' ')[0])
      )
    const prima = await waitFor(() => {
      const c = perCorsia()
      expect(c.some((col) => col.length > 1)).toBe(true)
      return c
    })
    await user.click(screen.getByRole('button', { name: /Ordina dal/ }))
    await waitFor(() => expect(perCorsia()).not.toEqual(prima))
    expect(perCorsia()).toEqual(prima.map((col) => [...col].reverse()))
  })
})