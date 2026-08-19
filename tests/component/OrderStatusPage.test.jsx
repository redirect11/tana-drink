// @vitest-environment happy-dom
'use strict'

// CHI APRE UN ORDINE, COSA VEDE.
//
// Difetto vero: introdotto il ruolo admin, chi entrava in un ordine si
// trovava la schermata del CLIENTE (stato, stepper) invece del POS, perché
// il controllo era rimasto `viewerRole === 'bartender'`. Al banco vuol dire
// non poter più aggiungere un drink al conto.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

const ORDINE = {
  id: 'o1',
  daily_number: 7,
  status: 'aperto',
  workflow_status: 'ricevuto',
  customer_name: 'Luigi',
  items: [{ drink_id: 'd1', name: 'Negroni', qty: 1, price: 8 }],
  // Come lo restituisce mapOrder: le righe normalizzate stanno in
  // order_items, ed è quello che la vista cliente somma.
  order_items: [{ drink_id: 'd1', name: 'Negroni', qty: 1, unit_price: 8 }],
  comande: [{ id: 'c1', seq: 1, status: 'ricevuto', items: [] }],
  total: 8,
  payments: [],
  // Ordine battuto al banco: è il caso in cui allo staff si offre il QR da
  // far scansionare al cliente.
  placed_by: { name: 'banco', email: 'banco@tana.local', role: 'admin' },
}

// Il ruolo di chi guarda, deciso dal singolo test.
let ruoloCorrente = null
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (a, cb) => {
    cb({
      uid: 'u1',
      email: 'capo@bar.it',
      getIdTokenResult: () => Promise.resolve({ claims: { role: ruoloCorrente } }),
    })
    return () => {}
  },
}))
vi.mock('../../src/lib/firebaseClient.js', () => ({
  auth: { currentUser: { uid: 'u1', email: 'capo@bar.it' } },
  db: {},
  functions: {},
}))
vi.mock('../../src/lib/api.js', async () => {
  const vero = await vi.importActual('../../src/lib/orderStatus.js')
  void vero
  return {
    DEFAULT_SETTINGS: { pickup_mode: 'bancone', groups_enabled: false },
    settingsIniziali: () => ({ pickup_mode: 'bancone', groups_enabled: false }),
    fetchOrder: vi.fn(() => Promise.resolve(ORDINE)),
    subscribeOrder: vi.fn((id, cb) => {
      cb(ORDINE)
      // Il filo per consegnare a mano, dal test, quello che il server
      // manderebbe mentre la pagina è aperta.
      filo.aggiorna = cb
      return () => {}
    }),
    subscribeSettings: vi.fn((cb) => {
      cb({ pickup_mode: 'bancone', groups_enabled: false, ...impostazioniCorrenti })
      return () => {}
    }),
    subscribeServiceStats: vi.fn((cb) => {
      cb({})
      return () => {}
    }),
    subscribeQueue: vi.fn((cb) => {
      cb([])
      return () => {}
    }),
    updateOrderItems: vi.fn(),
    updateOrderPushToken: vi.fn(),
    updateOrderStatus: vi.fn(),
    markOrderPaid: vi.fn(),
    cancelOrder: vi.fn(),
  }
})
vi.mock('../../src/lib/push.js', () => ({ getPushToken: vi.fn(() => Promise.resolve(null)) }))
vi.mock('../../src/lib/notify.js', () => ({
  ensureNotificationPermission: vi.fn(() => Promise.resolve(false)),
  notify: vi.fn(),
}))
vi.mock('../../src/lib/notifyStore.js', () => ({ recordNotif: vi.fn() }))
vi.mock('../../src/lib/toast.js', () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  showToast: vi.fn(),
}))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(() => Promise.resolve('data:,')) } }))
// Il POS vero è un componente enorme: qui interessa solo SE viene scelto.
vi.mock('../../src/components/OrderPosDetail.jsx', () => ({
  default: () => <div data-testid="pos">POS</div>,
}))

import OrderStatusPage from '../../src/pages/OrderStatusPage.jsx'
import { updateOrderItems } from '../../src/lib/api.js'
import { toastSuccess, toastError } from '../../src/lib/toast.js'
import { notify } from '../../src/lib/notify.js'
import { recordNotif } from '../../src/lib/notifyStore.js'

