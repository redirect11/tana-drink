// Import dello STORICO dagli Excel della Tana (JSON prodotto dallo script
// di estrazione): fornitori, scadenzario, catalogo inventario e ore staff.
// Idempotente: ciò che esiste già (stessa chiave) viene saltato, quindi si
// può rilanciare senza creare doppioni.

import {
  fetchSuppliers,
  createSupplier,
  fetchSupplierInvoices,
  createSupplierInvoice,
  fetchInventoryItems,
  createInventoryItem,
  fetchInventoryCategories,
  createInventoryCategory,
  fetchAllStaffHours,
  addStaffHours,
} from '../lib/api.js'

const low = (s) => String(s || '').trim().toLowerCase()

// Decide cosa creare confrontando i dati col DB (logica pura, testabile).
export function planImport(data, existing) {
  const supSeen = new Set(existing.suppliers.map((s) => low(s.name)))
  const catSeen = new Set(existing.categories.map((c) => low(c.name)))
  const itemSeen = new Set(existing.items.map((i) => low(i.name)))
  const invSeen = new Set(
    existing.invoices.map((i) => `${low(i.supplier_name)}|${i.number}|${i.date}|${i.amount}`)
  )
  const hoursSeen = new Set(
    existing.hours.map((h) => `${low(h.staff_name)}|${h.date}|${h.hours}`)
  )

  const suppliers = (data.suppliers || []).filter((s) => !supSeen.has(low(s.name)))
  const invoices = (data.supplier_invoices || []).filter(
    (i) => !invSeen.has(`${low(i.supplier_name)}|${i.number}|${i.date}|${i.amount}`)
  )
  const items = (data.inventory_items || []).filter((i) => !itemSeen.has(low(i.name)))
  const categories = [
    ...new Set(items.map((i) => i.category).filter(Boolean)),
  ].filter((name) => !catSeen.has(low(name)))
  const hours = (data.staff_hours || []).filter(
    (h) => !hoursSeen.has(`${low(h.staff_name)}|${h.date}|${h.hours}`)
  )

  return {
    suppliers,
    categories,
    items,
    invoices,
    hours,
    skipped: {
      suppliers: (data.suppliers || []).length - suppliers.length,
      invoices: (data.supplier_invoices || []).length - invoices.length,
      items: (data.inventory_items || []).length - items.length,
      hours: (data.staff_hours || []).length - hours.length,
    },
  }
}

// Esegue l'import: legge lo stato attuale, pianifica, scrive. `onProgress`
// riceve messaggi di avanzamento leggibili.
export async function runImport(data, onProgress = () => {}) {
  onProgress('Leggo lo stato attuale del database…')
  const [suppliers, categories, items, invoices, hours] = await Promise.all([
    fetchSuppliers(),
    fetchInventoryCategories().catch(() => []),
    fetchInventoryItems(),
    fetchSupplierInvoices({ limit: 3000 }),
    fetchAllStaffHours(),
  ])
  const plan = planImport(data, { suppliers, categories, items, invoices, hours })

  // Fornitori
  const supIds = new Map(suppliers.map((s) => [low(s.name), s.id]))
  for (const [n, s] of plan.suppliers.entries()) {
    onProgress(`Fornitori ${n + 1}/${plan.suppliers.length}: ${s.name}`)
    const created = await createSupplier({ name: s.name, sort_order: supIds.size, ...(s.email ? { email: s.email } : {}) })
    supIds.set(low(s.name), created.id)
  }

  // Categorie inventario
  const catIds = new Map(categories.map((c) => [low(c.name), c.id]))
  for (const name of plan.categories) {
    onProgress(`Categorie: ${name}`)
    const created = await createInventoryCategory({ name, sort_order: catIds.size })
    catIds.set(low(name), created.id)
  }

  // Catalogo inventario (giacenza 0: quella vera arriva da carichi/conta)
  for (const [n, it] of plan.items.entries()) {
    if (n % 20 === 0) onProgress(`Prodotti ${n + 1}/${plan.items.length}…`)
    await createInventoryItem({
      name: it.name,
      unit: it.unit || 'pz',
      package_size: it.package_size ?? null,
      category_id: it.category ? catIds.get(low(it.category)) ?? null : null,
      supplier_id: null,
      cost: it.cost ?? null,
      vat: it.vat ?? 22,
      status: it.status || 'linea',
      stock: 0,
      low_threshold: 0,
    })
  }

  // Scadenzario
  for (const [n, inv] of plan.invoices.entries()) {
    if (n % 20 === 0) onProgress(`Scadenzario ${n + 1}/${plan.invoices.length}…`)
    await createSupplierInvoice({
      supplier_id: supIds.get(low(inv.supplier_name)) ?? null,
      supplier_name: inv.supplier_name,
      number: inv.number || '',
      doc_type: inv.doc_type || 'Proforma',
      date: inv.date,
      amount: inv.amount,
      paid: !!inv.paid,
      notes: inv.notes ?? null,
    })
  }

  // Ore staff (solo il totale ore del giorno: gli orari non sono nei fogli)
  for (const [n, h] of plan.hours.entries()) {
    if (n % 50 === 0) onProgress(`Ore staff ${n + 1}/${plan.hours.length}…`)
    await addStaffHours({
      staff_name: h.staff_name,
      date: h.date,
      start: null,
      end: null,
      break_minutes: 0,
      hours: h.hours,
      note: h.note ?? 'import Excel',
    })
  }

  const fatto = `Importati: ${plan.suppliers.length} fornitori, ${plan.categories.length} categorie, ${plan.items.length} prodotti, ${plan.invoices.length} documenti, ${plan.hours.length} turni.`
  const saltati = `Saltati (già presenti): ${plan.skipped.suppliers} fornitori, ${plan.skipped.items} prodotti, ${plan.skipped.invoices} documenti, ${plan.skipped.hours} turni.`
  onProgress(`${fatto} ${saltati}`)
  return plan
}
