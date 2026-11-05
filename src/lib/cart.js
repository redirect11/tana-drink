import { useCallback, useRef, useState } from 'react'

const CART_KEY = 'drink_cart_v1'
const ORDERS_KEY = 'drink_my_orders_v1'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage non disponibile: ignora */
  }
}

// LA CHIAVE DI UNA RIGA è quello che arriva al banco: il drink del
// gestionale e, se il cliente l'ha letto con un altro nome, quel nome
// (REQ-MENU-025). «Gin Fizz» e «Tom Collins» su «SOUR 7» restano due righe;
// lo stesso Negroni preso da «Suggeriti dallo staff» e dai «Grandi
// classici» è una riga sola. Era la voce del menù dei clienti, e lo stesso
// drink da due sezioni faceva due righe «Negroni × 1».
export const chiaveRiga = (i) => (i.nome_carta ? `${i.drink_id}·${i.nome_carta}` : i.drink_id)

// Il nome che il cliente legge nel carrello: quello che ha scelto.
export const nomeLetto = (i) => i.nome_carta || i.name

// UNA RIGA NUOVA. L'ordine porta il drink del GESTIONALE, col suo nome:
// è quello che il banco conosce, che scala il magazzino e che finisce
// nelle statistiche. Se il menù dei clienti lo chiama in un altro modo (il
// nome per il cliente della scheda, o quello di una voce del menù),
// quel nome va nella nota della riga, che al banco dice cosa preparare
// («SOUR 7 — Gin Fizz»); al cliente, nel carrello, resta il nome che ha
// scelto.
export function rigaDelCarrello(drink) {
  const riga = {
    drink_id: drink.drink_id ?? drink.id,
    name: drink.nome_gestionale ?? drink.name,
    price: drink.price,
    qty: 1,
    sumup_product_id: drink.sumup_product_id ?? null,
  }
  const diverso = (drink.name || '').trim().toLowerCase() !== (riga.name || '').trim().toLowerCase()
  return diverso ? { ...riga, nome_carta: drink.name, note: drink.name } : riga
}

// Carrello persistito in localStorage. La scrittura avviene SUBITO,
// prima dell'aggiornamento di stato: se affidata a un useEffect (o
// all'updater di setState), navigando subito dopo clear() — invio
// ordine — React smonta il componente prima che giri e il vecchio
// carrello "risorgerebbe" al ritorno sul menù.
export function useCart() {
  const [items, setItems] = useState(() => read(CART_KEY, []))
  const itemsRef = useRef(items)
  itemsRef.current = items

  const update = useCallback((updater) => {
    const next = updater(itemsRef.current)
    itemsRef.current = next
    write(CART_KEY, next)
    setItems(next)
  }, [])

  const add = useCallback((drink) => {
    const nuova = rigaDelCarrello(drink)
    const chiave = chiaveRiga(nuova)
    update((prev) => {
      const found = prev.find((i) => chiaveRiga(i) === chiave)
      if (found) {
        return prev.map((i) =>
          chiaveRiga(i) === chiave ? { ...i, qty: i.qty + 1 } : i
        )
      }
      return [...prev, nuova]
    })
  }, [update])

  // Drink custom composto al volo dal bartender: riga a sé (id univoco
  // locale), con la ricetta incorporata per lo scarico inventario.
  const addCustom = useCallback(({ name, price, recipe_items = [] }) => {
    update((prev) => [
      ...prev,
      {
        drink_id: `custom-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        custom: true,
        name,
        price,
        qty: 1,
        sumup_product_id: null,
        recipe_items,
      },
    ])
  }, [update])

  const setQty = useCallback((chiave, qty) => {
    update((prev) =>
      prev
        .map((i) => (chiaveRiga(i) === chiave ? { ...i, qty } : i))
        .filter((i) => i.qty > 0)
    )
  }, [update])

  const clear = useCallback(() => update(() => []), [update])

  const count = items.reduce((s, i) => s + i.qty, 0)
  const total = items.reduce((s, i) => s + i.qty * Number(i.price || 0), 0)

  return { items, add, addCustom, setQty, clear, count, total }
}

// Memoria locale degli ID degli ordini effettuati da questo dispositivo,
// così il cliente può ritrovare i propri ordini.
export function getMyOrderIds() {
  return read(ORDERS_KEY, [])
}

export function rememberOrderId(id) {
  const ids = read(ORDERS_KEY, [])
  if (!ids.includes(id)) write(ORDERS_KEY, [id, ...ids].slice(0, 20))
}
