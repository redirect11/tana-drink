import { useEffect, useMemo, useState } from 'react'
import { fetchInventoryItems } from '../lib/api.js'
import { toBaseQty, ENTRY_UNITS } from '../lib/inventory.js'
import { formatPrice } from '../lib/orderStatus.js'
import PriceSuggestion from './PriceSuggestion.jsx'

// PRODOTTO LIBERO: voce fuori catalogo battuta al volo (stile "custom
// amount/item" dei POS SumUp). Bastano nome e prezzo — lo scarico
// magazzino è opzionale: si cercano gli ingredienti per nome e si
// toccano per aggiungerli (niente menu a tendina).
// `initial` (opzionale) precompila il form per la MODIFICA per-item di
// una riga d'ordine: nome, prezzo e ricetta già impostati — così gli
// ingredienti del drink si possono SOSTITUIRE (cambiare o togliere), non
// solo aggiungere. `warnNoRecipe` segnala che il prodotto di partenza non
// ha ingredienti configurati: probabilmente non sono mai stati inseriti
// nella sua scheda, e senza di essi non c'è scarico di magazzino.
export default function CustomDrinkForm({ onCancel, onAdd, initial = null, warnNoRecipe = false }) {
  const initRows = (initial?.recipe_items || []).map((r) => ({
    inventory_item_id: r.inventory_item_id || '',
    name: r.name || '',
    invUnit: r.unit || 'pz',
    unit: r.unit || 'pz',
    qty: r.qty,
  }))
  const [name, setName] = useState(initial?.name || '')
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '')
  const [rows, setRows] = useState(initRows) // { inventory_item_id, name, qty, unit }
  const [inventory, setInventory] = useState([])
  const [showRecipe, setShowRecipe] = useState(initRows.length > 0 || warnNoRecipe)
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

  // ── Costo ingredienti e prezzo consigliato ──────────────────────────
  // Il costo al dettaglio arriva dal listino di magazzino (costo confezione
  // ÷ contenuto). Il consigliato è costo × ricarico: un punto di partenza,
  // non un vincolo — il prezzo resta digitabile a mano.
  const itemsById = useMemo(
    () => Object.fromEntries(inventory.map((i) => [i.id, i])),
    [inventory]
  )
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
        <h3 style={{ marginTop: 0 }}>{initial ? '✏️ Modifica prodotto' : '🏷 Prodotto libero'}</h3>
        <p className="muted small" style={{ margin: '0 0 10px' }}>
          {initial
            ? 'Modifica nome, prezzo e ingredienti solo per questa riga: diventa una voce a sé e non si unisce più con gli originali.'
            : 'Nome e prezzo bastano (es. voce non in inventario). Gli ingredienti servono solo se vuoi lo scarico magazzino.'}
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

        {/* Costo reale, consigliato e guadagno: stesso riquadro del Menù. */}
        <PriceSuggestion
          rows={rows}
          itemsById={itemsById}
          price={price}
          onUse={(v) => setPrice(String(v))}
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

            {warnNoRecipe && (
              <div className="banner" style={{ margin: '6px 0' }}>
                ⚠️ Questo prodotto non ha ingredienti configurati: forse non sono
                mai stati inseriti nella sua scheda del Menù. Senza ingredienti
                non c’è scarico di magazzino. Quelli che aggiungi qui valgono
                solo per questa riga.
              </div>
            )}

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
            {initial ? 'Salva' : 'Aggiungi'} {priceNum > 0 ? formatPrice(priceNum) : ''}
          </button>
        </div>
      </form>
    </div>
  )
}
