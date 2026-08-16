// @vitest-environment happy-dom
'use strict'

// Test di COMPONENTE del dettaglio ordine POS (OrderPosDetail): monta il
// componente vero con React Testing Library e verifica ciò che il bartender
// vede e tocca. Firebase/menu/stampante sono mockati.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

// ── Mock dei moduli con dipendenze Firebase/hardware ──
const mockSettings = { payments_reader_enabled: false, sumup_reader_id: null }
vi.mock('../../src/lib/api.js', () => ({
  advanceComanda: vi.fn(() => Promise.resolve()),
  addComanda: vi.fn(() => Promise.resolve({ comande: [] })),
  bartenderUpdateComanda: vi.fn(() => Promise.resolve()),
  updateOrderInfo: vi.fn(() => Promise.resolve()),
  registerPayment: vi.fn(() => Promise.resolve({ closed: true })),
  setOrderDiscount: vi.fn(() => Promise.resolve()),
  setOrderLotteryCode: vi.fn(() => Promise.resolve()),
  createInvoice: vi.fn(() => Promise.resolve({ id: 'inv1', number: '1/2026' })),
  markInvoiceSent: vi.fn(() => Promise.resolve()),
  subscribeVouchers: vi.fn((cb) => { cb([]); return () => {} }),
  applyVoucherDiscount: vi.fn(() => Promise.resolve({ redeemed: 0 })),
  cancelOrder: vi.fn(() => Promise.resolve()),
  restoreOrder: vi.fn(() => Promise.resolve()),
  fetchInventoryItems: vi.fn(() => Promise.resolve([])),
  // Usati solo in creazione (order == null): qui no-op.
  createOrder: vi.fn(() => Promise.resolve({ id: 'ord-nuovo' })),
  ensureTodaySerata: vi.fn(() => Promise.resolve({ id: 'serata1' })),
  subscribeOrder: vi.fn(() => () => {}),
  fetchRecentDrinkIds: vi.fn(() => Promise.resolve([])),
  subscribePosPrefs: vi.fn(() => () => {}),
  savePosOrder: vi.fn(() => Promise.resolve()),
  savePosFavorites: vi.fn(() => Promise.resolve()),
  DEFAULT_SETTINGS: {},
  peekNextDailyNumber: vi.fn(() => Promise.resolve(5)),
  subscribeSettings: vi.fn((cb) => {
    cb(mockSettings)
    return () => {}
  }),
}))
vi.mock('../../src/lib/pendingOrders.js', () => ({ submitPosOrder: vi.fn() }))
vi.mock('../../src/lib/firebaseClient.js', () => ({ auth: {} }))
vi.mock('firebase/auth', () => ({ onAuthStateChanged: vi.fn(() => () => {}) }))
vi.mock('../../src/lib/paymentsApi.js', () => ({
  readerCheckout: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../../src/lib/menuCache.js', () => ({
  useMenu: () => ({
    drinks: [
      { id: 'mojito', name: 'Mojito', price: 7, available: true, category_id: 'cat1' },
      {
        id: 'gin',
        name: 'Gin Tonic',
        price: 8,
        available: true,
        category_id: 'cat1',
        recipe_items: [{ inventory_item_id: 'inv-gin', name: 'Gin', qty: 40, unit: 'ml' }],
      },
    ],
    cats: [{ id: 'cat1', name: 'Cocktail', sort_order: 0 }],
    loading: false,
  }),
}))
vi.mock('../../src/lib/printer.js', () => ({
  printComanda: vi.fn(() => Promise.resolve()),
  printScontrino: vi.fn(() => Promise.resolve()),
  printFattura: vi.fn(() => Promise.resolve()),
  loadPrinterSettings: vi.fn(() => ({ ivaRate: 10 })),
}))

import OrderPosDetail from '../../src/components/OrderPosDetail.jsx'
import {
  advanceComanda,
  addComanda,
  bartenderUpdateComanda,
  registerPayment,
  updateOrderInfo,
  cancelOrder,
  createOrder,
  restoreOrder,
} from '../../src/lib/api.js'
import { readerCheckout } from '../../src/lib/paymentsApi.js'
import { printComanda } from '../../src/lib/printer.js'

const baseOrder = (over = {}) => ({
  id: 'ord1',
  daily_number: 4,
  status: 'aperto',
  workflow_status: 'in_preparazione',
  payment_status: 'non_richiesto',
  customer_name: 'iole',
  table_label: '3',
  note: null,
  total: 14,
  coperto_amount: 0,
  service_charge_amount: 0,
  tip_amount: 0,
  order_items: [
    { id: 'ord1-0', drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2, custom: false },
  ],
  comande: [
    {
      id: 'c1',
      seq: 1,
      status: 'in_preparazione',
      status_times: {},
      created_at: '2026-07-11T21:00:00.000Z',
      items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
    },
  ],
  ...over,
})

function mount(order) {
  return render(
    <MemoryRouter>
      <OrderPosDetail order={order} />
    </MemoryRouter>
  )
}

// I tasti in fondo al conto. Serve cercarli QUI dentro: la finestra del
// ripristino ha un tasto che si chiama come quello che l'ha aperta, e
// cercandolo in tutta la pagina se ne trovano due.
const azioni = () => within(document.querySelector('.posd-foot-azioni'))

beforeEach(() => {
  vi.clearAllMocks()
  // La bozza è persistita in localStorage per ordine: pulisco tra i test.
  localStorage.clear()
})

