import { RendicontoSerata } from 'karaoke-drink'

const niente = () => {}

// Magazzino: la bottiglia da 1 L a 30 € fa 0,30 €/cl, la tonica 0,50 a pezzo.
// Sono le stesse cifre dei test di src/lib/rendiconto.js, così i conti tornano
// anche a mente.
const itemsById = {
  gin: { id: 'gin', name: 'Gin', unit: 'ml', package_size: 1000, cost: 30, vat: 0 },
  tonica: { id: 'tonica', name: 'Tonica', unit: 'pz', cost: 0.5, vat: 0 },
  vermouth: { id: 'vermouth', name: 'Vermouth rosso', unit: 'ml', package_size: 1000, cost: 12, vat: 0 },
  bitter: { id: 'bitter', name: 'Bitter', unit: 'ml', package_size: 1000, cost: 18, vat: 0 },
}

const drinksById = {
  gt: {
    id: 'gt',
    name: 'Gin Tonic',
    category: 'COCKTAIL',
    recipe_items: [
      { inventory_item_id: 'gin', name: 'Gin', qty: 5, unit: 'cl' },
      { inventory_item_id: 'tonica', name: 'Tonica', qty: 1, unit: 'pz' },
    ],
  },
  neg: {
    id: 'neg',
    name: 'Negroni',
    category: 'COCKTAIL',
    recipe_items: [
      { inventory_item_id: 'gin', name: 'Gin', qty: 3, unit: 'cl' },
      { inventory_item_id: 'vermouth', name: 'Vermouth rosso', qty: 3, unit: 'cl' },
      { inventory_item_id: 'bitter', name: 'Bitter', qty: 3, unit: 'cl' },
    ],
  },
  // Senza ricetta: il costo non è zero, è IGNOTO — e il rendiconto lo marca.
  birra: { id: 'birra', name: 'Ceres', category: 'BIRRE' },
}

const orders = [
  {
    id: 'o1',
    daily_number: 7,
    customer_name: 'Marta',
    status: 'pagato',
    payment_status: 'pagato',
    paid_at: '2026-08-14T21:40:00.000Z',
    payments: [{ method: 'carta', amount: 16, at: '2026-08-14T21:40:00.000Z' }],
    total: 16,
    discount_amount: 0,
    order_items: [
      { drink_id: 'gt', name: 'Gin Tonic', qty: 2, unit_price: 6 },
      { drink_id: 'birra', name: 'Ceres', qty: 1, unit_price: 4 },
    ],
  },
  {
    id: 'o2',
    daily_number: 8,
    customer_name: 'Tavolo 4',
    status: 'pagato',
    payment_status: 'pagato',
    paid_at: '2026-08-14T22:05:00.000Z',
    payments: [{ method: 'contanti', amount: 22, at: '2026-08-14T22:05:00.000Z' }],
    total: 24,
    discount_amount: 2,
    order_items: [
      { drink_id: 'neg', name: 'Negroni', qty: 3, unit_price: 8 },
    ],
  },
  {
    id: 'o3',
    daily_number: 9,
    customer_name: 'Peppe',
    status: 'aperto',
    payment_status: 'da_incassare',
    created_at: '2026-08-14T22:30:00.000Z',
    total: 12,
    discount_amount: 0,
    order_items: [{ drink_id: 'gt', name: 'Gin Tonic', qty: 2, unit_price: 6 }],
  },
  {
    id: 'o4',
    daily_number: 10,
    customer_name: 'Offerto dalla casa',
    status: 'pagato',
    payment_status: 'pagato',
    paid_at: '2026-08-14T23:10:00.000Z',
    payments: [],
    total: 8,
    discount_amount: 8,
    order_items: [{ drink_id: 'neg', name: 'Negroni', qty: 1, unit_price: 8 }],
  },
]

// La serata chiusa: quattro conti, uno scontato, uno ancora da incassare e uno
// offerto — i tre casi che in tabella si leggevano tutti come un trattino.
export const SerataChiusa = () => (
  <RendicontoSerata
    session={{ opened_at: '2026-08-14T19:30:00.000Z', closed_at: '2026-08-15T02:10:00.000Z' }}
    orders={orders}
    drinksById={drinksById}
    itemsById={itemsById}
    recap={{ byMethod: { contanti: 22, carta: 16 } }}
    onClose={niente}
  />
)

// Cassa ancora aperta: l'intestazione lo dice invece di mostrare un'ora finta.
export const CassaInCorso = () => (
  <RendicontoSerata
    session={{ opened_at: '2026-08-14T19:30:00.000Z', closed_at: null }}
    orders={orders.slice(0, 2)}
    drinksById={drinksById}
    itemsById={itemsById}
    recap={{ byMethod: { carta: 16 } }}
    onClose={niente}
  />
)
