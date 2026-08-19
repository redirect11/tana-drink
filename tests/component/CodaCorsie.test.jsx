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
import { act, render, screen, within, waitFor } from '@testing-library/react'
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
let mandaOrdini = null
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
// Chi risulta collegato, e i colpi di vita partiti: li pilota il test.
let presenzeFinte = []
let battiti = []
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
  // La coda dice «ci sono» e guarda chi c'è (legenda con le presenze):
  // qui non serve a niente, ma senza queste due la pagina non si monta.
  segnalaPresenza: (r) => battiti.push(r),
  subscribePresenze: (cb) => {
    cb(presenzeFinte)
    return () => {}
  },
  DEFAULT_SETTINGS: {},
  settingsIniziali: () => ({ ...impostazioni }),
  subscribeSettings: (cb) => {
    cb({ ...impostazioni })
    return () => {}
  },
  // La sottoscrizione resta in mano al test: dopo un gesto si può far
  // arrivare lo snapshot successivo, come fa la CACHE di Firestore — che
  // risponde subito, senza rete.
  subscribeActiveOrders: (cb) => {
    mandaOrdini = cb
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
  setOrderColore: vi.fn(),
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
import { nascondiOrdine, mostraOrdine } from '../../src/lib/ordiniNascosti.js'
import { updateOrderStatus, advanceComanda, setOrderColore } from '../../src/lib/api.js'

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
  mandaOrdini = null
  ruolo = 'admin'
  // L'elenco dei conti «appena chiusi qui» vive in memoria: senza pulirlo
  // un test si porterebbe dietro quello di prima.
  for (const o of CODA) mostraOrdine(o.id)
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

  // LA CASSA NON SI CHIUDE CON DRINK ANCORA DA FARE. Un conto può essere
  // già incassato e avere comande al banco: chiudere lì vorrebbe dire
  // mandare a casa la serata con dei drink pagati e mai usciti.
  it('con comande ancora da servire il tasto è spento, e lo dice', async () => {
    ordini = [
      {
        ...CODA[0],
        id: 'o70',
        daily_number: 70,
        payment_status: 'pagato',
        workflow_status: 'in_preparazione',
        comande: [{ id: 'c1', seq: 1, status: 'in_preparazione', created_at: ORA, items: [] }],
      },
    ]
    montaCoda()
    await screen.findByText('In corso')
    const tasto = screen.getByRole('button', { name: /Chiudi cassa/ })
    expect(tasto).toBeDisabled()
    // il conto è incassato — nessun conto aperto — ma il drink no
    const dentro = within(tasto.closest('.board-cassa-box'))
    expect(dentro.getByText('Prima servi 1 comanda')).toBeInTheDocument()
  })

  // UN CONTO RISCOSSO È UN CONTO CHIUSO. Con gli stati del servizio accesi
  // la coda considera chiuso solo quello pagato E servito — così un drink
  // pagato in anticipo non sparisce dal banco — ma queste corsie parlano
  // del CONTO, non del lavoro: chi aveva appena incassato lo cercava fra i
  // chiusi e lo trovava ancora «in corso». Il lavoro rimasto si vede dove
  // è il suo posto, nelle corsie delle comande.
  it('un conto appena incassato passa fra i chiusi, anche se c’è ancora da servire', async () => {
    ordini = [
      {
        ...CODA[0],
        id: 'o48',
        daily_number: 48,
        payment_status: 'pagato',
        payments: [{ amount: 24, method: 'banco', at: ORA }],
      },
    ]
    montaCoda()
    await screen.findByText('In corso')
    expect(within(corsia('chiusi')).getByText('#48')).toBeInTheDocument()
    expect(within(corsia('attivi')).queryByText('#48')).not.toBeInTheDocument()
  })

  // DENTRO I CHIUSI: SERVITI E DA SERVIRE. Un conto chiuso è un conto
  // incassato, e basta — si paga in anticipo tutte le sere. Prima quei
  // conti restavano in mezzo a quelli in corso, con un tasto «nascondi
  // pagati» per toglierseli dagli occhi; adesso stanno fra i chiusi, e
  // «quali hanno ancora roba da portare» si chiede lì dentro.
  it('nei chiusi si separano i serviti da quelli ancora da portare', async () => {
    const utente = userEvent.setup()
    ordini = [
      // incassato e tutto uscito
      {
        ...CODA[0],
        id: 'o60',
        daily_number: 60,
        payment_status: 'pagato',
        workflow_status: 'ritirato',
        comande: [{ id: 'c1', seq: 1, status: 'ritirato', created_at: ORA, items: [] }],
      },
      // incassato, ma un giro è ancora al banco
      {
        ...CODA[0],
        id: 'o61',
        daily_number: 61,
        payment_status: 'pagato',
        workflow_status: 'in_preparazione',
        comande: [
          { id: 'c1', seq: 1, status: 'ritirato', created_at: ORA, items: [] },
          { id: 'c2', seq: 2, status: 'in_preparazione', created_at: ORA, items: [] },
        ],
      },
    ]
    montaCoda()
    await screen.findByText('In corso')
    // tutti e due sono CHIUSI: i soldi sono presi
    expect(within(corsia('chiusi')).getByText('#60')).toBeInTheDocument()
    expect(within(corsia('chiusi')).getByText('#61')).toBeInTheDocument()

    await utente.click(screen.getByRole('button', { name: /Da servire/ }))
    expect(within(corsia('chiusi')).getByText('#61')).toBeInTheDocument()
    expect(within(corsia('chiusi')).queryByText('#60')).not.toBeInTheDocument()

    await utente.click(screen.getByRole('button', { name: /Serviti/ }))
    expect(within(corsia('chiusi')).getByText('#60')).toBeInTheDocument()
    expect(within(corsia('chiusi')).queryByText('#61')).not.toBeInTheDocument()

    // e vale SOLO dentro i chiusi: gli altri conti non si muovono
    expect(corsia('attivi')).toBeTruthy()
  })

  it('«Nascondi pagati» non c’è più: quei conti stanno fra i chiusi', async () => {
    montaCoda()
    await screen.findByText('In corso')
    expect(screen.queryByRole('button', { name: /Nascondi pagati/ })).not.toBeInTheDocument()
  })

  // ABBIAMO CAMBIATO IDEA: prima la pastiglia c'era solo se la coda era
  // già disegnata a corsie. Ma la vista del banco è una vista A SÉ, non una
  // variante delle corsie: chi tiene la cassa lavora in GRIGLIA perché è
  // quella che gli serve per i conti, e a metà serata vuole dare
  // un'occhiata a com'è messa la preparazione senza andare in Impostazioni
  // a cambiare vista, guardare, e tornare a rimetterla com'era.
  it('il tasto c’è anche a griglia, e tornando indietro la griglia è lì', async () => {
    const utente = userEvent.setup()
    impostazioni = { ...impostazioni, queue_view: 'griglia' }
    montaCoda()
    await screen.findByText(/In servizio/)
    expect(document.querySelector('.order-grid')).toBeTruthy()

    // IL TASTO DICE DOVE PORTA, non dove si è: si legge da sé, senza
    // dover prima capire com'è messa la vista adesso.
    await utente.click(screen.getByRole('button', { name: /Comande/ }))
    expect(await screen.findByText('Da fare')).toBeInTheDocument()
    expect(document.querySelector('.order-grid')).toBe(null)

    await utente.click(screen.getByRole('button', { name: /Ordini/ }))
    await waitFor(() => expect(document.querySelector('.order-grid')).toBeTruthy())
    expect(screen.queryByText('Da fare')).not.toBeInTheDocument()
  })

  // ERA STATO PROVATO SOTTO IL «+»: rettangolare sotto un tondo, appeso
  // nel vuoto e disallineato da tutto. Sta nella riga dei filtri, che è
  // fatta di pastiglie della stessa forma — ma A DESTRA, staccato: a
  // sinistra c'è quello che restringe la lista, a destra quello che cambia
  // vista, e nessuno lo deve leggere come un filtro in più.
  it('sta nella riga dei filtri, in fondo a destra e non fra i filtri', async () => {
    montaCoda()
    await screen.findByText('In corso')
    const tasto = screen.getByRole('button', { name: /Comande/ })
    const riga = tasto.closest('.chips-row')
    expect(riga).toBeTruthy()
    // stessa forma delle altre pastiglie
    expect(tasto).toHaveClass('chip')
    // ultimo della riga, e staccato dal gruppo dei filtri
    expect(riga.lastElementChild).toBe(tasto)
    expect(within(riga).getByRole('button', { name: /Miei/ })).toBeInTheDocument()
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

    // e si torna indietro dallo stesso tasto, che adesso dice «Ordini»
    await utente.click(screen.getByRole('button', { name: /Ordini/ }))
    expect(await screen.findByText('In corso')).toBeInTheDocument()
  })
})