describe('vista aggregata: ordine a destra, comande nascoste', () => {
  it("mostra i prodotti dell'ORDINE aggregato, non le singole comande", () => {
    mount(baseOrder())
    // testata colonna ordine: numero + nome del conto (spostati a destra)
    expect(screen.getAllByText(/#4/).length).toBeGreaterThan(0)
    expect(screen.getByText(/· iole/)).toBeInTheDocument()
    // destra: l'ordine aggregato (niente sezioni COMANDA in vista)
    expect(screen.queryByText(/COMANDA 1/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Mojito/).length).toBeGreaterThan(0)
    // accesso alle comande dal bottone dedicato
    expect(screen.getByRole('button', { name: /Comande \(1\)/ })).toBeInTheDocument()
    // centro: griglia visibile contemporaneamente
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
  })

  it('conto vuoto: griglia + ordine vuoto', () => {
    mount(baseOrder({ comande: [], order_items: [], workflow_status: 'ricevuto' }))
    expect(screen.getByText(/Tocca i prodotti per aggiungerli/)).toBeInTheDocument()
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
  })
})

describe('aggiunte: la nuova comanda è gestita internamente', () => {
  it('tap sulla griglia → gli item si CONFERMANO da soli, confluiscono nella comanda in prep.', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getAllByText('Gin Tonic')[0])
    await user.click(screen.getAllByText('Gin Tonic')[0])
    // l'aggiunta è confermata da sola (senza cliccare Conferma)
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    // l'ordine è in preparazione → NON crea una nuova comanda: confluisce in c1
    expect(addComanda).not.toHaveBeenCalled()
    const [orderId, comandaId, payload] = bartenderUpdateComanda.mock.calls.at(-1)
    expect(orderId).toBe('ord1')
    expect(comandaId).toBe('c1')
    expect(payload.items.some((i) => i.drink_id === 'gin')).toBe(true)
    expect(payload.items.some((i) => i.drink_id === 'mojito')).toBe(true)
    expect(printComanda).not.toHaveBeenCalled()
  })

  it('ordine già SERVITO: l\'aggiunta crea una NUOVA comanda (addComanda)', async () => {
    const user = userEvent.setup()
    mount(
      baseOrder({
        comande: [
          { id: 'c1', seq: 1, status: 'ritirato', status_times: {}, items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }] },
        ],
      })
    )
    await user.click(screen.getAllByText('Gin Tonic')[0])
    // nessuna comanda modificabile → nuova comanda, da sola
    await waitFor(() => expect(addComanda).toHaveBeenCalled())
    expect(bartenderUpdateComanda).not.toHaveBeenCalled()
    const [orderId, items] = addComanda.mock.calls.at(-1)
    expect(orderId).toBe('ord1')
    expect(items.some((i) => i.drink_id === 'gin')).toBe(true)
  })

  it('la modifica per-item PRECARICA gli ingredienti del drink (si sostituiscono, non solo si aggiungono)', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByText('Gin Tonic'))
    // l'item nel conto è cliccabile per modificarlo (niente tasto matita)
    await user.click(screen.getAllByTitle(/Modifica Gin Tonic/).at(-1))
    // la ricetta del prodotto è già lì, quindi si può togliere/cambiare
    expect(screen.getByLabelText('Quantità Gin')).toHaveValue(40)
    expect(screen.queryByText(/non ha ingredienti configurati/)).not.toBeInTheDocument()
  })

  it('drink SENZA ingredienti: avvisa il bartender', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    // Il Mojito non ha recipe_items nel menù mock. L'item è cliccabile per
    // modificarlo; ce n'è più d'uno (comanda + bozza): modifico l'ultima aggiunta.
    await user.click(screen.getAllByText('Mojito')[0])
    await user.click(screen.getAllByTitle(/Modifica Mojito/).at(-1))
    expect(screen.getByText(/non ha ingredienti configurati/)).toBeInTheDocument()
  })

  it('GRIGLIA vs + sulla riga: la griglia duplica, il + aumenta la quantità', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    // due tocchi sulla stessa tile → DUE righe separate di Gin Tonic
    await user.click(screen.getAllByText('Gin Tonic')[0])
    await user.click(screen.getAllByText('Gin Tonic')[0])
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    const dopoGriglia = bartenderUpdateComanda.mock.calls.at(-1)[2].items
    const ginRighe = dopoGriglia.filter((i) => i.drink_id === 'gin')
    expect(ginRighe).toHaveLength(2)
    expect(ginRighe.every((i) => i.qty === 1)).toBe(true)

    // il + sulla riga del Mojito (già nel conto) ne aumenta la QUANTITÀ
    bartenderUpdateComanda.mockClear()
    await user.click(screen.getByRole('button', { name: 'Aumenta Mojito' }))
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    const dopoPiu = bartenderUpdateComanda.mock.calls.at(-1)[2].items
    const mojito = dopoPiu.filter((i) => i.drink_id === 'mojito')
    expect(mojito).toHaveLength(1) // niente riga nuova
    expect(mojito[0].qty).toBe(3) // erano 2
  })

  it('Unisci accorpa righe uguali con quantità diverse (4 + 1 = 5)', async () => {
    const user = userEvent.setup()
    mount(
      baseOrder({
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'in_preparazione',
            status_times: {},
            items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 4 }],
          },
        ],
      })
    )
    // una riga da 4; se ne aggiunge una da 1 dalla griglia → due righe
    await user.click(screen.getAllByText('Mojito')[0])
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    expect(bartenderUpdateComanda.mock.calls.at(-1)[2].items.filter((i) => i.drink_id === 'mojito')).toHaveLength(2)

    // il tasto Unisci c'è e accorpa in una riga da 5
    bartenderUpdateComanda.mockClear()
    await user.click(screen.getByRole('button', { name: /Unisci/ }))
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    const uniti = bartenderUpdateComanda.mock.calls.at(-1)[2].items.filter((i) => i.drink_id === 'mojito')
    expect(uniti).toHaveLength(1)
    expect(uniti[0].qty).toBe(5)
  })

  it("il tasto è UNO: quando c'è da unire mostra Unisci, e Separa vive nel ⋯", async () => {
    // Erano due tasti fissi, ma dei due ne serve uno alla volta: il tasto
    // unico mostra l'azione possibile (vince Unisci), l'altra resta nel ⋯.
    const user = userEvent.setup()
    mount(
      baseOrder({
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'in_preparazione',
            status_times: {},
            items: [
              { drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 4 }, // da separare
              { drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 },
              { drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 }, // da unire
            ],
          },
        ],
      })
    )
    expect(screen.getByRole('button', { name: /🔗 Unisci/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /⑃ Separa/ })).toBeNull()

    // Separa non è persa: dal menu ⋯ il Mojito da 4 diventa 4 righe da 1
    await user.click(screen.getByRole('button', { name: 'Azioni del conto' }))
    await user.click(screen.getByRole('button', { name: /Separa le quantità/ }))
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    const dopo = bartenderUpdateComanda.mock.calls.at(-1)[2].items
    expect(dopo.filter((i) => i.drink_id === 'mojito')).toHaveLength(4)
  })

  it("il + su un item del conto è un'aggiunta che si conferma da sola", async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: 'Aumenta Mojito' }))
    // ordine in preparazione → l'aggiunta confluisce da sola nella comanda c1
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    expect(addComanda).not.toHaveBeenCalled()
  })
})

