import { useEffect, useState } from 'react'
import { fetchInventoryItems } from '../lib/api.js'
import { toBaseQty, ENTRY_UNITS } from '../lib/inventory.js'
import { formatPrice } from '../lib/orderStatus.js'

// Drink custom: il bartender compone al volo una voce fuori menù (stile
// "custom amount/item" dei POS SumUp): nome, prezzo e — opzionale — gli
// ingredienti presi dall'inventario, così lo scarico scorte funziona come
// per i drink del catalogo. Pensato per essere veloce: due campi e via.
export default function CustomDrinkForm({ onCancel, onAdd }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [rows, setRows] = useState([]) // { inventory_item_id, qty, unit }
  const [inventory, setInventory] = useState([])
  const [showRecipe, setShowRecipe] = useState(false)

  // L'inventario è leggibile solo dal bartender: se la lettura fallisce
  // (ruolo staff), il form resta usabile senza la sezione ingredienti.
  useEffect(() => {
    fetchInventoryItems().then(setInventory).catch(() => setInventory([]))
  }, [])

  function addRow() {
    setRows((r) => [...r, { inventory_item_id: '', qty: '', unit: '' }])
  }
  function setRow(idx, patch) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  }
  function removeRow(idx) {
    setRows((r) => r.filter((_, i) => i !== idx))
  }
  function onItemChange(idx, itemId) {
    const inv = inventory.find((i) => i.id === itemId)
    const unit = inv ? (ENTRY_UNITS[inv.unit]?.[0] ?? inv.unit) : ''
    setRow(idx, { inventory_item_id: itemId, unit })
  }

  const priceNum = Number(String(price).replace(',', '.')) || 0
  const valid = name.trim() && priceNum > 0

  function submit(e) {
    e.preventDefault()
    if (!valid) return
    const recipe_items = rows
      .filter((r) => r.inventory_item_id && Number(r.qty) > 0)
      .map((r) => {
        const inv = inventory.find((i) => i.id === r.inventory_item_id)
        return {
          inventory_item_id: r.inventory_item_id,
          name: inv?.name ?? '',
          unit: inv?.unit ?? 'pz',
          qty: toBaseQty(r.qty, r.unit),
        }
      })
    onAdd({ name: name.trim(), price: priceNum, recipe_items })
  }

  return (
    <div className="overlay confirm-overlay" onClick={onCancel}>
      <form
        className="confirm-box"
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 style={{ marginTop: 0 }}>🍹 Drink custom</h3>

        <label htmlFor="cd-name">Nome *</label>
        <input
          id="cd-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Gin tonic speciale"
          autoFocus
          required
        />

        <label htmlFor="cd-price">Prezzo (€) *</label>
        <input
          id="cd-price"
          type="number"
          step="0.5"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Es. 8"
          required
        />

        {inventory.length > 0 && !showRecipe && (
          <button
            type="button"
            className="btn ghost small block"
            style={{ marginTop: 10 }}
            onClick={() => {
              setShowRecipe(true)
              if (rows.length === 0) addRow()
            }}
          >
            + Ingredienti (scarico magazzino)
          </button>
        )}

        {showRecipe && (
          <>
            <label style={{ marginTop: 10 }}>Ingredienti</label>
            {rows.map((r, idx) => {
              const inv = inventory.find((i) => i.id === r.inventory_item_id)
              const units = inv ? (ENTRY_UNITS[inv.unit] ?? [inv.unit]) : []
              return (
                <div className="row" style={{ gap: 6, marginTop: 6 }} key={idx}>
                  <select
                    value={r.inventory_item_id}
                    onChange={(e) => onItemChange(idx, e.target.value)}
                    style={{ flex: 2 }}
                  >
                    <option value="">— Ingrediente —</option>
                    {inventory.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={r.qty}
                    onChange={(e) => setRow(idx, { qty: e.target.value })}
                    placeholder="Qta"
                    style={{ flex: 1 }}
                  />
                  <select
                    value={r.unit}
                    onChange={(e) => setRow(idx, { unit: e.target.value })}
                    style={{ width: 70 }}
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <button type="button" className="btn ghost small" onClick={() => removeRow(idx)}>✕</button>
                </div>
              )
            })}
            <button type="button" className="btn ghost small" style={{ marginTop: 6 }} onClick={addRow}>
              + Ingrediente
            </button>
          </>
        )}

        <div className="grid-2" style={{ marginTop: 14 }}>
          <button type="button" className="btn ghost" onClick={onCancel}>
            Annulla
          </button>
          <button type="submit" className="btn" disabled={!valid}>
            Aggiungi {priceNum > 0 ? formatPrice(priceNum) : ''}
          </button>
        </div>
      </form>
    </div>
  )
}