let impostazioniCorrenti = {}
const filo = { aggiorna: null }

// `query` serve per la VISTA CLIENTE («?cliente=1»): la stessa pagina che
// chi lavora usa come conto, chiesta apposta nella forma da girare al
// cliente.
const apri = (query = '') =>
  render(
    <MemoryRouter initialEntries={[`/ordine/o1${query}`]}>
      <OrderStatusPage />
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  impostazioniCorrenti = {}
})

describe('dettaglio ordine: a ciascuno la sua schermata', () => {
  it("l'admin lavora sull'ordine (POS), non lo guarda soltanto", async () => {
    ruoloCorrente = 'admin'
    apri()
    await waitFor(() => expect(screen.getByTestId('pos')).toBeInTheDocument())
  })

  it('il bartender: come prima, POS', async () => {
    ruoloCorrente = 'bartender'
    apri()
    await waitFor(() => expect(screen.getByTestId('pos')).toBeInTheDocument())
  })

  // CHI LAVORA ENTRA NEL CONTO, chiunque sia. La sala finiva sulla pagina
  // del CLIENTE — quella col riquadro «Il tuo numero» — che per chi serve
  // non vuol dire niente: per aggiungere una birra doveva prima trovare un
  // tasto «Modifica ordine» in fondo alla pagina.
  it('anche la sala entra nel conto, non nella pagina del cliente', async () => {
    ruoloCorrente = 'staff'
    apri()
    await waitFor(() => expect(screen.getByTestId('pos')).toBeInTheDocument())
  })

  it('il cliente vede lo stato', async () => {
    ruoloCorrente = undefined
    apri()
    await waitFor(() => expect(screen.queryByTestId('pos')).toBeNull())
  })
})

// IL QR SERVE SE C'È QUALCOSA DA SEGUIRE. Il cliente lo scansiona per vedere
// a che punto è il suo drink: senza gli stati del servizio non c'è nessun
// punto da vedere — la pagina dice solo cosa ha ordinato — e offrirlo è
// promettere una cosa che non succede.
describe('il QR per il cliente', () => {
  it('con gli stati del servizio, la sala lo può mostrare', async () => {
    ruoloCorrente = 'staff'
    impostazioniCorrenti = { workflow_enabled: true }
    apri('?cliente=1')
    expect(await screen.findByRole('button', { name: /Mostra QR/ })).toBeInTheDocument()
  })

  it('senza stati del servizio non compare: non ci sarebbe niente da seguire', async () => {
    ruoloCorrente = 'staff'
    impostazioniCorrenti = { workflow_enabled: false }
    apri('?cliente=1')
    await waitFor(() => expect(screen.queryByRole('button', { name: /Mostra QR/ })).toBeNull())
  })
})

// SALVARE DEVE DIRE COM'È ANDATA. Il tasto tornava «Salva modifiche» e
// basta — identico a prima di premerlo — e chi aveva cambiato una quantità
// restava lì a chiedersi se fosse andata. E premendolo senza aver toccato
// niente si finiva nella finestra dell'ANNULLO: si chiede di salvare e ti
// viene chiesto se buttare il conto.
describe('salvare le modifiche a un ordine', () => {
  // È il CLIENTE che salva le quantità da qui: la sala ha «Modifica
  // ordine», che apre la schermata del conto (vedi sotto).
  it('salvando si conferma', async () => {
    const user = userEvent.setup()
    ruoloCorrente = undefined
    apri()
    await user.click(await screen.findByRole('button', { name: /Salva modifiche/ }))
    await waitFor(() => expect(updateOrderItems).toHaveBeenCalled())
    expect(toastSuccess).toHaveBeenCalledWith('Modifiche salvate')
  })

  it('e se il server rifiuta lo dice dove si vede, non solo in fondo', async () => {
    const user = userEvent.setup()
    ruoloCorrente = undefined
    updateOrderItems.mockRejectedValueOnce(new Error('Ordine già in preparazione'))
    apri()
    await user.click(await screen.findByRole('button', { name: /Salva modifiche/ }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining('non salvate'))
    )
  })
})

