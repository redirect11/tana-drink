import { useEffect, useRef, useState } from 'react'
import { subscribeSettings, updateSettings, replaceCatalog } from '../lib/api.js'
import { CANCEL_PHRASES } from '../lib/orderStatus.js'
import { parseCarteCsv, decodeCsvBuffer } from '../lib/carteImport.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import { pairSumUpReader, unpairSumUpReader } from '../lib/paymentsApi.js'

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
        <h3>Pagamenti</h3>
        <ToggleRow
          label="Pagamento online (SumUp)"
          desc="Il cliente può pagare con carta dal suo telefono al momento dell'ordine."
          checked={settings.payments_online_enabled}
          onChange={(v) => save({ payments_online_enabled: v })}
        />
        {settings.payments_online_enabled && (
          <>
            <ToggleRow
              label="Pagamento obbligatorio"
              desc="L'ordine entra in coda solo dopo il pagamento online."
              checked={settings.payments_online_required}
              onChange={(v) => save({ payments_online_required: v })}
            />
            {!settings.payments_online_required && (
              <ToggleRow
                label="Senza pagamento, ritiro al banco"
                desc={
                  settings.service_mode === 'tavolo'
                    ? 'Con servizio solo al tavolo non si applica: chi non paga online paga allo staff alla consegna.'
                    : 'Chi sceglie di pagare al bancone deve ritirare al banco (niente servizio al tavolo).'
                }
                checked={settings.banco_required_if_unpaid}
                onChange={(v) => save({ banco_required_if_unpaid: v })}
              />
            )}
          </>
        )}
        <ToggleRow
          label="Lettore SumUp Solo"
          desc="Incasso col lettore di carte direttamente dalla coda ordini (Cloud API, lettore in Wi-Fi)."
          checked={settings.payments_reader_enabled}
          onChange={(v) => save({ payments_reader_enabled: v })}
        />
        {settings.payments_reader_enabled && <ReaderPairing settings={settings} />}
      </div>

      <div className="card settings-section">
        <h3>Gruppi di ordini</h3>
        <ToggleRow
          label="Abilita i gruppi"
          desc="Raggruppa gli ordini in contenitori (es. tavolata, cliente): ogni cliente registrato ha il suo gruppo."
          checked={settings.groups_enabled}
          onChange={(v) => save({ groups_enabled: v })}
        />
        {settings.groups_enabled && (
          <>
            <ToggleRow
              label="Mostra nel menu laterale"
              desc="Quadratini dei gruppi nel drawer per avviare un ordine già associato."
              checked={settings.groups_in_drawer}
              onChange={(v) => save({ groups_in_drawer: v })}
            />
            <ToggleRow
              label="Pannello gruppi nella coda"
              desc="Pannello a scomparsa nella coda ordini con i gruppi e i loro conti."
              checked={settings.groups_in_queue}
              onChange={(v) => save({ groups_in_queue: v })}
            />
          </>
        )}
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
        <h3>Account clienti</h3>
        <ToggleRow
          label="Login e registrazione clienti"
          desc="Se disattivato, il link «Accedi» e la registrazione spariscono dal lato cliente; lo staff continua ad accedere da /bar."
          checked={settings.customer_accounts_enabled}
          onChange={(v) => save({ customer_accounts_enabled: v })}
        />
      </div>

      <div className="card settings-section">
        <h3>Posizione locale</h3>
        <ToggleRow
          label="Posizione obbligatoria per ordinare"
          desc="Il cliente deve trovarsi nei pressi del locale: senza localizzazione attiva non può ordinare. Lo staff è esente."
          checked={settings.geofence_enabled}
          onChange={(v) => save({ geofence_enabled: v })}
        />
        {settings.geofence_enabled && (
          <>
            <label htmlFor="venue-addr">Indirizzo del locale</label>
            <input
              id="venue-addr"
              type="text"
              placeholder="es. Via Roma 1, Nola"
              defaultValue={settings.venue_address}
              onBlur={(e) => save({ venue_address: e.target.value.trim() })}
            />
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="venue-lat">Latitudine</label>
                <input
                  id="venue-lat"
                  type="number"
                  step="0.000001"
                  defaultValue={settings.venue_lat ?? ''}
                  onBlur={(e) => save({ venue_lat: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
              <div>
                <label htmlFor="venue-lng">Longitudine</label>
                <input
                  id="venue-lng"
                  type="number"
                  step="0.000001"
                  defaultValue={settings.venue_lng ?? ''}
                  onBlur={(e) => save({ venue_lng: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="toggle-row">
              <span>Raggio consentito (metri)</span>
              <AmountInput
                value={settings.venue_radius_m}
                min={10}
                max={5000}
                step={10}
                onCommit={(v) => save({ venue_radius_m: v })}
              />
            </div>
            <button
              className="btn secondary block"
              type="button"
              onClick={() => {
                navigator.geolocation?.getCurrentPosition(
                  (pos) =>
                    save({
                      venue_lat: Number(pos.coords.latitude.toFixed(6)),
                      venue_lng: Number(pos.coords.longitude.toFixed(6)),
                    }),
                  () => setError('Posizione non disponibile: inserisci le coordinate a mano.')
                )
              }}
            >
              📍 Usa la mia posizione attuale
            </button>
            {settings.venue_lat == null && (
              <p className="muted small" style={{ margin: '8px 0 0' }}>
                ⚠️ Senza coordinate il controllo non è attivo.
              </p>
            )}
          </>
        )}
      </div>

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

// Pairing del lettore SumUp Solo: il codice si genera dal lettore
// (Menu → Connessioni → API). L'associazione la fa una Cloud Function
// (la chiave API non passa mai dal client); lo stato arriva dai settings.
function ReaderPairing({ settings }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmUnpair, setConfirmUnpair] = useState(false)

  async function associa() {
    setBusy(true)
    setError(null)
    try {
      const res = await pairSumUpReader(code.trim())
      if (res.unavailable) {
        setError('Non disponibile in ambiente di sviluppo (nessuna Cloud Function).')
      } else {
        setCode('')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function dissocia() {
    setConfirmUnpair(false)
    setBusy(true)
    setError(null)
    try {
      await unpairSumUpReader()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      {error && <div className="banner">Errore: {error}</div>}
      {settings.sumup_reader_id ? (
        <div className="toggle-row">
          <div>
            <div>📟 {settings.sumup_reader_name || 'Lettore SumUp'}</div>
            <div className="desc">Lettore associato e pronto all&apos;incasso.</div>
          </div>
          <button className="btn ghost small" disabled={busy} onClick={() => setConfirmUnpair(true)}>
            Dissocia
          </button>
        </div>
      ) : (
        <>
          <p className="muted small" style={{ margin: '0 0 8px' }}>
            Sul lettore: Menu → Connessioni → API → genera il codice di
            pairing e inseriscilo qui (vale 5 minuti).
          </p>
          <div className="row" style={{ gap: 8 }}>
            <input
              type="text"
              placeholder="Codice di pairing"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ textTransform: 'uppercase' }}
            />
            <button
              className="btn small"
              disabled={busy || !code.trim()}
              onClick={associa}
              style={{ flexShrink: 0 }}
            >
              {busy ? 'Associo…' : '🔗 Associa'}
            </button>
          </div>
        </>
      )}
      {confirmUnpair && (
        <ConfirmDialog
          title="Dissociare il lettore?"
          message="Per usarlo di nuovo servirà un nuovo codice di pairing."
          confirmLabel="Dissocia"
          danger
          onCancel={() => setConfirmUnpair(false)}
          onConfirm={dissocia}
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