describe('diminuzioni: solo dalle comande ancora modificabili', () => {
  it('avanza lo stato della comanda ATTIVA dal popup Servizio', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Stato servizio/ }))
    await user.click(screen.getByRole('button', { name: /Segna “Pronto al servizio”/ }))
    expect(advanceComanda).toHaveBeenCalledWith('ord1', 'c1', 'pronto')
  })

  it('il − scala la comanda modificabile con sync in background (debounce)', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: 'Riduci Mojito' }))
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalledTimes(1), { timeout: 2000 })
    const [, comandaId, payload] = bartenderUpdateComanda.mock.calls[0]
    expect(comandaId).toBe('c1')
    expect(payload.items[0]).toMatchObject({ drink_id: 'mojito', qty: 1 })
  })

  it('comanda servita: il − è disabilitato (quantità bloccate), il + resta', () => {
    mount(
      baseOrder({
        workflow_status: 'ritirato',
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'ritirato',
            status_times: {},
            items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
          },
        ],
      })
    )
    expect(screen.getByRole('button', { name: 'Riduci Mojito' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Aumenta Mojito' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Segna/ })).not.toBeInTheDocument()
  })
})

describe('modale comande: consultazione, avanzamento e stampa', () => {
  it('le comande si aprono a parte e ognuna si stampa singolarmente', async () => {
    const user = userEvent.setup()
    const order = baseOrder({
      comande: [
        {
          id: 'c1', seq: 1, status: 'ritirato', status_times: {},
          items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
        },
        {
          id: 'c2', seq: 2, status: 'ricevuto', status_times: {},
          items: [{ drink_id: 'gin', name: 'Gin Tonic', unit_price: 8, qty: 1 }],
        },
      ],
    })
    mount(order)
    // le comande NON sono in vista finché non apro la modale
    expect(screen.queryByText(/COMANDA 1/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Comande \(2\)/ }))
    expect(screen.getByText(/COMANDA 1/)).toBeInTheDocument()
    expect(screen.getByText(/COMANDA 2/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stampa comanda 2' }))
    expect(printComanda).toHaveBeenCalledTimes(1)
    const [printedOrder, printedComanda] = printComanda.mock.calls[0]
    expect(printedOrder.id).toBe('ord1')
    expect(printedComanda.id).toBe('c2')
  })
})

describe('modifiche ottimistiche (UX istantanea)', () => {
  it('aggiunta ISTANTANEA: parte in background senza attendere il server', async () => {
    const user = userEvent.setup()
    bartenderUpdateComanda.mockImplementationOnce(() => new Promise(() => {})) // server lento
    mount(baseOrder())
    await user.click(screen.getAllByText('Gin Tonic')[0])
    // parte da sola (ottimistico), senza aspettare la risoluzione del server
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    expect(bartenderUpdateComanda.mock.calls.at(-1)[0]).toBe('ord1')
  })

  it('avanzamento ISTANTANEO: lo stato cambia subito, il server segue', async () => {
    const user = userEvent.setup()
    advanceComanda.mockImplementationOnce(() => new Promise(() => {})) // in volo
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Stato servizio/ }))
    await user.click(screen.getByRole('button', { name: /Segna “Pronto al servizio”/ }))
    // lo stato passa subito a "Pronto al servizio" senza attendere la transazione
    expect(screen.getAllByText(/Pronto al servizio/).length).toBeGreaterThan(0)
    expect(
      screen.queryByRole('button', { name: /Segna “Pronto al servizio”/ })
    ).not.toBeInTheDocument()
  })

  it('tap rapidi sulla griglia: le aggiunte confluiscono nella comanda in prep., senza tasto Conferma', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    const tile = () => screen.getAllByText('Mojito')[0] // la tile della griglia
    await user.click(tile())
    await user.click(tile())
    await user.click(tile())
    // si confermano da sole nella comanda in preparazione (senza cliccare Conferma)
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
    expect(addComanda).not.toHaveBeenCalled()
    const payload = bartenderUpdateComanda.mock.calls.at(-1)[2]
    expect(payload.items.some((i) => i.drink_id === 'mojito')).toBe(true)
  })
})

