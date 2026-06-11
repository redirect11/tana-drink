import { useCallback, useRef, useState } from 'react'

const CART_KEY = 'tana_cart_v1'
const ORDERS_KEY = 'tana_my_orders_v1'

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
    update((prev) => {
      const found = prev.find((i) => i.drink_id === drink.id)
      if (found) {
        return prev.map((i) =>
          i.drink_id === drink.id ? { ...i, qty: i.qty + 1 } : i
        )
      }
      return [
        ...prev,
        {
          drink_id: drink.id,
          name: drink.name,
          price: drink.price,
          qty: 1,
          sumup_product_id: drink.sumup_product_id ?? null,
        },
      ]
    })
  }, [update])

  const setQty = useCallback((drinkId, qty) => {
    update((prev) =>
      prev
        .map((i) => (i.drink_id === drinkId ? { ...i, qty } : i))
        .filter((i) => i.qty > 0)
    )
  }, [update])

  const clear = useCallback(() => update(() => []), [update])

  const count = items.reduce((s, i) => s + i.qty, 0)
  const total = items.reduce((s, i) => s + i.qty * Number(i.price || 0), 0)

  return { items, add, setQty, clear, count, total }
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
