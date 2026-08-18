import { useMemo, useState } from 'react'
import { entryUnits } from '../lib/inventory.js'
import PriceSuggestion from './PriceSuggestion.jsx'

// Scheda prodotto del MENÙ: nome, foto, categoria, prezzo, descrizione,
// ricetta/ingredienti e disponibilità. Estratta da MenuManager perché la usa
// anche il POS (modalità Organizza → menu del prodotto), così si modifica un
// prodotto senza passare dal backoffice.
export default function DrinkForm({ initial, categories, inventory, onCreateCategory, onCancel, onSave }) {
  const itemsById = useMemo(
    () => Object.fromEntries((inventory || []).map((i) => [i.id, i])),
    [inventory]
  )
  const [form, setForm] = useState(() => ({
    ...initial,
    _file: null,
    // righe ricetta editabili (qty nell'unità base salvata)
    recipe_rows: (initial.recipe_items || []).map((r) => ({
      inventory_item_id: r.inventory_item_id,
      qty: r.qty,
      unit: r.unit,
      // Conservati per non perderli se l'inventario non è disponibile al
      // salvataggio (vedi buildRecipeItems).
      name: r.name,
      invUnit: r.unit,
    })),
  }))
  const [preview, setPreview] = useState(initial.image_url || null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [newCat, setNewCat] = useState('')
  const [addingCat, setAddingCat] = useState(false)

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

  function onPickFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setForm((f) => ({ ...f, _file: file }))
    setPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setForm((f) => ({ ...f, _file: null, image_url: null }))
    setPreview(null)
  }

  // --- categoria ---
  function onCategoryChange(e) {
    if (e.target.value === '__new__') {
      setAddingCat(true)
      return
    }
    setForm((f) => ({ ...f, category_id: e.target.value }))
  }
  async function confirmNewCat() {
    if (!newCat.trim()) return
    const cat = await onCreateCategory(newCat.trim())
    setForm((f) => ({ ...f, category_id: cat.id }))
    setNewCat('')
    setAddingCat(false)
  }

  // --- ricetta ---
  function addRow() {
    setForm((f) => ({
      ...f,
      recipe_rows: [...f.recipe_rows, { inventory_item_id: '', qty: '', unit: '' }],
    }))
  }
  function setRow(idx, patch) {
    setForm((f) => ({
      ...f,
      recipe_rows: f.recipe_rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }))
  }
  function removeRow(idx) {
    setForm((f) => ({ ...f, recipe_rows: f.recipe_rows.filter((_, i) => i !== idx) }))
  }
  function onItemChange(idx, itemId) {
    const inv = inventory.find((i) => i.id === itemId)
    // unità di inserimento di default per l'item scelto (cl per i volumi, ecc.)
    const unit = inv ? (entryUnits(inv)[0] ?? inv.unit) : ''
    setRow(idx, { inventory_item_id: itemId, unit })
  }

  async function submit(e) {
    e.preventDefault()
    if (!(form.name || '').trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(form)
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>
        {initial && initial.id ? 'Modifica prodotto' : 'Nuovo prodotto'}
      </h3>

      <label htmlFor="name">Nome *</label>
      <input id="name" value={form.name} onChange={set('name')} required />

      <label htmlFor="photo">Foto</label>
      {preview && (
        <div style={{ marginBottom: 8 }}>
          <img className="drink-preview" src={preview} alt="Anteprima drink" />
          <button type="button" className="btn ghost small" onClick={removePhoto}>
            Rimuovi foto
          </button>
        </div>
      )}
      <input id="photo" type="file" accept="image/*" onChange={onPickFile} />

      <label htmlFor="category">Categoria</label>
      {addingCat ? (
        <div className="row" style={{ gap: 8 }}>
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Nome nuova categoria"
            autoFocus
          />
          <button type="button" className="btn small" onClick={confirmNewCat}>OK</button>
          <button type="button" className="btn ghost small" onClick={() => setAddingCat(false)}>✕</button>
        </div>
      ) : (
        <select id="category" value={form.category_id || ''} onChange={onCategoryChange}>
          <option value="">— Nessuna —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="__new__">➕ Nuova categoria…</option>
        </select>
      )}

      <label htmlFor="price">Prezzo (€)</label>
      <input
        id="price"
        type="number"
        step="any"
        min="0"
        value={form.price}
        onChange={set('price')}
      />

      {/* Costo reale della ricetta, prezzo consigliato e guadagno: si
          aggiorna man mano che si compongono gli ingredienti qui sotto. */}
      <PriceSuggestion
        rows={form.recipe_rows}
        itemsById={itemsById}
        price={form.price}
        onUse={(v) => setForm((f) => ({ ...f, price: String(v) }))}
      />

      <label htmlFor="description">Descrizione</label>
      <input id="description" value={form.description} onChange={set('description')} />
      <p className="muted small" style={{ margin: '2px 0 0' }}>
        Quello che legge il cliente sul menù.
      </p>

      {/* COME SI PREPARA, a parole. La ricetta strutturata qui sotto dice
          COSA ci va e quanto — serve al magazzino — ma non dice il gesto:
          shakerato o mescolato, il ghiaccio, l'ordine, il bicchiere. Chi
          entra a dare una mano il sabato quel gesto non ce l'ha in testa, e
          finora se lo doveva far dire ogni volta. */}
      <label htmlFor="recipe" style={{ marginTop: 12 }}>
        Come si prepara
      </label>
      <textarea
        id="recipe"
        rows={4}
        value={form.recipe || ''}
        onChange={set('recipe')}
        placeholder="Es. Shakerare con ghiaccio, filtrare in coppetta, scorza di limone."
      />
      <p className="muted small" style={{ margin: '2px 0 0' }}>
        Lo legge chi sta al banco, dalla ⓘ sulla scheda del prodotto.
      </p>

      {/* Ricetta strutturata: ingredienti collegati all'inventario (usata per
          lo scarico automatico e per mostrare gli ingredienti nel menù). */}
      <label style={{ marginTop: 12 }}>Ricetta / ingredienti</label>
      {inventory.length === 0 && (
        <div className="muted" style={{ fontSize: '0.85rem' }}>
          Nessun prodotto in magazzino: aggiungili nella tab “Magazzino” per
          comporre la ricetta.
        </div>
      )}
      {form.recipe_rows.map((r, idx) => {
        const inv = inventory.find((i) => i.id === r.inventory_item_id)
        const units = inv ? entryUnits(inv) : []
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
      <button
        type="button"
        className="btn ghost small"
        style={{ marginTop: 6 }}
        onClick={addRow}
        disabled={inventory.length === 0}
      >
        + Ingrediente
      </button>

      <label className="row" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={!!form.available}
          onChange={set('available')}
        />
        <span>Disponibile nel menù</span>
      </label>

      {saveError && (
        <div className="banner" style={{ marginTop: 12 }}>Errore: {saveError}</div>
      )}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>
          Annulla
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>
    </form>
  )
}