describe('schermata Pagamento', () => {
  it('"Pagamento" apre la schermata POS con dovuto e avviso; Riscuotere incassa tutto', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Pagamento/ }))
    // schermata: articoli a sinistra, importo al centro, avviso (c1 in prep.)
    expect(screen.getByRole('dialog', { name: 'Pagamento' })).toBeInTheDocument()
    expect(screen.getByTestId('pay-amount')).toHaveTextContent('14,00')
    expect(screen.getByText(/[Cc]omande non ancora servite/)).toBeInTheDocument()
    expect(registerPayment).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    expect(registerPayment).toHaveBeenCalledWith('ord1', {
      amount: 14,
      method: 'banco',
      items: null,
      autoServe: false,
    })
  })

  it('con tutto servito la schermata non mostra avvisi', async () => {
    const user = userEvent.setup()
    mount(
      baseOrder({
        workflow_status: 'ritirato',
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'ritirato',
            status_times: {},
            items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
          },
        ],
      })
    )
    await user.click(screen.getByRole('button', { name: /Pagamento/ }))
    expect(screen.queryByText(/[Cc]omande non ancora servite/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
    expect(registerPayment).toHaveBeenCalledWith('ord1', {
      amount: 14,
      method: 'banco',
      items: null,
      autoServe: false,
    })
  })

  it('lettore SumUp: metodo visibile solo se configurato, Riscuotere avvia readerCheckout', async () => {
    const user = userEvent.setup()
    mockSettings.payments_reader_enabled = true
    mockSettings.sumup_reader_id = 'reader1'
    try {
      mount(baseOrder())
      await user.click(screen.getByRole('button', { name: /Pagamento/ }))
      await user.click(screen.getByRole('button', { name: /SumUp/ }))
      await user.click(screen.getByRole('button', { name: /Riscuotere/ }))
      expect(readerCheckout).toHaveBeenCalledWith('ord1', { amount: 14, items: null })
      expect(registerPayment).not.toHaveBeenCalled()
    } finally {
      mockSettings.payments_reader_enabled = false
      mockSettings.sumup_reader_id = null
    }
  })

  it('lettore NON configurato: il metodo SumUp è in lista ma spento', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Pagamento/ }))
    // Spento a vedersi, ma toccabile: al tocco dice dove si configura.
    expect(screen.getByRole('button', { name: /SumUp/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('conto chiuso (pagato): griglia e modifiche disabilitate', () => {
    mount(
      baseOrder({
        status: 'pagato',
        workflow_status: 'pagato',
        payment_status: 'pagato',
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'ritirato',
            status_times: {},
            items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
          },
        ],
      })
    )
    // I tasti azione ci sono SEMPRE, ma su un conto chiuso non fanno più
    // quello che facevano: «Annulla ordine» è spento, e al posto di
    // «Pagamento» — che lì era spento a non fare niente — c'è «Rimetti in
    // corso», che è l'unica cosa sensata da fare su un conto chiuso.
    expect(screen.queryByRole('button', { name: /Pagamento/ })).toBeNull()
    expect(azioni().getByRole('button', { name: /Riapri conto/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Annulla ordine/ })).toBeDisabled()
  })
})

describe('ricerca prodotti', () => {
  it('digitando nella barra la griglia filtra su tutto il catalogo', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    expect(screen.getByText('Gin Tonic')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Cerca prodotto'), 'moj')
    expect(screen.queryByText('Gin Tonic')).not.toBeInTheDocument()
    // Mojito resta sia in griglia sia nella riga dell'ordine
    expect(screen.getAllByText('Mojito').length).toBeGreaterThan(0)
  })
})

// IL NOME DEL CONTO NON SI PERDE.
// Segnalato dal locale: "a volte metto il nome e non viene salvato". Il
// salvataggio stava solo sul tasto in fondo al popup: chiudendo con la ✕,
// toccando fuori dal riquadro o premendo Invio — che chiude la tastiera e
// sembra confermare — quello che si era appena scritto spariva in silenzio.
describe('dati conto: il nome si salva comunque si chiuda', () => {
  // Il conto di prova un nome ce l'ha già: si svuota il campo, altrimenti
  // quello nuovo si accoda al vecchio.
  const apriPopup = async (user) => {
    await user.click(screen.getByRole('button', { name: /Dati conto/ }))
    const campo = screen.getByLabelText('Nome')
    await user.clear(campo)
    return campo
  }

  it('col tasto Salva', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.type(await apriPopup(user), 'Marco')
    await user.click(screen.getByRole('button', { name: /Salva dati conto/ }))
    expect(updateOrderInfo).toHaveBeenCalledWith(
      'ord1',
      expect.objectContaining({ customer_name: 'Marco' })
    )
  })

  it('chiudendo con la ✕', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.type(await apriPopup(user), 'Marco')
    await user.click(screen.getByRole('button', { name: '✕' }))
    expect(updateOrderInfo).toHaveBeenCalledWith(
      'ord1',
      expect.objectContaining({ customer_name: 'Marco' })
    )
  })

  it('premendo Invio', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    const campo = await apriPopup(user)
    await user.type(campo, 'Marco{Enter}')
    expect(updateOrderInfo).toHaveBeenCalledWith(
      'ord1',
      expect.objectContaining({ customer_name: 'Marco' })
    )
  })

  it('senza modifiche non scrive niente', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Dati conto/ }))
    await user.click(screen.getByRole('button', { name: '✕' }))
    expect(updateOrderInfo).not.toHaveBeenCalled()
  })
})

