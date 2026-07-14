import { useEffect, useState } from 'react'
import { fetchInventoryItems } from '../lib/api.js'
import { toBaseQty, ENTRY_UNITS } from '../lib/inventory.js'
import { formatPrice } from '../lib/orderStatus.js'

// PRODOTTO LIBERO: voce fuori catalogo battuta al volo (stile "custom
// amount/item" dei POS SumUp). Bastano nome e prezzo — lo scarico
// magazzino è opzionale: si cercano gli ingredienti per nome e si
// toccano per aggiungerli (niente menu a tendina).
export default function CustomDrinkForm({ onCancel, onAdd }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [rows, setRows] = useState([]) // { inventory_item_id, name, qty, unit }
  const [inventory, setInventory] = useState([])
  const [showRecipe, setShowRecipe] = useState(false)
  const [search, setSearch] = useState('')

  // L'inventario è leggibile solo dal bartender: se la lettura fallisce
  // (ruolo staff), il form resta usabile senza la sezione ingredienti.
  useEffect(() => {
    fetchInventoryItems().then(setInventory).catch(() => setInventory([]))
  }, [])

  const q = search.trim().toLowerCase()
  const matches = q
    ? inventory
        .filter(
          (i) =>
            i.name.toLowerCase().includes(q) &&
            !rows.some((r) => r.inventory_item_id === i.id)
        )
        .slice(0, 6)
    : []

  function addIngredient(inv) {
    const unit = ENTRY_UNITS[inv.unit]?.[0] ?? inv.unit
    setRows((r) => [...r, { inventory_item_id: inv.id, name: inv.name, invUnit: inv.unit, qty: '', unit }])
    setSearch('')
  }
  function setRow(idx, patch) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  }
  function removeRow(idx) {
    setRows((r) => r.filter((_, i) => i !== idx))
  }

  const priceNum = Number(String(price).replace(',', '.')) || 0
  const valid = name.trim() && priceNum > 0

  function submit(e) {
    e.preventDefault()
    if (!valid) return
    const recipe_items = rows
      .filter((r) => Number(r.qty) > 0)
      .map((r) => ({
        inventory_item_id: r.inventory_item_id,
        name: r.name,
        unit: r.invUnit ?? 'pz',
        qty: toBaseQty(r.qty, r.unit),
      }))
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
        <h3 style={{ marginTop: 0 }}>🏷 Prodotto libero</h3>
        <p className="muted small" style={{ margin: '0 0 10px' }}>
          Nome e prezzo bastano (es. voce non in inventario). Gli
          ingredienti servono solo se vuoi lo scarico magazzino.
        </p>

        <label htmlFor="cd-name">Nome *</label>
        <input
          id="cd-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Consumazione, Gin tonic speciale…"
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
            onClick={() => setShowRecipe(true)}
          >
            + Ingredienti (scarico magazzino)
          </button>
        )}

        {showRecipe && (
          <>
            <label htmlFor="cd-ing" style={{ marginTop: 10 }}>Ingredienti</label>

            {/* Righe già scelte: nome fisso, quantità e unità inline. */}
            {rows.map((r, idx) => {
              const units = ENTRY_UNITS[r.invUnit] ?? [r.unit]
              return (
                <div className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }} key={r.inventory_item_id}>
                  <span className="grow" style={{ fontSize: '0.9rem' }}>{r.name}</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={r.qty}
                    onChange={(e) => setRow(idx, { qty: e.target.value })}
                    placeholder="Qta"
                    aria-label={`Quantità ${r.name}`}
                    autoFocus
                    style={{ width: 70 }}
                  />
                  <select
                    value={r.unit}
                    aria-label={`Unità ${r.name}`}
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

            {/* Ricerca rapida: digita e tocca per aggiungere. */}
            <input
              id="cd-ing"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Cerca ingrediente…"
              style={{ marginTop: 6 }}
            />
            {matches.length > 0 && (
              <div className="chips-row" style={{ marginTop: 6 }}>
                {matches.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className="chip"
                    onClick={() => addIngredient(i)}
                  >
                    + {i.name}
                  </button>
                ))}
              </div>
            )}
            {q && matches.length === 0 && (
              <p className="muted small" style={{ margin: '6px 0 0' }}>Nessun ingrediente per «{search}».</p>
            )}
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
