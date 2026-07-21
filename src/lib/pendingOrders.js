// Ordini in invio dal POS (ottimistici). Lo store è a livello di modulo così
// sopravvive al cambio pagina: il POS lancia l'invio e naviga subito alla
// griglia, dove l'ordine appare "in caricamento" (grigio) finché la creazione
// (e l'eventuale stampa comanda) non è completata. Poi il placeholder viene
// rimosso e compare l'ordine reale (colorato) dalla sottoscrizione Firestore.

import { createOrder } from './api.js'
import { printComanda } from './printer.js'
import { ORDER_STATUSES } from './orderStatus.js'
import { rememberOrderId } from './cart.js'
import { toastSync, toastSuccess, toastError } from './toast.js'

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
export function submitPosOrder({ table_label, note, items, placed_by, customer_name = null, printNow = false }) {
  const tempId = `tmp${++seq}`
  const order = {
    id: tempId,
    daily_number: null,
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
  // Sync poco invasiva: spinner in basso finché l'ordine non è sul server.
  const toastId = toastSync(`Sincronizzo ordine${customer_name ? ` "${customer_name}"` : ''}…`)

  ;(async () => {
    let created
    try {
      created = await createOrder({
        table_label,
        note,
        items,
        placed_by,
        customer_name: customer_name || null,
        status: ORDER_STATUSES.IN_PREPARAZIONE,
        // L'ordine reale porta l'id del placeholder: la griglia lo tiene
        // nascosto finché il placeholder è attivo (scambio senza doppioni).
        client_temp_id: tempId,
      })
    } catch (e) {
      patch(tempId, { state: 'error', error: e.message })
      toastError(`Ordine non sincronizzato: ${e.message}`, { id: toastId })
      return
    }
    rememberOrderId(created.id)
    // Collega l'id reale. Il placeholder NON si toglie qui: lo scambia la
    // griglia quando l'ordine reale arriva dalla sottoscrizione (mai due
    // card, mai buchi). Il timer è solo la rete di sicurezza se nessuna
    // griglia è montata a fare lo scambio.
    patch(tempId, { state: 'done', realId: created.id, order: { ...order, daily_number: created.daily_number } })
    toastSuccess(`Ordine #${created.daily_number ?? ''} creato`, { id: toastId })
    setTimeout(() => remove(tempId), 15000)
    try {
      // La stampa della comanda è un'azione a parte (esplicita): qui solo
      // se richiesta al momento dell'invio.
      if (printNow) await printComanda(created, created.comande?.[0] ?? null)
    } catch (e) {
      addBanner(`Comanda #${created.daily_number ?? ''} non stampata: ${e.message}`)
      toastError(`Comanda non stampata: ${e.message}`)
    }
  })()

  return tempId
}