// I TASTI NON BALLANO.
// Segnalato dal locale: aggiungendo il primo drink il tasto "Associa a
// gruppo" spariva e al suo posto compariva "Comande" — il tasto che stavi per
// premere non era più dov'era. I tasti ci sono sempre: spenti quando l'azione
// non è possibile, mai rimossi.
describe('tasti sempre presenti, spenti se non servono', () => {
  it('il tasto Unisci/Separa c’è anche quando non c’è niente da fare', () => {
    mount(baseOrder({ comande: [{ id: 'c1', seq: 1, status: 'in_preparazione', items: [] }] }))
    // Tasto unico: spento, non sparito.
    expect(screen.getByRole('button', { name: /Separa|Unisci/ })).toBeDisabled()
  })

  it('e si accende quando l’azione diventa possibile', () => {
    mount(baseOrder()) // 2 Mojito su una riga → si possono separare
    expect(screen.getByRole('button', { name: /⑃ Separa/ })).toBeEnabled()
  })

  it('Comande c’è sempre: sul conto aperto è attivo', () => {
    mount(baseOrder())
    expect(screen.getByRole('button', { name: /Comande/ })).toBeEnabled()
  })
})

// CONTO SVUOTATO = CONTO ANNULLATO, sempre.
// Prima valeva solo per il conto creato in quella sessione: uscendo e
// rientrando (per esempio chiudendo il box del nome) il conto non era più
// "creato qui", e togliendo l'ultima riga restava aperto e vuoto in coda.
describe('conto rimasto senza righe', () => {
  it('si annulla da solo e si torna alla lista', async () => {
    const user = userEvent.setup()
    mount(
      baseOrder({
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'in_preparazione',
            status_times: {},
            items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 }],
          },
        ],
      })
    )
    // Tolgo l'unica riga rimasta.
    await user.click(screen.getByRole('button', { name: 'Riduci Mojito' }))
    await waitFor(() => expect(cancelOrder).toHaveBeenCalledWith('ord1', { by: 'bartender' }), {
      timeout: 3000,
    })
  })

  it('ma non se qualcosa è già stato incassato', async () => {
    const user = userEvent.setup()
    mount(
      baseOrder({
        payments: [{ id: 'p1', amount: 7, method: 'banco', at: '2026-07-11T22:00:00.000Z' }],
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'in_preparazione',
            status_times: {},
            items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 }],
          },
        ],
      })
    )
    const meno = screen.queryByRole('button', { name: 'Riduci Mojito' })
    if (meno && !meno.disabled) await user.click(meno)
    await new Promise((r) => setTimeout(r, 700))
    expect(cancelOrder).not.toHaveBeenCalled()
  })
})

// ── TELEFONO: le azioni stanno in un menu, non in pagina ──────────────
// Su uno schermo stretto i tasti secondari (unisci, gruppi, dati conto,
// annulla) occupavano più spazio delle righe ordinate. Ora c'è un tasto
// "⋯ Azioni" che apre un menu dal basso: il CSS nasconde i tasti in
// pagina sotto i 700px, ma quello che conta è che il menu ci sia e che
// chiami gli STESSI handler — niente seconda logica da tenere allineata.
// (Qui i tasti in pagina ci sono comunque: jsdom non applica il CSS, per
// questo le ricerche sono ristrette al menu.)
describe('menu azioni del telefono', () => {
  // Schermo da telefono: il tasto ⋯ esiste solo qui (useTelefono).
  beforeEach(() => {
    window.matchMedia = (query) => ({
      matches: query.includes('700px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
  })

  const apriMenu = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Azioni del conto' }))
    return within(screen.getByRole('dialog'))
  }

  it('nel menu c’è quello che si usa ogni tanto', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    const menu = await apriMenu(user)
    for (const voce of [
      /Comande \(1\)/,
      /Prodotto libero/,
      /Dati conto/,
      /Unisci le righe uguali/,
      /Separa le quantità/,
    ]) {
      expect(menu.getByRole('button', { name: voce })).toBeInTheDocument()
    }
  })

  it('quello che si usa sempre NON è nel menu: sta in fondo, su una riga', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    // In fondo al pannello, i tre gesti della serata.
    for (const nome of [/Invia$/, /Paga$/, /Annulla$/]) {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument()
    }
    // E non anche dentro il menu, che sarebbe un doppione.
    const menu = await apriMenu(user)
    expect(menu.queryByRole('button', { name: /Invia/ })).toBeNull()
    expect(menu.queryByRole('button', { name: /Paga/ })).toBeNull()
    expect(menu.queryByRole('button', { name: /Annulla/ })).toBeNull()
  })

  it('“Annulla” chiede conferma, non annulla di colpo', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.click(screen.getByRole('button', { name: /Annulla$/ }))
    await waitFor(() => expect(document.querySelector('.confirm-box')).toBeTruthy())
    expect(cancelOrder).not.toHaveBeenCalled()
  })

  it('scegliendo una voce il menu si chiude: mai due pannelli sovrapposti', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    const menu = await apriMenu(user)
    await user.click(menu.getByRole('button', { name: /Dati conto/ }))
    await waitFor(() =>
      expect(document.querySelector('.action-sheet')).toBeFalsy()
    )
  })

  it('su un ordine NUOVO le azioni che richiedono un conto aperto sono spente', () => {
    render(
      <MemoryRouter>
        <OrderPosDetail order={null} />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /Invia$/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Annulla$/ })).toBeDisabled()
  })
})

