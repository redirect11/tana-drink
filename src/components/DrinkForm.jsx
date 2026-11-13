import { useMemo, useState } from 'react'
import { entryUnits, unitaDopoCambioIngrediente } from '../lib/inventory.js'
import PriceSuggestion from './PriceSuggestion.jsx'
import CostoRiga from './CostoRiga.jsx'
import { BICCHIERI, COLORI, DECORAZIONI, urlDrink, sceltaIllustrazione } from '../lib/illustrazioneDrink.js'
import { useFondoChiaro } from '../lib/useFondoChiaro.js'
import { MESSAGGI_PIANO } from '../lib/limiti.js'
import AiutoCampo from './AiutoCampo.jsx'
import RitaglioFoto from './RitaglioFoto.jsx'
import DescrizioneAI from './DescrizioneAI.jsx'

// Scheda prodotto del MENÙ: nome, foto, categoria, prezzo, descrizione,
// ricetta/ingredienti e disponibilità. Estratta da MenuManager perché la usa
// anche il POS (modalità Organizza → menu del prodotto), così si modifica un
// prodotto senza passare dal backoffice.
export default function DrinkForm({
  initial,
  categories,
  inventory,
  onCreateCategory,
  onCancel,
  onSave,
  // L'IVA di vendita del locale: serve solo a scrivere nel suggerimento
  // quale aliquota si userà lasciando il campo vuoto. Dove non si sa (il
  // POS non legge le impostazioni) si dice «quella del locale» e basta.
  saleVatLocale = null,
  // Sul profilo leggero (piano Free) Storage non c'è: la foto non si carica,
  // e il campo lo dice invece di fallire al salvataggio (REQ-LIC-004).
  fotoConsentite = true,
  // I disegni dei drink sono del locale che ha «Notte» (REQ-LIC-013,
  // disegniDelLocale): agli altri la composizione non si offre, perché in
  // carta non comparirebbe. La foto invece si carica sempre.
  disegniConsentiti = false,
}) {
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
  // Le illustrazioni nella versione che si legge sul tema del gestionale.
  const fondoChiaro = useFondoChiaro()
  // Il disegno composto della voce (null se non c'è, o se è uno dei
  // soggetti fissi della prima versione: cambiandolo diventa composto).
  const disegno =
    form.illustrazione && typeof form.illustrazione === 'object' ? sceltaIllustrazione(form.illustrazione) : null
  const scegliDisegno = (cambio) =>
    setForm((f) => ({
      ...f,
      illustrazione: {
        ...(sceltaIllustrazione(f.illustrazione) || { bicchiere: 'coppa', colore: 'rosa', decorazione: 'nessuna' }),
        ...cambio,
      },
    }))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [newCat, setNewCat] = useState('')
  const [addingCat, setAddingCat] = useState(false)

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

  // IL RITAGLIO (REQ-MENU-039): scelta una foto, prima si ritaglia, poi
  // diventa la foto della scheda. Si carica solo salvando il prodotto, come
  // prima. La foto scelta resta da parte (`originale`), perché «Ritaglia di
  // nuovo» riparta da lei e non da quella già tagliata.
  const [daRitagliare, setDaRitagliare] = useState(null)
  const [originale, setOriginale] = useState(null)

  function onPickFile(e) {
    const file = e.target.files && e.target.files[0]
    // Si svuota il campo: scegliendo di nuovo la stessa foto, il ritaglio
    // si deve riaprire.
    if (e.target) e.target.value = ''
    if (!file) return
    setDaRitagliare(file)
  }

  function usaFoto(file) {
    setOriginale((o) => (daRitagliare && daRitagliare !== o ? daRitagliare : o))
    setDaRitagliare(null)
    setForm((f) => ({ ...f, _file: file }))
    setPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setForm((f) => ({ ...f, _file: null, image_url: null }))
    setPreview(null)
    setOriginale(null)
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
  // CAMBIARE INGREDIENTE NON TOCCA QUANTITÀ E UNITÀ (BUG-124): l'unità
  // resta quella della riga se vale anche per il nuovo articolo; cambia
  // solo quando non ha senso (vedi unitaDopoCambioIngrediente).
  function onItemChange(idx, itemId) {
    const inv = inventory.find((i) => i.id === itemId)
    setForm((f) => ({
      ...f,
      recipe_rows: f.recipe_rows.map((r, i) =>
        i === idx ? { ...r, inventory_item_id: itemId, unit: unitaDopoCambioIngrediente(inv, r.unit) } : r
      ),
    }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!(form.name || '').trim()) return
    // UNA RIGA DELLA RICETTA SENZA QUANTITÀ NON SI BUTTA IN SILENZIO: è la
    // dose che si scala a ogni vendita. Con la scheda nata dal magazzino
    // (REQ-AI-002) la quantità parte vuota apposta, e salvarla vuota
    // vorrebbe dire un prodotto senza ricetta.
    const senzaDose = form.recipe_rows.find((r) => r.inventory_item_id && !(Number(String(r.qty ?? '').replace(',', '.')) > 0))
    if (senzaDose) {
      const nome = itemsById[senzaDose.inventory_item_id]?.name || senzaDose.name || 'un ingrediente'
      setSaveError(`Manca la quantità di «${nome}» nella ricetta: è la dose che si scala a ogni vendita.`)
      return
    }
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
          {originale && form._file && (
            <button type="button" className="btn ghost small" onClick={() => setDaRitagliare(originale)}>
              Ritaglia di nuovo
            </button>
          )}
        </div>
      )}
      {daRitagliare && <RitaglioFoto file={daRitagliare} onConferma={usaFoto} onAnnulla={() => setDaRitagliare(null)} />}
      {fotoConsentite ? (
        <input id="photo" type="file" accept="image/*" onChange={onPickFile} />
      ) : (
        <p className="muted small" style={{ margin: '0 0 8px' }}>{MESSAGGI_PIANO.foto}</p>
      )}

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
          <option value="__new__">+ Nuova categoria…</option>
        </select>
      )}

      <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="price">Prezzo (€)</label>
          <input
            id="price"
            type="number"
            step="any"
            min="0"
            value={form.price}
            onChange={set('price')}
          />
        </div>
        {/* L'IVA DI VENDITA, SOLO DOVE FA ECCEZIONE. Il locale ne ha una
            generale (Impostazioni → IVA di vendita predefinita); qui si
            scrive l'eccezione, dove c'è. Serve perché nel menù esiste una
            categoria BOTTIGLIE, e una bottiglia intera non si rivende come
            un drink servito al banco: mettere tutto al 10% gonfia il netto,
            e dal netto scendono margine, incidenze e conto di fine mese. */}
        <div style={{ width: 130 }}>
          <label htmlFor="salevat">IVA vendita %</label>
          <input
            id="salevat"
            type="number"
            step="any"
            min="0"
            max="22"
            value={form.sale_vat ?? ''}
            onChange={set('sale_vat')}
            placeholder={saleVatLocale != null ? String(saleVatLocale) : 'del locale'}
          />
        </div>
      </div>
      <AiutoCampo>
        Se vuota si applica l’IVA del locale
        {saleVatLocale != null ? ` (${saleVatLocale}%)` : ''}. Va indicata solo
        per le eccezioni, come le bottiglie vendute intere.
      </AiutoCampo>

      {/* Costo reale della ricetta, prezzo consigliato e guadagno: si
          aggiorna man mano che si compongono gli ingredienti qui sotto. */}
      <PriceSuggestion
        rows={form.recipe_rows}
        itemsById={itemsById}
        price={form.price}
        onUse={(v) => setForm((f) => ({ ...f, price: String(v) }))}
      />

      {/* IL NOME PER IL CLIENTE (REQ-MENU-025). Il gestionale chiama le cose
          come servono al banco — il gin tonic col solo nome del gin, le
          voci-prezzo «SOUR 7» —, il cliente legge questo. L'ordine porta
          comunque il nome del banco. */}
      <label htmlFor="nome_cliente">Nome nel menù dei clienti</label>
      <input
        id="nome_cliente"
        value={form.nome_cliente || ''}
        onChange={set('nome_cliente')}
        placeholder={form.name || ''}
      />
      <AiutoCampo>
        Nome della voce nel menù dei clienti. Se vuoto si usa il nome della
        voce; comande e scontrini riportano sempre il nome della voce.
      </AiutoCampo>

      <label htmlFor="description">Descrizione</label>
      <input id="description" value={form.description} onChange={set('description')} />
      <AiutoCampo>Testo mostrato al cliente nel menù.</AiutoCampo>
      <DescrizioneAI
        subito={Boolean(initial.da_magazzino)}
        nome={form.name || ''}
        categoria={categories.find((c) => c.id === form.category_id)?.name}
        attuale={form.description}
        onUsa={(testo) => setForm((f) => ({ ...f, description: testo }))}
      />

      {/* GLI INGREDIENTI IN CARTA (REQ-MENU-019). La ricetta qui sotto è di
          magazzino — «Ghiaccio Hoshizaki», «Lime Succo Homemade 1kg - 50cl»
          — e i Signature non ne hanno: per il cliente si scrivono qui. */}
      {/* REQ-MENU-017: spenta di partenza, perché lime, sciroppi e ghiaccio
          spesso non hanno una giacenza tenuta bene. */}
      <label className="row" style={{ gap: 8, alignItems: 'center', margin: '8px 0 0' }}>
        <input
          type="checkbox"
          checked={form.segue_giacenze === true}
          onChange={(e) => setForm((f) => ({ ...f, segue_giacenze: e.target.checked }))}
        />
        <span>Il menù dei clienti segue le giacenze</span>
      </label>
      <AiutoCampo style={{ margin: '2px 0 8px' }}>
        Quando un ingrediente della ricetta è esaurito (o in esaurimento, secondo
        Impostazioni → Menù clienti) la voce non è disponibile per il cliente.
        Al banco resta sempre.
      </AiutoCampo>

      <label htmlFor="ingredienti">Ingredienti in carta</label>
      <input
        id="ingredienti"
        value={form.ingredienti || ''}
        onChange={set('ingredienti')}
        placeholder="Gin, basilico, lime, zucchero"
      />
      <AiutoCampo>
        Elenco mostrato al cliente nel menù, separato da virgole. Se vuoto si
        ricava dalla ricetta, esclusi ghiaccio, lavorazioni e confezioni.
      </AiutoCampo>

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
      <AiutoCampo>Consultabile al banco dal tasto ⓘ della scheda del prodotto.</AiutoCampo>

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
          <div className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }} key={idx}>
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
            <CostoRiga row={r} item={inv} name={inv?.name} />
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

      {/* GLI SPECIAL DELLA CASA (REQ-MENU-018): la voce resta nella sua
          categoria e in più compare negli Special. */}
      <label className="row" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={!!form.speciale}
          onChange={set('speciale')}
        />
        <span>Drink speciale</span>
      </label>
      <AiutoCampo>
        Compare nel menù Special e nel carosello in cima al menù del cliente,
        oltre che nella sua categoria.
      </AiutoCampo>
      {/* IL DISEGNO DEL DRINK (REQ-MENU-018): bicchiere, colore e
          decorazione, nel segno delle incisioni del libro. L'anteprima è
          quella che vedrà il cliente. */}
      {form.speciale && disegniConsentiti && (
        <div className="illustrazioni" role="group" aria-label="Disegno del drink">
          <span className="muted small">Disegno del drink, usato quando manca la foto</span>
          {!disegno ? (
            <button type="button" className="btn ghost small block" style={{ marginTop: 4 }} onClick={() => scegliDisegno({})}>
              Componi un disegno
            </button>
          ) : (
            <>
              <img className="illustrazione-anteprima" src={urlDrink(disegno, { chiaro: fondoChiaro })} alt="Anteprima del disegno" />
              <span className="muted small">Bicchiere</span>
              <div className="illustrazioni-griglia" role="group" aria-label="Bicchiere">
                {BICCHIERI.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`illustrazione-voce${disegno.bicchiere === b.id ? ' scelta' : ''}`}
                    aria-pressed={disegno.bicchiere === b.id}
                    aria-label={b.nome}
                    title={b.nome}
                    onClick={() => scegliDisegno({ bicchiere: b.id })}
                  >
                    <img src={urlDrink({ ...disegno, bicchiere: b.id, decorazione: 'nessuna' }, { chiaro: fondoChiaro })} alt="" />
                  </button>
                ))}
              </div>
              <span className="muted small">Colore</span>
              <div className="colori-drink" role="group" aria-label="Colore">
                {COLORI.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`colore-drink${disegno.colore === c.id ? ' scelta' : ''}`}
                    style={{ background: c.hex }}
                    aria-pressed={disegno.colore === c.id}
                    aria-label={c.nome}
                    title={c.nome}
                    onClick={() => scegliDisegno({ colore: c.id })}
                  />
                ))}
              </div>
              <span className="muted small">Decorazione</span>
              <div className="illustrazioni-griglia" role="group" aria-label="Decorazione">
                {DECORAZIONI.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className={`illustrazione-voce${disegno.decorazione === x.id ? ' scelta' : ''}`}
                    aria-pressed={disegno.decorazione === x.id}
                    aria-label={x.nome}
                    title={x.nome}
                    onClick={() => scegliDisegno({ decorazione: x.id })}
                  >
                    <img src={urlDrink({ ...disegno, decorazione: x.id }, { chiaro: fondoChiaro })} alt="" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn ghost small"
                style={{ marginTop: 8 }}
                onClick={() => setForm((f) => ({ ...f, illustrazione: null }))}
              >
                Togli il disegno
              </button>
            </>
          )}
        </div>
      )}

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
