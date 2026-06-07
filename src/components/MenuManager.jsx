import { useEffect, useState } from 'react'
import {
  fetchDrinks,
  createDrink,
  updateDrink,
  deleteDrink,
} from '../lib/api.js'
import { uploadDrinkImage, deleteDrinkImageByUrl } from '../lib/storage.js'
import { formatPrice } from '../lib/orderStatus.js'

const EMPTY = {
  name: '',
  description: '',
  category: '',
  price: '',
  recipe: '',
  available: true,
  image_url: null,
}

export default function MenuManager() {
  const [drinks, setDrinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | drink object

  async function load() {
    setLoading(true)
    try {
      setDrinks(await fetchDrinks())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSave(form) {
    setError(null)
    // Carica la foto su Storage se ne è stata selezionata una nuova.
    let imageUrl = form.image_url ?? null
    const previousUrl = editing && editing !== 'new' ? editing.image_url ?? null : null
    if (form._file) {
      imageUrl = await uploadDrinkImage(form._file)
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      recipe: form.recipe.trim() || null,
      price: Number(form.price || 0),
      available: !!form.available,
      image_url: imageUrl,
    }
    try {
      if (editing && editing !== 'new') {
        await updateDrink(editing.id, payload)
      } else {
        await createDrink(payload)
      }
      // Se la foto è stata sostituita o rimossa, elimina quella vecchia (best-effort).
      if (previousUrl && previousUrl !== imageUrl) {
        deleteDrinkImageByUrl(previousUrl)
      }
      setEditing(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function toggleAvailable(d) {
    try {
      await updateDrink(d.id, { available: !d.available })
      setDrinks((prev) =>
        prev.map((x) => (x.id === d.id ? { ...x, available: !x.available } : x))
      )
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDelete(d) {
    if (!confirm(`Eliminare “${d.name}” dal menù?`)) return
    try {
      await deleteDrink(d.id)
      if (d.image_url) deleteDrinkImageByUrl(d.image_url)
      setDrinks((prev) => prev.filter((x) => x.id !== d.id))
    } catch (e) {
      setError(e.message)
    }
  }

  if (editing) {
    return (
      <DrinkForm
        initial={editing === 'new' ? EMPTY : editing}
        onCancel={() => setEditing(null)}
        onSave={handleSave}
      />
    )
  }

  return (
    <div>
      <button className="btn block" onClick={() => setEditing('new')}>
        + Aggiungi drink
      </button>

      {error && <div className="banner">Errore: {error}</div>}
      {loading && <div className="empty">Carico il menù…</div>}

      {drinks.map((d) => (
        <div className="card" key={d.id}>
          <div className="row between">
            {d.image_url && (
              <img className="drink-thumb" src={d.image_url} alt={d.name} />
            )}
            <div className="grow">
              <strong>{d.name}</strong>{' '}
              {!d.available && <span className="pill ritirato">non disp.</span>}
              <div className="muted">
                {d.category || 'Senza categoria'} · {formatPrice(d.price)}
              </div>
            </div>
          </div>
          {d.recipe && (
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              Ricetta: {d.recipe}
            </p>
          )}
          <div className="grid-2" style={{ marginTop: 8 }}>
            <button className="btn secondary small" onClick={() => setEditing(d)}>
              Modifica
            </button>
            <button
              className="btn ghost small"
              onClick={() => toggleAvailable(d)}
            >
              {d.available ? 'Rendi non disp.' : 'Rendi disponibile'}
            </button>
          </div>
          <button
            className="btn ghost small block"
            style={{ marginTop: 8 }}
            onClick={() => handleDelete(d)}
          >
            🗑 Elimina
          </button>
        </div>
      ))}

      {!loading && drinks.length === 0 && (
        <div className="empty">Nessun drink nel menù. Aggiungine uno!</div>
      )}
    </div>
  )
}

function DrinkForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({ ...initial, _file: null }))
  const [preview, setPreview] = useState(initial.image_url || null)
  const [saving, setSaving] = useState(false)
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

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>
        {initial && initial.id ? 'Modifica drink' : 'Nuovo drink'}
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
      <input
        id="photo"
        type="file"
        accept="image/*"
        onChange={onPickFile}
      />

      <label htmlFor="category">Categoria</label>
      <input
        id="category"
        value={form.category}
        onChange={set('category')}
        placeholder="Es. Cocktail, Analcolici, Birre"
      />

      <label htmlFor="price">Prezzo (€)</label>
      <input
        id="price"
        type="number"
        step="0.5"
        min="0"
        value={form.price}
        onChange={set('price')}
      />

      <label htmlFor="description">Descrizione</label>
      <input
        id="description"
        value={form.description}
        onChange={set('description')}
      />

      <label htmlFor="recipe">Ricetta / ingredienti</label>
      <textarea
        id="recipe"
        rows={3}
        value={form.recipe}
        onChange={set('recipe')}
        placeholder="Es. 5cl rum, 2cl lime, menta, zucchero, soda"
      />

      <label className="row" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={!!form.available}
          onChange={set('available')}
        />
        <span>Disponibile nel menù</span>
      </label>

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