// ── Quanto c'è da incassare, scritto sul tasto ────────────────────────
// Prima la cifra compariva solo finché l'ordine non esisteva ancora:
// appena si creava da sé — un istante dopo il primo prodotto — spariva, e
// sembrava un difetto. Deve restare, e deve dire quanto manca DAVVERO:
// sconto e acconti già presi non si pagano due volte.
describe('totale sul tasto Pagamento', () => {
  const tastoPagamento = () =>
    screen.getAllByRole('button', { name: /Pagamento/ })[0]

  it('su un conto aperto mostra il totale da incassare', () => {
    mount(baseOrder()) // 2 Mojito × 7 €
    expect(tastoPagamento()).toHaveTextContent('14,00 €')
  })

  it('con un acconto già preso mostra solo quello che manca', () => {
    mount(
      baseOrder({
        payments: [{ id: 'p1', amount: 10, method: 'banco', at: '2026-07-11T22:00:00.000Z' }],
      })
    )
    expect(tastoPagamento()).toHaveTextContent('4,00 €')
  })

  it('con lo sconto la cifra è quella scontata', () => {
    mount(baseOrder({ discount_amount: 4 }))
    expect(tastoPagamento()).toHaveTextContent('10,00 €')
  })

  it('conto già saldato: nessuna cifra da mostrare', () => {
    mount(
      baseOrder({
        payments: [{ id: 'p1', amount: 14, method: 'banco', at: '2026-07-11T22:00:00.000Z' }],
      })
    )
    expect(tastoPagamento()).not.toHaveTextContent('€')
  })
})

// ── ITEM BATTUTI MENTRE L'ORDINE SI STA CREANDO ──────────────────────
// Difetto vero, visto al banco: si aggiunge un'acqua, un secondo dopo si
// aggiunge altro, e quando l'ordine finisce di crearsi resta solo
// l'acqua. La creazione dura qualche decimo di secondo; in quei decimi si
// continua a battere, e chi svuotava la bozza a creazione finita portava
// via anche le righe arrivate nel frattempo.
describe('creazione: niente si perde mentre l’ordine nasce', () => {
  it('gli item battuti durante la creazione finiscono nell’ordine', async () => {
    const user = userEvent.setup()
    // Creazione LENTA e controllata da qui: è la finestra in cui si continua
    // a battere.
    let creaLaConclude
    createOrder.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          creaLaConclude = () =>
            resolve({
              id: 'ord-nuovo',
              status: 'aperto',
              comande: [
                {
                  id: 'c1',
                  seq: 1,
                  status: 'in_preparazione',
                  status_times: {},
                  items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 }],
                },
              ],
              order_items: [
                { id: 'x', drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 },
              ],
              payments: [],
            })
        })
    )

    render(
      <MemoryRouter>
        <OrderPosDetail order={null} />
      </MemoryRouter>
    )

    // Primo item: fa partire la creazione (parte da sola dopo ~300ms).
    await user.click(screen.getAllByText('Mojito')[0])
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1), { timeout: 2000 })

    // Mentre l'ordine sta nascendo, se ne battono altri due.
    await user.click(screen.getAllByText('Gin Tonic')[0])
    await user.click(screen.getAllByText('Gin Tonic')[0])

    // Ora il server risponde.
    creaLaConclude()

    // I due Gin Tonic non devono sparire: restano a schermo e vengono
    // mandati al server come aggiunte.
    await waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled(), { timeout: 3000 })
    const items = bartenderUpdateComanda.mock.calls.at(-1)[2].items
    expect(items.filter((i) => i.drink_id === 'gin')).toHaveLength(2)
    expect(screen.getAllByText('Gin Tonic').length).toBeGreaterThan(0)
    expect(createOrder).toHaveBeenCalledTimes(1) // un ordine solo, non due
  })
})

// ── Dopo l'annullo si torna agli ordini ───────────────────────────────
// Un conto annullato non si lavora più: restarci davanti serve solo a
// chiedersi se l'annullo è andato a buon fine, e a rischiare di batterci
// sopra un altro drink.
describe('annullo dell’ordine', () => {
  it('annullando si torna alla coda', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/ordine/ord1']}>
        <Routes>
          <Route path="/ordine/:id" element={<OrderPosDetail order={baseOrder()} />} />
          <Route path="/bar" element={<div>CODA ORDINI</div>} />
        </Routes>
      </MemoryRouter>
    )
    await user.click(screen.getByRole('button', { name: /Annulla ordine/ }))
    const conferma = within(document.querySelector('.confirm-box'))
    await user.click(conferma.getByRole('button', { name: 'Annulla ordine' }))
    expect(cancelOrder).toHaveBeenCalledWith('ord1', { by: 'bartender' })
    expect(await screen.findByText('CODA ORDINI')).toBeInTheDocument()
  })
})

// ── La ricerca prodotti, dentro la schermata vera ─────────────────────
// Il picker da solo era già coperto (PosProductPicker.test.jsx), ma quello
// che al banco non funzionava era il COLLEGAMENTO: l'impostazione arriva
// dalle impostazioni del bar, passa da qui e finisce nella griglia. Se si
// stacca un anello, la ricerca torna a filtrare e nessun test se ne accorge.
describe('la ricerca prodotti segue l’impostazione del bar', () => {
  const card = (nome) =>
    [...document.querySelectorAll('[data-drink-id]')].find((e) => e.textContent.includes(nome))
  const cerca = () => screen.getByLabelText('Cerca prodotto')

  afterEach(() => {
    delete mockSettings.pos_search
  })

  it('«filtra»: cercando resta solo il prodotto che risponde', async () => {
    const user = userEvent.setup()
    mount(baseOrder())
    await user.type(cerca(), 'mojito')
    expect(card('Mojito')).toBeTruthy()
    expect(card('Gin Tonic')).toBeFalsy()
  })

  it('«accendi e porta lì»: la griglia resta intera e la card si accende', async () => {
    mockSettings.pos_search = 'evidenzia'
    const user = userEvent.setup()
    mount(baseOrder())
    await user.type(cerca(), 'mojito')
    // Niente sparisce da sotto le dita…
    expect(card('Gin Tonic')).toBeTruthy()
    // …e quella cercata è accesa.
    expect(card('Mojito')).toHaveClass('prodotto-acceso')
  })
})