// LA SCHERMATA DA GIRARE AL CLIENTE. Resta utile — il QR con cui il cliente
// segue l'ordine dal suo telefono — ma è di chi serve, non di chi ordina:
// il riquadro «Il tuo numero» lì dentro prendeva mezzo schermo per dire
// una cosa che chi lavora sa già. E da lì si torna al conto con un tasto.
describe('la vista da girare al cliente', () => {
  it('niente riquadro «Il tuo numero»: quello è scritto per chi ordina', async () => {
    ruoloCorrente = 'staff'
    apri('?cliente=1')
    await waitFor(() => expect(screen.queryByTestId('pos')).toBeNull())
    expect(screen.queryByText('Il tuo numero')).toBeNull()
    expect(screen.getByText(/Ordine #7/)).toBeInTheDocument()
  })

  it('«Modifica» riporta al conto', async () => {
    const user = userEvent.setup()
    ruoloCorrente = 'staff'
    apri('?cliente=1')
    await user.click(await screen.findByRole('button', { name: /Modifica/ }))
    expect(await screen.findByTestId('pos')).toBeInTheDocument()
  })

  it('al cliente resta la sua pagina, numero compreso', async () => {
    ruoloCorrente = undefined
    apri('?cliente=1')
    expect(await screen.findByText('Il tuo numero')).toBeInTheDocument()
  })

  it('e le quantità le corregge lui: la griglia dei prodotti non gli si offre', async () => {
    ruoloCorrente = undefined
    apri()
    expect(await screen.findByRole('button', { name: /Salva modifiche/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Modifica ordine/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /💳 Pagamento/ })).toBeNull()
  })
})

// ── L'ANNULLAMENTO FATTO DA UN COLLEGA (BUG-003) ─────────────────────
// Un admin che apriva un conto annullato da un altro admin, su un altro
// dispositivo, si vedeva arrivare «⚠️ Problema con il tuo ordine — prego
// recarsi al bancone»: il messaggio scritto per il CLIENTE, che a chi sta
// dietro al bancone non vuol dire niente. Questa pagina cambia mestiere a
// seconda di chi guarda, e quel messaggio era di una sola delle due
// persone.
describe('un conto annullato altrove', () => {
  const annullato = {
    ...ORDINE,
    workflow_status: 'annullato',
    status: 'annullato',
    cancelled_by: 'bartender',
    cancel_notify: true,
    cancel_phrase: 'bancone',
  }

  async function apriEAnnulla(ruolo) {
    ruoloCorrente = ruolo
    apri()
    await waitFor(() => expect(filo.aggiorna).toBeTruthy())
    // Il ruolo arriva dal token, che è una promessa: prima si aspetta che
    // la pagina sappia chi la sta guardando.
    if (ruolo) await waitFor(() => expect(screen.getByTestId('pos')).toBeInTheDocument())
    act(() => filo.aggiorna(annullato))
  }

  it('a chi lavora non arriva più il messaggio del cliente', async () => {
    await apriEAnnulla('admin')
    expect(notify).not.toHaveBeenCalled()
  })

  // NIENTE CHE INTERROMPA, MA NON NIENTE. L'annullamento non è una cosa da
  // fare, è una cosa successa: si trova nella lista della campanella
  // entrando nell'app, invece di trovarselo addosso aprendo un conto.
  it('ma l’evento finisce nella lista della campanella, con parole da banco', async () => {
    await apriEAnnulla('admin')
    expect(recordNotif).toHaveBeenCalledWith('✖️ Conto annullato', expect.stringContaining('#7'))
  })

  // Vale per tutti quelli che lavorano, non solo per l'admin: al banco e in
  // sala quel messaggio è ugualmente fuori posto.
  it.each(['bartender', 'staff'])('lo stesso per il %s', async (ruolo) => {
    await apriEAnnulla(ruolo)
    expect(notify).not.toHaveBeenCalled()
    expect(recordNotif).toHaveBeenCalled()
  })

  // IL CLIENTE CONTINUA A RICEVERE LA SUA, com'era: è a lui che serve
  // sapere che deve alzarsi e andare al bancone.
  it('il cliente la riceve come prima', async () => {
    await apriEAnnulla(null)
    expect(notify).toHaveBeenCalledWith(
      '⚠️ Problema con il tuo ordine',
      'Prego recarsi al bancone.'
    )
    expect(recordNotif).not.toHaveBeenCalled()
  })
})