// A DECIDERE CHE AL BANCO SI VEDANO LE COMANDE SONO GLI STATI DEL
// SERVIZIO, non la vista scelta per la coda: quei passi sono ciò che dà
// senso alla vista del banco, e senza non c'è niente da mostrare. COME
// disegnarla lo dice `settings.bartender_view`, sorella di `queue_view`.
// LA SALA SERVE, NON PREPARA (REQ-STAFF-014). Chi porta i vassoi va a
// guardare il lavoro per sapere cosa portare — la pastiglia «Comande» c'è
// anche per lui — ma quei passi non li segna: l'unico tasto che gli resta è
// quello dell'ultimo, «servito», perché è lui a portare il drink al tavolo.
describe('le corsie viste dalla sala', () => {
  beforeEach(() => {
    ruolo = 'staff'
  })

  it('guarda il lavoro, ma prendere in carico e segnare pronto non sono suoi', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('In corso')
    await utente.click(screen.getByRole('button', { name: /Comande/ }))
    await screen.findByText('Da fare')

    // Le colonne ci sono tutte: gli servono per sapere a che punto è il
    // lavoro. I tasti che lo fanno avanzare no.
    expect(within(corsia('da-fare')).queryByRole('button', { name: 'In preparazione' })).toBeNull()
    expect(within(corsia('al-banco')).queryByRole('button', { name: 'Pronto' })).toBeNull()

    // L'ultimo passo invece è il suo mestiere.
    expect(
      within(corsia('al-ritiro')).getAllByRole('button', { name: 'Ritirato/Servito' })[0]
    ).toBeInTheDocument()
    // E il conto che ha appena servito lo incassa: quelli sono soldi, non
    // lavoro del banco.
    expect(within(corsia('ritirati')).getByRole('button', { name: 'Incassa' })).toBeInTheDocument()
  })

  it('e dal ⋯ della card non torna indietro né divide', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('In corso')
    await utente.click(screen.getByRole('button', { name: /Comande/ }))
    await screen.findByText('Da fare')

    // Resta la ristampa: un foglio perso capita anche a chi serve.
    const azioni = within(corsia('al-banco')).getAllByRole('button', { name: /Azioni/ })[0]
    await utente.click(azioni)
    expect(screen.getByRole('button', { name: /Ristampa la comanda/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Torna a/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Preparazione parziale/ })).toBeNull()
  })
})

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

  // ── I FILTRI STANNO SULLA RIGA DEI CONTEGGI (BUG-042) ────────────
  //
  // Erano una riga a sé fra i conteggi e le testate delle colonne: 64px
  // — 8 di stacco, 40 di pastiglia, 4 di imbottitura, 12 sotto — per due
  // pastiglie corte, e tre livelli prima di vedere la prima comanda.
  // Questa lavagna si guarda da lontano mentre si versa: ogni riga
  // sprecata sopra è una comanda in meno sotto.
  it('i filtri non hanno più una riga loro: stanno sui conteggi', async () => {
    montaCoda()
    await screen.findByText('Da fare')

    const riga = screen.getByRole('button', { name: /Miei/ }).closest('.chips-row')
    const conteggi = riga.closest('.board-sotto')
    // Sulla riga dei conteggi, in testata — non un livello suo fra i
    // conteggi e le colonne.
    expect(conteggi).toBeTruthy()
    expect(within(conteggi).getByText(/apert/)).toBeInTheDocument()
    // Anche «Colonne» è lì con loro: la riga è una sola. (Il cambio vista
    // al banco non c'è: lì la risposta è sempre il lavoro.)
    expect(within(conteggi).getByRole('button', { name: /Colonne/ })).toBeInTheDocument()
    // E fuori dalla testata non resta nessuna riga di pastiglie: era
    // quella che costava il livello in più.
    const testata = document.querySelector('.board-head')
    expect(
      [...document.querySelectorAll('.chips-row')].filter((r) => !testata.contains(r))
    ).toHaveLength(0)
  })

  it('e fanno esattamente quello che facevano prima', async () => {
    // Si è spostato DOVE stanno, non cosa fanno.
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('Da fare')

    await utente.click(screen.getByRole('button', { name: /Miei/ }))
    expect(screen.getByRole('button', { name: /Miei/ })).toHaveClass('active')
    // «Colonne» apre ancora la scelta delle colonne, che è una riga a sé
    // ma solo finché è aperta — si tocca e si richiude.
    await utente.click(screen.getByRole('button', { name: /Colonne/ }))
    expect(document.querySelector('.corsie-scelta')).toBeTruthy()
  })

  // ── INCASSARE NON FA SPARIRE I DRINK DA FARE (BUG-023) ───────────
  //
  // Si incassa un conto che ha ancora comande «da fare» o «in
  // preparazione» e quelle sparivano dalla coda; ricaricando la pagina
  // tornavano. Non erano i dati — il pagamento non le serve (BUG-019) —
  // era la VISTA: chiudendo un conto lo si nasconde all'istante dalla coda
  // (ordiniNascosti, un elenco che vive in memoria, ed è per questo che il
  // ricaricamento «aggiustava»), e sparendo il conto sparivano anche le
  // sue comande. Al banco vuol dire non vedere più dei drink già pagati.
  //
  // Qui si ripercorre la sequenza SENZA rete: si incassa (il conto viene
  // nascosto e la cache rimanda il conto saldato) e subito dopo le due
  // comande devono essere ancora nelle loro corsie, col bollo «Pagato».
  it('incassando un conto, le comande ancora da fare restano al banco col bollo', async () => {
    const conDueComande = (pagato) => ({
      ...CODA[0],
      id: 'o90',
      daily_number: 90,
      payment_status: pagato ? 'pagato' : 'non_richiesto',
      workflow_status: 'ricevuto',
      comande: [
        { id: 'c1', seq: 1, status: 'ricevuto', created_at: ORA, items: [] },
        { id: 'c2', seq: 2, status: 'in_preparazione', created_at: ORA, items: [] },
      ],
    })
    ordini = [conDueComande(false)]
    montaCoda()
    await screen.findByText('Da fare')
    expect(within(corsia('da-fare')).getByText('#90')).toBeInTheDocument()

    // L'INCASSO, come lo vede la coda: il conto si nasconde subito e la
    // cache rimanda il conto saldato. Nessuna attesa di rete.
    act(() => {
      nascondiOrdine('o90')
      mandaOrdini([conDueComande(true)])
    })

    const daFare = corsia('da-fare')
    const alBanco = corsia('al-banco')
    expect(within(daFare).getByText('#90')).toBeInTheDocument()
    expect(within(alBanco).getByText('#90')).toBeInTheDocument()
    // e si vede che sono già pagate: i soldi ci sono, il drink no
    expect(within(daFare).getByText('Pagato')).toBeInTheDocument()
    expect(within(alBanco).getByText('Pagato')).toBeInTheDocument()
  })

  it('ma un conto senza più niente da fare si nasconde eccome', async () => {
    // È il motivo per cui il nascondere esiste: chiuso un conto servito,
    // resta a schermo per un attimo e chi guarda si chiede se sia andata.
    const servito = {
      ...CODA[0],
      id: 'o91',
      daily_number: 91,
      workflow_status: 'ritirato',
      comande: [{ id: 'c1', seq: 1, status: 'ritirato', created_at: ORA, items: [] }],
    }
    ordini = [servito]
    montaCoda()
    await screen.findByText('Da fare')
    act(() => nascondiOrdine('o91'))
    expect(screen.queryByText('#91')).not.toBeInTheDocument()
  })

  // ── COL SALTO ACCESO, «DA FARE» NON ESISTE ───────────────────────
  //
  // Se il locale fa nascere le comande già in preparazione, quel passo non
  // si usa: nessuna comanda ci nasce, nessuno guarda quella colonna. Non
  // si deve poterci rimandare una comanda a mano, e non si deve poter
  // accendere una colonna che resterà vuota. Ma il lavoro non si nasconde
  // mai: se una comanda ci è finita lo stesso, la colonna compare da sé.
  it('col salto acceso «Da fare» sparisce dal filtro delle colonne', async () => {
    const utente = userEvent.setup()
    impostazioni = { ...impostazioni, comande_in_preparazione: true }
    ordini = [
      {
        ...CODA[0],
        id: 'o95',
        daily_number: 95,
        workflow_status: 'in_preparazione',
        comande: [{ id: 'c1', seq: 1, status: 'in_preparazione', created_at: ORA, items: [] }],
      },
    ]
    montaCoda()
    await screen.findByText('In preparazione')

    // la colonna non c'è, e non si può nemmeno accendere
    expect(corsia('da-fare')).toBeFalsy()
    await utente.click(screen.getByRole('button', { name: /Colonne/ }))
    expect(screen.queryByRole('button', { name: 'Da fare' })).not.toBeInTheDocument()
  })

  it('ma una comanda ferma a «da fare» fa comparire la colonna lo stesso', async () => {
    impostazioni = { ...impostazioni, comande_in_preparazione: true }
    ordini = [
      {
        ...CODA[0],
        id: 'o96',
        daily_number: 96,
        workflow_status: 'ricevuto',
        comande: [{ id: 'c1', seq: 1, status: 'ricevuto', created_at: ORA, items: [] }],
      },
    ]
    montaCoda()
    await screen.findByText('Da fare')
    expect(within(corsia('da-fare')).getByText('#96')).toBeInTheDocument()
  })

  // ── IL PRONTO, UNITO O DIVISO ────────────────────────────────────
  //
  // Quella colonna tiene due lavori diversi: roba da portare a un tavolo e
  // roba che aspetta il cliente al bancone. Chi è in sala guarda i primi,
  // chi sta al banco i secondi.
  const contoPronto = (id, numero, modo) => ({
    ...CODA[0],
    id,
    daily_number: numero,
    service_mode: modo,
    workflow_status: 'pronto',
    comande: [{ id: 'c1', seq: 1, status: 'pronto', created_at: ORA, items: [] }],
  })

  it('di suo il pronto è una colonna sola, e la card dice come va consegnato', async () => {
    impostazioni = { ...impostazioni, service_mode: 'entrambi' }
    ordini = [contoPronto('o80', 80, 'banco')]
    montaCoda()
    await screen.findByText('Da fare')
    const pronto = corsia('al-ritiro')
    expect(within(pronto).getByText('#80')).toBeInTheDocument()
    // il badge sulla card: quella colonna tiene due lavori diversi, e
    // senza dirlo si guarda il tavolo per indovinarlo
    expect(pronto.querySelector('.pill.consegna-banco')).toBeTruthy()
    expect(corsia('al-ritiro-banco')).toBeFalsy()
  })

  it('dividendolo diventano due colonne, e il badge non serve più', async () => {
    const utente = userEvent.setup()
    impostazioni = { ...impostazioni, service_mode: 'entrambi' }
    ordini = [contoPronto('o80', 80, 'banco'), contoPronto('o81', 81, 'tavolo')]
    montaCoda()
    await screen.findByText('Da fare')

    await utente.click(screen.getByRole('button', { name: /Colonne/ }))
    await utente.click(screen.getByRole('button', { name: /Dividi il pronto/ }))

    expect(within(corsia('al-ritiro')).getByText('#81')).toBeInTheDocument()
    expect(within(corsia('al-ritiro-banco')).getByText('#80')).toBeInTheDocument()
    // la colonna dice già quello che direbbe il badge
    expect(corsia('al-ritiro-banco').querySelector('.pill.consegna-banco')).toBe(null)
  })

  it('col SOLO SERVIZIO non c’è niente da dividere, e il tasto non c’è', async () => {
    const utente = userEvent.setup()
    impostazioni = { ...impostazioni, service_mode: 'tavolo' }
    montaCoda()
    await screen.findByText('Da fare')
    await utente.click(screen.getByRole('button', { name: /Colonne/ }))
    expect(screen.queryByRole('button', { name: /Dividi il pronto/ })).not.toBeInTheDocument()
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
      'Pronto',
      'Ritirato/Servito',
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

    // Pronto: il pronto e quello già pagato, che resta lì col bollo
    const alRitiro = corsia('al-ritiro')
    expect(within(alRitiro).getByText('#36')).toBeInTheDocument()
    expect(within(alRitiro).getByText('Pagato')).toBeInTheDocument()

    // Ritirato/Servito: la comanda consegnata di un conto non saldato.
    // C'era una colonna «Da incassare» con dentro il CONTO: conteneva gli
    // stessi drink di questa, solo raggruppati per conto invece che per
    // ticket. La card resta il ticket e non chiede soldi — dice che quei
    // drink sono usciti — e il tasto porta in cassa.
    const ritirati = corsia('ritirati')
    expect(within(ritirati).getByText('#33')).toBeInTheDocument()
    expect(within(ritirati).getByText('Tavolo 9')).toBeInTheDocument()
    expect(within(ritirati).getByText(/Spritz/)).toBeInTheDocument()
    expect(document.querySelector('.corsia-da-incassare')).toBe(null)
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
      within(corsia('al-banco')).getAllByRole('button', { name: 'Pronto' })[0]
    ).toBeInTheDocument()
    expect(
      within(corsia('al-ritiro')).getAllByRole('button', { name: 'Ritirato/Servito' })[0]
    ).toBeInTheDocument()
    expect(
      within(corsia('ritirati')).getByRole('button', { name: 'Incassa' })
    ).toBeInTheDocument()
  })

  // DOVE PORTANO I TOCCHI. Dal banco la prima domanda è «cosa devo fare
  // qui», e la risposta è il TICKET: la card apre la comanda. Il conto è
  // l'altra domanda — quanto fa, cosa aggiungo, chi paga — e ha un tasto
  // suo, piccolo e scritto, che non ruba il posto a quello grande.
  it('toccando la card si apre la COMANDA; al conto si va da un tasto suo', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('Da fare')

    await utente.click(within(corsia('da-fare')).getByText('#41'))
    expect(navigateSpy).toHaveBeenCalledWith('/ordine/o41/comanda/c-o41')

    const card = within(corsia('da-fare')).getByText('#41').closest('.corsia-card')
    await utente.click(within(card).getByRole('button', { name: /Conto/ }))
    expect(navigateSpy).toHaveBeenCalledWith('/ordine/o41')

    // ANCHE LA COMANDA SERVITA È UN TICKET: si apre come le altre, e ha il
    // suo tasto per il conto. Prima quella colonna conteneva il CONTO, e
    // toccarla apriva direttamente il conto.
    await utente.click(within(corsia('ritirati')).getByText('#33'))
    expect(navigateSpy).toHaveBeenCalledWith('/ordine/o33/comanda/c-o33')

    // «Incassa» invece porta dritto al pagamento del conto, che è il flusso
    // esistente: sconto, conto diviso, contanti, carta e lettore stanno lì.
    await utente.click(within(corsia('ritirati')).getByRole('button', { name: 'Incassa' }))
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
    for (const titolo of ['Da fare', 'In preparazione', 'Pronto', 'Ritirato/Servito']) {
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
    await utente.click(screen.getByRole('button', { name: 'Pronto', pressed: true }))
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
    await utente.click(screen.getByRole('button', { name: 'Pronto', pressed: false }))
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
    expect(within(corsia('ritirati')).queryByText('#45')).not.toBeInTheDocument()

    // «Chiuse» non ingombra il banco, ma si accende dal filtro — e lì
    // dentro questo conto NON c'è: il drink è ancora da fare.
    expect(corsia('chiusi')).toBeFalsy()
    await utente.click(screen.getByRole('button', { name: /Colonne/ }))
    await utente.click(screen.getByRole('button', { name: '💶 Chiuse', pressed: false }))
    expect(within(corsia('chiusi')).queryByText('#45')).not.toBeInTheDocument()
  })

  // CHI STA ALLO SHAKER NON INCASSA: quella colonna gli ruba spazio, e si
  // spegne come tutte le altre. Chi sta in cassa la tiene.
  it('anche «Ritirato/Servito» si nasconde dal filtro', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('Da fare')
    expect(corsia('ritirati')).toBeTruthy()

    await utente.click(screen.getByRole('button', { name: /Colonne/ }))
    await utente.click(screen.getByRole('button', { name: 'Ritirato/Servito', pressed: true }))
    expect(corsia('ritirati')).toBeFalsy()
    expect(corsia('da-fare')).toBeTruthy()
  })

  // ACCONTO: una parte incassata e il conto ancora aperto. Se la card non
  // lo dice, chi la porta al tavolo chiede l'intero — e succede.
  // LE AZIONI DI UNA COMANDA SI APRONO NELLA CARD, come per i conti: una
  // finestrella a tutto schermo per un «torna a in preparazione» fa perdere
  // di vista la colonna proprio mentre si lavora.
  it('il ⋯ della comanda apre le sue azioni dentro la card', async () => {
    const utente = userEvent.setup()
    montaCoda()
    await screen.findByText('Da fare')

    const card = corsia('al-banco').querySelector('.corsia-card')
    await utente.click(within(card).getByRole('button', { name: /Azioni/ }))

    // stanno DENTRO la card, non in una finestrella sopra la pagina
    const aperte = card.querySelector('.corsia-azioni-aperte')
    expect(aperte).toBeTruthy()
    expect(within(aperte).getByRole('button', { name: /Torna a/ })).toBeInTheDocument()
    expect(within(aperte).getByRole('button', { name: /Ristampa/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // e si richiude dallo stesso tasto
    await utente.click(within(card).getByRole('button', { name: /Chiudi/ }))
    expect(card.querySelector('.corsia-azioni-aperte')).toBeFalsy()
  })

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
// ── IL COLORE DEL CONTO (REQ-UI-020) ─────────────────────────────────
//
// Un conto battuto in tre volte diventa tre comande, e le tre comande
// finiscono in tre colonne diverse della lavagna: da due metri nessuno vede
// più che sono lo stesso tavolo. Il colore tinge la CARD INTERA, ed è del
// conto — la comanda se lo porta dietro.
//
// Fu provato come pallino accanto al numero e non serviva a niente: questo
// colore deve rispondere da lontano, e dieci pixel da lontano non ci sono.
//
// Le due cose che qui costano un drink sbagliato:
//   · lo stesso conto tinge le sue card allo stesso modo in TUTTE le colonne;
//   · la striscia a sinistra resta quella dello STATO. Fra i due segni vince
//     lo stato, sempre: è quello che dice cosa fare adesso, e se il colore
//     del conto se lo mangiasse la lavagna diventerebbe muta.
describe('il colore del conto, e le comande che se lo portano dietro', () => {
  const colorate = (nodo) => [...nodo.querySelectorAll('.conto-colorato')]
  const tinta = (card) => card.style.getPropertyValue('--conto-colore')

  it('lo stesso conto tinge le sue card in tutte le colonne', async () => {
    ruolo = 'bartender'
    ordini = [
      {
        ...CODA[0],
        id: 'o44',
        daily_number: 44,
        colore: '#9b59b6',
        comande: [
          { id: 'c1', seq: 1, status: 'pronto', created_at: ORA, items: [{ id: 'a', name: 'Negroni', qty: 1, unit_price: 9 }] },
          { id: 'c2', seq: 2, status: 'ricevuto', created_at: ORA, items: [{ id: 'b', name: 'Gin tonic', qty: 1, unit_price: 6 }] },
        ],
      },
    ]
    montaCoda()
    await screen.findByText('Da fare')

    const daFare = colorate(corsia('da-fare'))
    const alRitiro = colorate(corsia('al-ritiro'))
    expect(daFare).toHaveLength(1)
    expect(alRitiro).toHaveLength(1)
    // Lo stesso colore, non «uno a testa»: è tutto il punto.
    expect(tinta(daFare[0])).toBe('#9b59b6')
    expect(tinta(alRitiro[0])).toBe('#9b59b6')
  })

  it('un conto senza colore resta com’è: non se ne inventa uno', async () => {
    // I conti nati prima dell'impostazione restano com'erano. Se il colore
    // si ricalcolasse dall'id, accendere l'interruttore colorerebbe di
    // colpo tutta la coda — e domani, cambiata la tavolozza, la
    // colorerebbe di nuovo diversa.
    ruolo = 'bartender'
    ordini = [{ ...CODA[0], id: 'o45', daily_number: 45 }]
    montaCoda()
    await screen.findByText('Da fare')

    expect(colorate(document.body)).toHaveLength(0)
  })

  it('vince lo stato: la striscia della card non cambia per il colore', async () => {
    ordini = [{ ...CODA[0], id: 'o46', daily_number: 46, colore: '#e74c3c' }]
    montaCoda()
    await screen.findByText('In corso')

    const card = document.querySelector('.corsia-card')
    // La striscia a sinistra è dello STATO, e resta dov'era: il fondo
    // colorato è un segno in più, non un segno al posto di quello. La
    // classe dello stato sopravvive accanto a quella del colore, e nessuno
    // scrive il bordo a mano.
    expect(card).toHaveClass('ricevuto')
    expect(card).toHaveClass('conto-colorato')
    expect(card.style.borderLeftColor).toBe('')
    expect(tinta(card)).toBe('#e74c3c')
  })

  it('dal ⋯ della comanda si dà il colore, ed è quello del CONTO', async () => {
    ruolo = 'bartender'
    const utente = userEvent.setup()
    ordini = [{ ...CODA[0], id: 'o47', daily_number: 47 }]
    montaCoda()
    await screen.findByText('Da fare')

    const card = corsia('da-fare').querySelector('.corsia-card')
    await utente.click(within(card).getByRole('button', { name: /Azioni/ }))
    const aperte = card.querySelector('.corsia-azioni-aperte')
    await utente.click(within(aperte).getByRole('button', { name: 'Colore #2ecc71' }))

    // Si scrive sul CONTO (o47), non sulla comanda: è il conto ad avere un
    // colore, e le sue comande lo mostrano.
    expect(setOrderColore).toHaveBeenCalledWith('o47', '#2ecc71')
  })

  it('e si toglie, per un conto colorato per sbaglio', async () => {
    const utente = userEvent.setup()
    ordini = [{ ...CODA[0], id: 'o48', daily_number: 48, colore: '#e74c3c' }]
    montaCoda()
    await screen.findByText('In corso')

    const card = document.querySelector('.corsia-card')
    await utente.click(within(card).getByRole('button', { name: /Azioni/ }))
    await utente.click(within(card).getByRole('button', { name: 'Nessun colore' }))

    expect(setOrderColore).toHaveBeenCalledWith('o48', null)
  })
})

// ── CHI È COLLEGATO, NELLA LEGENDA (REQ-CODA-005) ────────────────────
//
// La legenda diceva solo chi aveva già battuto un conto: chi si collegava
// non compariva, e non sapeva con che lettera si sarebbe riconosciuto.
//
// La cosa da non sbagliare è CHI PUÒ SAPERLO: admin e bartender sì, la
// sala no. Sapere chi è collegato è un'informazione sulle persone, non sul
// lavoro, e non deve servire a controllare i colleghi. Il lucchetto vero è
// nelle regole di Firestore; qui si controlla che la schermata non chieda
// nemmeno il dato quando non le spetta.
describe('chi è collegato, nella legenda', () => {
  const OGGI = new Date().toISOString()

  // La voce è spezzata fra più elementi (la lettera in uno span, il nome
  // accanto): si guarda il testo della legenda intera, che è anche il modo
  // in cui la legge chi sta al banco.
  const legenda = () => document.querySelector('.order-legend')?.textContent || ''

  it('l’admin vede in legenda anche chi non ha ancora battuto niente', async () => {
    ruolo = 'admin'
    // Bruno e non Marco: nei dati di prova c'è già una Marta, e due nomi
    // con la stessa iniziale si pestano — è un difetto suo della legenda,
    // vecchio quanto la legenda stessa (BUG-043), non di questa aggiunta.
    presenzeFinte = [{ uid: 'u-bruno', name: 'Bruno', role: 'staff', last_seen: OGGI }]
    montaCoda()
    await screen.findByText('In corso')
    await waitFor(() => expect(legenda()).toContain('Bruno'))
  })

  it('alla sala quella riga non arriva', async () => {
    ruolo = 'staff'
    presenzeFinte = [{ uid: 'u-bruno', name: 'Bruno', role: 'staff', last_seen: OGGI }]
    montaCoda()
    await screen.findByText('In corso')

    expect(legenda()).not.toContain('Bruno')
  })

  it('ma la sala dice lo stesso che c’è: gli altri devono saperlo', async () => {
    ruolo = 'staff'
    battiti = []
    presenzeFinte = []
    montaCoda()
    await screen.findByText('In corso')

    // Un colpo di vita parte comunque — chi è in sala non vede l'elenco,
    // ma negli elenchi degli altri ci deve stare.
    expect(battiti.length).toBeGreaterThan(0)
  })

  it('chi tace da troppo non compare, anche se la riga è rimasta', async () => {
    ruolo = 'admin'
    const vecchio = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    presenzeFinte = [{ uid: 'u-sara', name: 'Sara', role: 'staff', last_seen: vecchio }]
    montaCoda()
    await screen.findByText('In corso')

    expect(legenda()).not.toContain('Sara')
  })
})