// ── Pagamento battuto mentre l'ordine sta ancora nascendo ─────────────
// Segnalato dal banco: si battono due acque di corsa, si preme Pagamento,
// e un attimo dopo si è di nuovo sulla schermata dell'ordine — Pagamento va
// ripremuto. Dipende da quanto si è veloci: l'ordine nasce da solo al primo
// prodotto, e quando il server risponde il conto smette di essere "nuovo".
// La schermata di pagamento era appesa proprio a quel "nuovo": appena
// cambiava, spariva da sé, col cassiere davanti al cliente che paga.
describe('Pagamento premuto mentre l’ordine sta ancora nascendo', () => {
  it('la schermata di pagamento resta aperta quando la creazione va a buon fine', async () => {
    const user = userEvent.setup()
    let rispondiIlServer
    createOrder.mockImplementationOnce(
      () =>
        new Promise((res) => {
          rispondiIlServer = () =>
            res({
              id: 'ord-nuovo',
              daily_number: 9,
              status: 'aperto',
              payment_status: 'non_richiesto',
              total: 7,
              payments: [],
              discount_amount: 0,
              comande: [
                {
                  id: 'c1',
                  seq: 1,
                  status: 'in_preparazione',
                  items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 }],
                },
              ],
              order_items: [
                { id: 'x', drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 },
              ],
            })
        })
    )
    render(
      <MemoryRouter>
        <OrderPosDetail order={null} />
      </MemoryRouter>
    )
    await user.click(screen.getAllByText('Mojito')[0])
    // L'auto-creazione parte da sola dopo qualche decimo di secondo…
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1), { timeout: 2000 })
    // …e mentre è in volo si preme Pagamento.
    await user.click(screen.getByRole('button', { name: /Pagamento/ }))
    expect(await screen.findByRole('button', { name: /Riscuotere/ })).toBeInTheDocument()

    // Il server risponde: il conto esiste, non è più "nuovo".
    rispondiIlServer()
    // Il numero del conto arriva a schermo: siamo oltre il passaggio.
    // (Compare in due punti: la testata del conto e quella del pagamento.)
    expect((await screen.findAllByText(/#9/)).length).toBeGreaterThan(0)
    // E il pagamento è ancora lì, dove il cassiere l'ha lasciato.
    expect(screen.getByRole('button', { name: /Riscuotere/ })).toBeInTheDocument()
  })
})

// ── Ripristino di un conto chiuso o annullato ────────────────────────
// Capita: si chiude un conto sul tavolo sbagliato, si annulla per un
// malinteso, il cliente torna. Finora l'unica strada era ribatterlo da capo
// e il conto vero restava lì a sporcare la serata.
describe('rimettere in corso un conto', () => {
  const chiuso = () =>
    baseOrder({
      status: 'pagato',
      workflow_status: 'pagato',
      payment_status: 'pagato',
      created_at: '2026-08-12T20:00:00.000Z',
      tempi_conto: { pagato: '2026-08-12T21:30:00.000Z' },
      payments: [{ amount: 14, method: 'banco', at: '2026-08-12T21:30:00.000Z' }],
    })

  it('la storia del conto racconta apertura e chiusura', async () => {
    const user = userEvent.setup()
    mount(chiuso())
    await user.click(screen.getByRole('button', { name: /Storia/ }))
    const box = within(screen.getByRole('dialog', { name: 'Storia del conto' }))
    expect(box.getByText('Conto aperto')).toBeInTheDocument()
    expect(box.getByText('Conto chiuso')).toBeInTheDocument()
  })

  it('si chiede una motivazione (facoltativa) e si conferma', async () => {
    const user = userEvent.setup()
    mount(chiuso())
    await user.click(azioni().getByRole('button', { name: /Riapri conto/ }))
    const box = within(screen.getByRole('dialog', { name: 'Ripristina il conto' }))
    await user.type(box.getByLabelText(/Perché lo riapri/), 'tavolo sbagliato')
    await user.click(box.getByRole('button', { name: /Rimetti in corso/ }))
    expect(restoreOrder).toHaveBeenCalledWith('ord1', expect.objectContaining({ motivo: 'tavolo sbagliato' }))
  })

  it('senza motivazione si ripristina lo stesso: al banco i secondi non ci sono', async () => {
    const user = userEvent.setup()
    mount(chiuso())
    await user.click(azioni().getByRole('button', { name: /Riapri conto/ }))
    const box = within(screen.getByRole('dialog', { name: 'Ripristina il conto' }))
    await user.click(box.getByRole('button', { name: /Rimetti in corso/ }))
    expect(restoreOrder).toHaveBeenCalledWith('ord1', expect.objectContaining({ motivo: null }))
  })

  it('su un conto già in corso il tasto resta quello del pagamento', () => {
    mount(baseOrder())
    expect(azioni().queryByRole('button', { name: /Riapri conto/ })).toBeNull()
    expect(azioni().getByRole('button', { name: /Pagamento/ })).toBeInTheDocument()
  })

  // Un conto riaperto, guardato mezz'ora dopo, è identico a uno normale: se
  // dentro c'è un incasso diventa un mistero. Il motivo si legge nel conto.
  it('nel conto riaperto si legge perché lo è', () => {
    mount(
      baseOrder({
        riaperture: [
          { at: '2026-08-12T22:00:00.000Z', motivo: 'chiuso sul tavolo sbagliato', chi: 'Anna' },
        ],
      })
    )
    expect(screen.getByText(/Conto riaperto/)).toBeInTheDocument()
    expect(screen.getByText(/chiuso sul tavolo sbagliato/)).toBeInTheDocument()
    expect(screen.getByText(/da Anna/)).toBeInTheDocument()
  })
})

