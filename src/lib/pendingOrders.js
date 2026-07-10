// Ordini in invio dal POS (ottimistici). Lo store è a livello di modulo così
// sopravvive al cambio pagina: il POS lancia l'invio e naviga subito alla
// griglia, dove l'ordine appare "in caricamento" (grigio) finché la creazione
// (e l'eventuale stampa comanda) non è completata. Poi il placeholder viene
// rimosso e compare l'ordine reale (colorato) dalla sottoscrizione Firestore.

import { createOrder } from './api.js'
import { printComanda, loadPrinterSettings } from './printer.js'
import { ORDER_STATUSES } from './orderStatus.js'
import { rememberOrderId } from './cart.js'

let state = { pending: [], banners: [] }
const subs = new Set()
const emit = () => subs.forEach((fn) => fn(state))

export function subscribePending(fn) {
  subs.add(fn)
  fn(state)
  return () => subs.delete(fn)
}

let seq = 0
const setPending = (next) => {
  state = { ...state, pending: next }
  emit()
}
const patch = (tempId, p) =>
  setPending(state.pending.map((e) => (e.tempId === tempId ? { ...e, ...p } : e)))
const remove = (tempId) => setPending(state.pending.filter((e) => e.tempId !== tempId))

export function dismissPending(tempId) {
  remove(tempId)
}

export function dismissBanner(id) {
  state = { ...state, banners: state.banners.filter((b) => b.id !== id) }
  emit()
}
const addBanner = (msg) => {
  state = { ...state, banners: [...state.banners, { id: `b${++seq}`, msg }] }
  emit()
}

// Invia un ordine dal POS in background. Ritorna subito: il chiamante può
// navigare alla griglia mentre la creazione/stampa procede.
export function submitPosOrder({ serata_id, table_label, note, items, placed_by, customer_name = null, printNow = false }) {
  const tempId = `tmp${++seq}`
  const order = {
    id: tempId,
    daily_number: null,
    serata_id,
    table_label: table_label || null,
    note: note || null,
    status: 'aperto',
    workflow_status: ORDER_STATUSES.IN_PREPARAZIONE,
    payment_status: 'non_richiesto',
    customer_name: customer_name || null,
    placed_by: placed_by || null,
    total: items.reduce((s, i) => s + i.qty * Number(i.price || 0), 0),
    order_items: items.map((i) => ({
      id: i.drink_id,
      name: i.name,
      qty: i.qty,
      unit_price: i.price,
    })),
  }
  setPending([...state.pending, { tempId, state: 'sending', realId: null, order }])

  ;(async () => {
    let created
    try {
      created = await createOrder({
        serata_id,
        table_label,
        note,
        items,
        placed_by,
        customer_name: customer_name || null,
        status: ORDER_STATUSES.IN_PREPARAZIONE,
      })
    } catch (e) {
      patch(tempId, { state: 'error', error: e.message })
      return
    }
    rememberOrderId(created.id)
    // Collega l'id reale: la griglia nasconde l'ordine reale finché il
    // placeholder è attivo, così resta grigio fino a fine stampa.
    patch(tempId, { realId: created.id, order: { ...order, daily_number: created.daily_number } })
    try {
      const ps = loadPrinterSettings()
      if (ps.autoPrintComanda || printNow) await printComanda(created, created.comande?.[0] ?? null)
    } catch (e) {
      addBanner(`Comanda #${created.daily_number ?? ''} non stampata: ${e.message}`)
    } finally {
      remove(tempId)
    }
  })()

  return tempId
}
