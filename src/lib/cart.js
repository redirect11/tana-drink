import { useCallback, useEffect, useState } from 'react'

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

// Carrello persistito in localStorage.
export function useCart() {
  const [items, setItems] = useState(() => read(CART_KEY, []))

  useEffect(() => {
    write(CART_KEY, items)
  }, [items])

  const add = useCallback((drink) => {
    setItems((prev) => {
      const found = prev.find((i) => i.drink_id === drink.id)
      if (found) {
        return prev.map((i) =>
          i.drink_id === drink.id ? { ...i, qty: i.qty + 1 } : i
        )
      }
      return [
        ...prev,
        { drink_id: drink.id, name: drink.name, price: drink.price, qty: 1 },
      ]
    })
  }, [])

  const setQty = useCallback((drinkId, qty) => {
    setItems((prev) =>
      prev
        .map((i) => (i.drink_id === drinkId ? { ...i, qty } : i))
        .filter((i) => i.qty > 0)
    )
  }, [])

  const clear = useCallback(() => setItems([]), [])

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