// ── UN CONTO RIAPERTO SI MODIFICA TUTTO ──────────────────────────────
// Riaprire serve esattamente a rimettere a posto quello che c'è dentro: un
// giro battuto sul tavolo sbagliato, una birra di troppo. Se le righe di
// prima restano bloccate — perché la comanda risultava servita — il conto
// riaperto non serve a niente.
describe('conto riaperto: le righe di prima si toccano', () => {
  const servito = (extra = {}) =>
    baseOrder({
      total: 14,
      comande: [
        {
          id: 'c1',
          seq: 1,
          status: 'ritirato',
          status_times: {},
          items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
        },
      ],
      order_items: [{ id: 'i1', drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 2 }],
      ...extra,
    })

  const meno = () => screen.getAllByRole('button', { name: /Riduci Mojito/ })

  it('senza riapertura una comanda servita resta bloccata', () => {
    mount(servito())
    expect(meno().every((b) => b.disabled)).toBe(true)
  })

  it('dopo una riapertura la riga si può scalare', async () => {
    const user = userEvent.setup()
    mount(servito({ riaperture: [{ at: '2026-08-15T21:00:00.000Z', motivo: 'tavolo sbagliato' }] }))
    const tasti = meno().filter((b) => !b.disabled)
    expect(tasti.length).toBeGreaterThan(0)
    await user.click(tasti[0])
    // La modifica parte verso la comanda: le scorte si riallineano con la
    // differenza, come per ogni altra modifica.
    await vi.waitFor(() => expect(bartenderUpdateComanda).toHaveBeenCalled())
  })
})

// ── Il prezzo della riga, non quello di uno ──────────────────────────
// Difetto visto in produzione (BUG-004): con 3× Tennent's la riga mostrava
// «4,00 €», il prezzo unitario. Il subtotale non c'era proprio, e per sapere
// quanto faceva quella riga bisognava moltiplicare a mente col cliente
// davanti. Poi il calcolo esplicito in riga («3 × 7,00») si è rivelato
// rumore accanto a ogni nome: ora la riga dice solo QUANTO FA, e il
// calcolo si accende dal menù ⋯, comparendo sotto l'item come le note
// (REQ-POS-014).
describe('subtotale di riga', () => {
  const ordineTriplo = () =>
    baseOrder({
      total: 21,
      comande: [
        {
          id: 'c1',
          seq: 1,
          status: 'in_preparazione',
          status_times: {},
          items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 3 }],
        },
      ],
      order_items: [
        { id: 'ord1-0', drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 3 },
      ],
    })

  it('la riga dice quanto fa; il calcolo di suo non appare', () => {
    mount(ordineTriplo())
    // Quanto fa la riga…
    expect(screen.getAllByText('21,00 €').length).toBeGreaterThan(0)
    // …senza il calcolo esplicito accanto al nome.
    expect(screen.queryByText(/3 × 7,00/)).toBeNull()
  })

  it('col calcolo acceso (scelta ricordata sul dispositivo) appare sotto la riga', () => {
    localStorage.setItem('tana:pos:calcoli', '1')
    mount(ordineTriplo())
    expect(screen.getByText(/↳ 3 × 7,00/)).toBeInTheDocument()
    expect(screen.getAllByText('21,00 €').length).toBeGreaterThan(0)
    localStorage.removeItem('tana:pos:calcoli')
  })

  it('i supplementi attivi si vedono uno per riga, sotto il Subtotale', () => {
    // Prima una riga cumulativa («Coperto/servizio/mancia · 5,50 €») non
    // diceva né cosa fosse attivo né quanto pesasse ognuno (REQ-POS-016).
    mount(
      baseOrder({
        total: 18.5,
        coperto_amount: 2,
        tip_amount: 2.5,
      })
    )
    // Il conto nudo…
    expect(screen.getByText('Subtotale', { exact: false })).toBeInTheDocument()
    // …le voci attive, ognuna con il suo importo…
    expect(screen.getByText('Coperto')).toBeInTheDocument()
    expect(screen.getByText('Mancia')).toBeInTheDocument()
    // …e quella spenta non compare.
    expect(screen.queryByText('Servizio')).toBeNull()
  })

  it('con un pezzo solo il subtotale c’è comunque, il calcolo mai', () => {
    localStorage.setItem('tana:pos:calcoli', '1')
    mount(
      baseOrder({
        total: 7,
        comande: [
          {
            id: 'c1',
            seq: 1,
            status: 'in_preparazione',
            status_times: {},
            items: [{ drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 }],
          },
        ],
        order_items: [{ id: 'ord1-0', drink_id: 'mojito', name: 'Mojito', unit_price: 7, qty: 1 }],
      })
    )
    // Senza il calcolo in riga, la riga singola senza subtotale resterebbe
    // SENZA PREZZO: il subtotale ora c'è sempre.
    expect(document.querySelector('.posd-riga-tot')).not.toBeNull()
    expect(screen.queryByText(/↳ 1 × 7,00/)).toBeNull()
    localStorage.removeItem('tana:pos:calcoli')
  })
})
