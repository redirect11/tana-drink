import { useState } from 'react'
import {
  THEME_FIELDS,
  THEME_PRESETS,
  DEFAULT_THEME,
  resolveThemeVars,
  applyTheme,
} from '../lib/themes.js'

// Sezione "Aspetto" delle impostazioni: scelta del tema (preset scuri e
// chiari) e personalizzazione dei colori principali, separatamente per il
// gestionale (staff/bartender) e per la vista cliente. Il tema scelto è
// salvato in settings/bar e arriva a tutti i dispositivi in tempo reale.
//
// I due temi si scelgono da qui, ma non si applicano per indirizzo: seguono
// CHI GUARDA. Chi è dello staff vede il gestionale su ogni schermata — il
// proprio profilo, la lista ordini, il menù per gli ordini manuali; chi
// ordina vede il suo. Per questo le etichette dicono a chi tocca cosa: da
// sole, "Gestionale" e "Vista cliente" sembravano due pagine.
// I DUE TEMI STANNO DOVE STA LA COSA CHE COLORANO: quello del gestionale
// in «Aspetto», quello del menù dei clienti in «Menù clienti», insieme a
// tutto il resto di quella schermata. Messi uno sotto l'altro sembravano
// due varianti della stessa cosa, e non si capiva quale delle due si stesse
// toccando.
export default function ThemeSettings({ settings, onSave }) {
  return (
    <div className="card settings-section">
      <h3>🎨 Aspetto</h3>
      <ThemeEditor
        title="Gestionale — quello che vedi ora"
        hint="I colori di chi lavora: coda, cassa, impostazioni, profilo."
        value={settings.theme_staff}
        // Anteprima immediata: il gestionale è la vista in cui ci troviamo.
        livePreview
        onSave={(t) => onSave({ theme_staff: t })}
      />
    </div>
  )
}

// Il tema del menù dei clienti, da mostrare nella sua sezione.
export function TemaMenuClienti({ settings, onSave }) {
  return (
    <ThemeEditor
      title="Colori del menù"
      hint="Come lo vedono i clienti sul telefono. Per provarlo: menu ▸ Vista cliente."
      value={settings.theme_client}
      onSave={(t) => onSave({ theme_client: t })}
    />
  )
}

function ThemeEditor({ title, hint, value, onSave, livePreview = false }) {
  const current = value || { preset: DEFAULT_THEME, custom: null }
  const [customizing, setCustomizing] = useState(false)
  // Bozza degli override colore mentre si personalizza (non ancora salvata).
  const [draft, setDraft] = useState(null)

  const resolved = resolveThemeVars(
    draft ? { ...current, custom: draft } : current
  )
  const hasCustom = !!(current.custom && Object.keys(current.custom).length)

  function pickPreset(id) {
    setDraft(null)
    setCustomizing(false)
    const next = { preset: id, custom: null }
    onSave(next)
    if (livePreview) applyTheme(resolveThemeVars(next))
  }

  function startCustomize() {
    setDraft({ ...(current.custom || {}) })
    setCustomizing(true)
  }

  function setColor(key, color) {
    const next = { ...(draft || {}), [key]: color }
    setDraft(next)
    if (livePreview) applyTheme(resolveThemeVars({ ...current, custom: next }))
  }

  function saveCustom() {
    onSave({ preset: current.preset || DEFAULT_THEME, custom: draft })
    setCustomizing(false)
    setDraft(null)
  }

  function resetCustom() {
    setDraft(null)
    setCustomizing(false)
    const next = { preset: current.preset || DEFAULT_THEME, custom: null }
    onSave(next)
    if (livePreview) applyTheme(resolveThemeVars(next))
  }

  return (
    <div style={{ marginTop: 10 }}>
      <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.9rem' }}>
        <strong>{title}</strong>
        {hasCustom && ' · personalizzato'}
      </p>
      {hint && (
        <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.82rem' }}>
          {hint}
        </p>
      )}

      {/* A TENDINA, non a chip: con otto preset (e cresceranno) la fila
          di bottoni si mangiava la pagina due volte, gestionale e cliente. */}
      <select
        value={current.preset || DEFAULT_THEME}
        onChange={(e) => pickPreset(e.target.value)}
        style={{ width: '100%', margin: '2px 0 8px', padding: '10px 12px', fontSize: '1rem' }}
      >
        {Object.entries(THEME_PRESETS).map(([id, p]) => (
          <option key={id} value={id}>
            {p.label}
          </option>
        ))}
      </select>

      {!customizing ? (
        <button className="btn ghost small" onClick={startCustomize}>
          🎛 Personalizza colori
        </button>
      ) : (
        <div style={{ marginTop: 8 }}>
          {THEME_FIELDS.map((f) => (
            <div
              className="row between"
              key={f.key}
              style={{ alignItems: 'center', marginTop: 6 }}
            >
              <span style={{ fontSize: '0.9rem' }}>{f.label}</span>
              <input
                type="color"
                value={resolved[f.key]}
                onChange={(e) => setColor(f.key, e.target.value)}
                style={{ width: 52, height: 32, padding: 2, cursor: 'pointer' }}
              />
            </div>
          ))}
          <div className="grid-2" style={{ marginTop: 10 }}>
            <button className="btn ghost small" onClick={resetCustom}>
              ↩︎ Ripristina preset
            </button>
            <button className="btn small" onClick={saveCustom}>
              💾 Salva tema
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
