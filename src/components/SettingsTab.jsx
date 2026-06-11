import { useEffect, useRef, useState } from 'react'
import { subscribeSettings, updateSettings, replaceCatalog } from '../lib/api.js'
import { CANCEL_PHRASES } from '../lib/orderStatus.js'
import { parseCarteCsv, decodeCsvBuffer } from '../lib/carteImport.js'
import ConfirmDialog from './ConfirmDialog.jsx'

// Impostazioni del bar (documento settings/bar). Ogni modifica viene salvata
// subito; le pagine cliente le ricevono in tempo reale via subscribeSettings.
export default function SettingsTab() {
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    return subscribeSettings(
      (s) => setSettings(s),
      (e) => setError(e.message)
    )
  }, [])

  async function save(patch) {
    setError(null)
    // Aggiornamento ottimistico: il listener riallinea comunque dal server.
    setSettings((s) => ({ ...s, ...patch }))
    try {
      await updateSettings(patch)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!settings) return <div className="empty">Carico le impostazioni…</div>

  return (
    <div>
      {error && <div className="banner">Errore: {error}</div>}

      <div className="card settings-section">
        <h3>Modalità menù</h3>
        <ToggleRow
          label="Solo menù (consultazione)"
          desc="I clienti vedono il menù ma non possono ordinare."
          checked={settings.menu_only}
          onChange={(v) => save({ menu_only: v })}
        />
      </div>

      <div className="card settings-section">
        <h3>Consegna ordine</h3>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
          Il ritiro al banco azzera coperto e costo di servizio.
        </p>
        <div className="mode-choice" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[
            ['tavolo', '🍸 Servizio'],
            ['banco', '🚶 Ritiro'],
            ['entrambi', '🤝 Sceglie il cliente'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`mode-option${settings.service_mode === value ? ' active' : ''}`}
              onClick={() => save({ service_mode: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card settings-section">
        <h3>Tempi di servizio</h3>
        <ToggleRow
          label="Mostra tempo stimato ai clienti"
          desc="Parte dal tempo base e si raffina con i tempi reali della serata. Per il ritiro al banco conta solo attesa + preparazione."
          checked={settings.eta_enabled}
          onChange={(v) => save({ eta_enabled: v })}
        />
        {settings.eta_enabled && (
          <div className="toggle-row">
            <span>Tempo base (minuti)</span>
            <AmountInput
              value={settings.eta_base_minutes}
              min={1}
              max={120}
              step={1}
              onCommit={(v) => save({ eta_base_minutes: v })}
            />
          </div>
        )}
      </div>

      <div className="card settings-section">
        <h3>Coperto</h3>
        <ToggleRow
          label="Coperto a persona"
          desc="Il cliente indica quante persone sono al tavolo."
          checked={settings.coperto_enabled}
          onChange={(v) => save({ coperto_enabled: v })}
        />
        {settings.coperto_enabled && (
          <div className="toggle-row">
            <span>Importo a persona (€)</span>
            <AmountInput
              value={settings.coperto_amount}
              min={0}
              step={0.5}
              onCommit={(v) => save({ coperto_amount: v })}
            />
          </div>
        )}
      </div>

      <div className="card settings-section">
        <h3>Servizio e mancia</h3>
        <p className="muted" style={{ margin: '0 0 4px', fontSize: '0.85rem' }}>
          Si può attivare il costo di servizio <em>oppure</em> la mancia, non entrambi.
        </p>
        <ToggleRow
          label="Costo di servizio (%)"
          desc="Percentuale calcolata automaticamente sul totale."
          checked={settings.service_charge_enabled}
          onChange={(v) =>
            save({ service_charge_enabled: v, ...(v ? { tip_enabled: false } : {}) })
          }
        />
        {settings.service_charge_enabled && (
          <div className="toggle-row">
            <span>Percentuale (%)</span>
            <AmountInput
              value={settings.service_charge_percent}
              min={0}
              max={100}
              step={1}
              onCommit={(v) => save({ service_charge_percent: v })}
            />
          </div>
        )}
        <ToggleRow
          label="Mancia libera"
          desc="Il cliente sceglie liberamente un importo al momento dell'ordine."
          checked={settings.tip_enabled}
          onChange={(v) =>
            save({ tip_enabled: v, ...(v ? { service_charge_enabled: false } : {}) })
          }
        />
      </div>

      <div className="card settings-section">
        <h3>Menù</h3>
        <ToggleRow
          label="Mostra quantità ingredienti"
          desc="Es. «Gin 50 ml» invece di solo «Gin» nelle voci del menù."
          checked={settings.show_ingredient_quantities}
          onChange={(v) => save({ show_ingredient_quantities: v })}
        />
        <ToggleRow
          label="Tabellone «stiamo servendo»"
          desc="Mostra nel menù i numeri degli ordini pronti al servizio/ritiro. Nascosto in modalità solo menù."
          checked={settings.show_serving_board}
          onChange={(v) => save({ show_serving_board: v })}
        />
      </div>

      <div className="card settings-section">
        <h3>Coda ordini</h3>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
          Come visualizzare gli ordini nel gestionale: schede separate per
          stato, oppure un&apos;unica lista (in corso + evasi) dove lo stato è
          indicato dal colore e dall&apos;etichetta sulla card.
        </p>
        <div className="mode-choice">
          {[
            ['tabs', '🗂 Schede per stato'],
            ['lista', '📋 Lista unica'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`mode-option${settings.queue_view === value ? ' active' : ''}`}
              onClick={() => save({ queue_view: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <CatalogImport />

      <div className="card settings-section">
        <h3>Annullamenti</h3>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
          Frase proposta di default quando annulli un ordine (modificabile di
          volta in volta nel dialog di annullamento).
        </p>
        <div className="mode-choice">
          {Object.entries(CANCEL_PHRASES).map(([key, text]) => (
            <button
              key={key}
              className={`mode-option${settings.cancel_phrase_default === key ? ' active' : ''}`}
              onClick={() => save({ cancel_phrase_default: key })}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Import del catalogo prodotti da un export CSV di SumUp ("carte").
// Sostituisce drinks e categories dopo conferma con riepilogo.
function CatalogImport() {
  const fileRef = useRef(null)
  const [parsed, setParsed] = useState(null) // { products, categories, skipped }
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState(null)
  const [error, setError] = useState(null)

  async function onPickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permette di riselezionare lo stesso file
    if (!file) return
    setError(null)
    setLog(null)
    try {
      const text = decodeCsvBuffer(await file.arrayBuffer())
      setParsed(parseCarteCsv(text))
    } catch (err) {
      setError(err.message)
    }
  }

  async function doImport() {
    const data = parsed
    setParsed(null)
    setBusy(true)
    setError(null)
    try {
      await replaceCatalog(data, (msg) => setLog(msg))
      setLog(`✓ Importati ${data.products.length} prodotti in ${data.categories.length} categorie.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card settings-section">
      <h3>Catalogo prodotti</h3>
      <div className="toggle-row" style={{ borderBottom: 'none' }}>
        <div>
          <div>Importa da CSV SumUp</div>
          <div className="desc">
            Carica l&apos;export prodotti («carte») di SumUp: sostituisce
            l&apos;intero menù e le categorie. Foto e ricette esistenti
            vengono perse.
          </div>
        </div>
        <button
          className="btn small"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Importo…' : 'Carica CSV'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={onPickFile}
        />
      </div>
      {error && <div className="banner">Errore: {error}</div>}
      {log && <p className="muted small" style={{ margin: '6px 0 0' }}>{log}</p>}

      {parsed && (
        <ConfirmDialog
          title="📦 Importare il catalogo?"
          message={
            `${parsed.products.length} prodotti in ${parsed.categories.length} categorie:\n` +
            parsed.categories.join(', ') +
            (parsed.skipped ? `\n\n(${parsed.skipped} righe non valide saltate)` : '') +
            '\n\nIl menù attuale verrà sostituito.'
          }
          confirmLabel="Importa"
          danger
          onCancel={() => setParsed(null)}
          onConfirm={doImport}
        />
      )}
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange, disabled }) {
  return (
    <div className="toggle-row">
      <div>
        <div>{label}</div>
        {desc && <div className="desc">{desc}</div>}
      </div>
      <input
        type="checkbox"
        className="toggle"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  )
}

// Input numerico che salva solo al blur/invio, per non scrivere su Firestore
// ad ogni tasto premuto.
function AmountInput({ value, min, max, step, onCommit }) {
  const [val, setVal] = useState(String(value ?? ''))

  useEffect(() => {
    setVal(String(value ?? ''))
  }, [value])

  function commit() {
    let n = Number(val)
    if (!Number.isFinite(n)) n = value
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    setVal(String(n))
    if (n !== value) onCommit(n)
  }

  return (
    <input
      className="setting-amount"
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
    />
  )
}
