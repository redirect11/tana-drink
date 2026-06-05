import { supabase } from './supabaseClient.js'
import { ORDER_STATUSES } from './orderStatus.js'

// --- DRINKS (menù / ricette) ---

export async function fetchDrinks({ onlyAvailable = false } = {}) {
  let query = supabase
    .from('drinks')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })
  if (onlyAvailable) query = query.eq('available', true)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createDrink(drink) {
  const { data, error } = await supabase
    .from('drinks')
    .insert(drink)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDrink(id, patch) {
  const { data, error } = await supabase
    .from('drinks')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDrink(id) {
  const { error } = await supabase.from('drinks').delete().eq('id', id)
  if (error) throw error
}

// --- ORDERS ---

// Crea un ordine con i relativi item. Il numero progressivo giornaliero
// viene assegnato lato database da una funzione/trigger (vedi schema.sql).
export async function createOrder({ table_label, note, items }) {
  const total = items.reduce((s, i) => s + i.qty * Number(i.price || 0), 0)
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      table_label: table_label || null,
      note: note || null,
      status: ORDER_STATUSES.RICEVUTO,
      total,
    })
    .select()
    .single()
  if (error) throw error

  const rows = items.map((i) => ({
    order_id: order.id,
    drink_id: i.drink_id,
    name: i.name,
    unit_price: i.price,
    qty: i.qty,
  }))
  const { error: itemsError } = await supabase.from('order_items').insert(rows)
  if (itemsError) throw itemsError

  return order
}

export async function fetchOrder(id) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function fetchOrdersByIds(ids) {
  if (!ids || ids.length === 0) return []
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .in('id', ids)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Coda del bartender: ordini attivi (non ancora ritirati) del giorno.
export async function fetchActiveOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .neq('status', ORDER_STATUSES.RITIRATO)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function updateOrderStatus(id, status) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
