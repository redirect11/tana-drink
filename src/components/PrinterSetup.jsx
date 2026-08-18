import { useState } from 'react'
import {
  loadPrinterSettings,
  savePrinterSettings,
  printTest,
  disconnectPrinter,
  DEFAULT_PRINTER_SETTINGS,
} from '../lib/printer.js'
import { savePrinterConfig } from '../lib/api.js'

// Salva le impostazioni stampante sia in locale (uso immediato/offline) sia
// su server (così l'IP non si perde quando iPad/Safari svuota il localStorage).
function persistPrinter(form) {
  savePrinterSettings(form)
  savePrinterConfig(form)
}

export default function PrinterSetup() {
  const [form, setForm] = useState(() => loadPrinterSettings())
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  function set(key) {
    return (e) => {
      const val = e.target.type === 'checkbox' ? e.target.checked
        : e.target.type === 'number' ? Number(e.target.value)
        : e.target.value
      // Porta e HTTPS devono restare d'accordo: la connessione la decide la
      // PORTA (8008 = in chiaro, 8043 = sicura), quindi spuntare HTTPS senza
      // cambiare porta non avrebbe alcun effetto — e non funzionerebbe.
      setForm((f) => {
        const next = { ...f, [key]: val }
        if (key === 'https') next.port = val ? 8043 : 8008
        // Campo vuoto durante la digitazione: non si tocca il flag.
        if (key === 'port' && e.target.value !== '') next.https = Number(val) !== 8008
        return next
      })
      setSaved(false)
      setTestResult(null)
    }
  }

  function handleSave(e) {
    e.preventDefault()
    persistPrinter(form)
    disconnectPrinter() // forza riconnessione con nuovi parametri
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleTest() {
    persistPrinter(form)
    disconnectPrinter()
    setTesting(true)
    setTestResult(null)
    try {
      await printTest()
      setTestResult({ ok: true, msg: 'Stampa test inviata.' })
    } catch (e) {
      setTestResult({ ok: false, msg: e.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSave}>
      <h3 style={{ marginTop: 0 }}>Stampante termica Epson</h3>

      {/* ── Istruzioni connessione HTTPS ── */}
      <details style={{ marginBottom: 16 }}>
        <summary className="muted" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
          Come configurare (prima volta)
        </summary>
        <ol style={{ fontSize: '0.85rem', lineHeight: 1.7, paddingLeft: 18, marginTop: 8 }}>
          <li>Collega la stampante alla stessa rete Wi-Fi dell'iPad.</li>
          <li>Assegna un IP fisso alla stampante dal router (DHCP reservation).</li>
          <li>Apri <code>http://&lt;IP stampante&gt;</code> nel browser e abilita SSL/TLS
            dalle impostazioni di rete.</li>
          <li>Vai su <code>https://&lt;IP stampante&gt;:8043</code> in Safari e accetta
            il certificato (solo la prima volta).</li>
          <li>Inserisci l'IP qui sotto e premi "Test stampa".</li>
        </ol>
      </details>

      {/* ── Connessione ── */}
      <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <legend className="muted" style={{ fontSize: '0.85rem', padding: '0 6px' }}>Connessione</legend>

        <label htmlFor="prn-ip">IP stampante</label>
        <input
          id="prn-ip"
          type="text"
          inputMode="decimal"
          placeholder="es. 192.168.1.100"
          value={form.ip}
          onChange={set('ip')}
        />

        <div className="grid-2" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="prn-port">Porta</label>
            <input
              id="prn-port"
              type="number"
              value={form.port}
              onChange={set('port')}
              min={1}
              max={65535}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={form.https}
                onChange={set('https')}
              />
              <span>HTTPS (WSS)</span>
            </label>
          </div>
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', margin: '6px 0 0' }}>
          È la <strong>porta</strong> a decidere: <strong>8043</strong> = connessione
          sicura (obbligatoria con l'app in HTTPS), 8008 = in chiaro.
        </p>
        {typeof location !== 'undefined' &&
          location.protocol === 'https:' &&
          Number(form.port) === 8008 && (
            <div className="banner" style={{ marginTop: 8 }}>
              ⚠️ L'app è in HTTPS: con la porta <strong>8008</strong> il browser
              blocca la connessione e la stampa va in timeout. Usa la{' '}
              <strong>8043</strong> con SSL/TLS abilitato sulla stampante.
            </div>
          )}
      </fieldset>

      {/* ── Stampa automatica ── */}
      <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <legend className="muted" style={{ fontSize: '0.85rem', padding: '0 6px' }}>Stampa automatica</legend>

        <label className="row" style={{ gap: 10, cursor: 'pointer', marginBottom: 8 }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={form.autoPrintComanda}
            onChange={set('autoPrintComanda')}
          />
          <span>Stampa comanda automaticamente all'arrivo dell'ordine</span>
        </label>

        <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={form.autoPrintScontrino}
            onChange={set('autoPrintScontrino')}
          />
          <span>Stampa scontrino automaticamente quando l'ordine è "pronto"</span>
        </label>
      </fieldset>

      {/* ── Chi stampa le comande della sala ── */}
      <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <legend className="muted" style={{ fontSize: '0.85rem', padding: '0 6px' }}>
          Comande prese in sala
        </legend>

        {/* La sala l'IP ce l'ha (la configurazione qui sotto arriva a tutti i
            dispositivi dal server): quello che il locale decide qui è se i
            telefoni parlino con la stampante o se la comanda esca al banco. */}
        <div className="mode-choice">
          <button
            type="button"
            className={`mode-option${form.stampaSala !== 'rimbalzo' ? ' active' : ''}`}
            onClick={() => { setForm((f) => ({ ...f, stampaSala: 'ip' })); setSaved(false) }}
          >
            📱 La stampa il telefono
          </button>
          <button
            type="button"
            className={`mode-option${form.stampaSala === 'rimbalzo' ? ' active' : ''}`}
            onClick={() => { setForm((f) => ({ ...f, stampaSala: 'rimbalzo' })); setSaved(false) }}
          >
            🖨️ La stampa il banco
          </button>
        </div>

        <p className="muted" style={{ fontSize: '0.8rem', margin: '8px 0 0' }}>
          {form.stampaSala === 'rimbalzo'
            ? 'La comanda esce al banco appena arriva l’ordine. Serve che al banco un terminale tenga aperta la coda ordini con la stampa automatica accesa.'
            : 'Chi prende l’ordine al tavolo stampa la comanda dal suo telefono. La prima volta, su ogni telefono, va accettato l’avviso di sicurezza della stampante: il pallino nella coda ordini dice se funziona.'}
        </p>

        {/* Scegliere "la stampa il banco" e lasciare spenta la stampa
            automatica vuol dire: non stampa nessuno. È successo. */}
        {form.stampaSala === 'rimbalzo' && !form.autoPrintComanda && (
          <div className="banner" style={{ marginTop: 8 }}>
            ⚠️ La stampa automatica della comanda è <strong>spenta</strong>: così
            le comande della sala non le stampa nessuno. Accendila qui sopra.
          </div>
        )}
      </fieldset>

      {/* ── IVA ── */}
      <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <legend className="muted" style={{ fontSize: '0.85rem', padding: '0 6px' }}>Scontrino</legend>

        <div className="grid-2">
          <div>
            <label htmlFor="prn-iva">Aliquota IVA (%)</label>
            <input
              id="prn-iva"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={form.ivaRate}
              onChange={set('ivaRate')}
            />
          </div>
        </div>

        <label htmlFor="prn-biz" style={{ marginTop: 10 }}>Nome locale</label>
        <input id="prn-biz" value={form.businessName} onChange={set('businessName')} />

        <label htmlFor="prn-addr" style={{ marginTop: 10 }}>Indirizzo</label>
        <input id="prn-addr" value={form.businessAddress} onChange={set('businessAddress')} />

        <label htmlFor="prn-city" style={{ marginTop: 10 }}>Città / CAP</label>
        <input id="prn-city" value={form.businessCity} onChange={set('businessCity')} />

        <label htmlFor="prn-foot" style={{ marginTop: 10 }}>Footer (ragione sociale)</label>
        <input id="prn-foot" value={form.businessFooter} onChange={set('businessFooter')} />
      </fieldset>

      {testResult && (
        <div
          className={testResult.ok ? '' : 'banner'}
          style={testResult.ok
            ? { color: 'var(--green, #4caf50)', marginBottom: 10, fontSize: '0.9rem' }
            : { marginBottom: 10 }
          }
        >
          {testResult.ok ? '✓ ' : ''}{testResult.msg}
          {/* Timeout = quasi sempre certificato della stampante non ancora
              accettato su questo dispositivo: il link ci porta direttamente. */}
          {!testResult.ok && form.ip && (
            <div style={{ marginTop: 8, fontSize: '0.85rem' }}>
              Sul <strong>questo</strong> dispositivo apri una volta{' '}
              <a
                href={`https://${form.ip}:${form.port || 8043}`}
                target="_blank"
                rel="noreferrer"
              >
                https://{form.ip}:{form.port || 8043}
              </a>{' '}
              e accetta il certificato (“Avanzate → Procedi”), poi torna qui e
              ripremi <strong>Test stampa</strong>. Verifica anche che la
              stampante sia accesa, sulla <strong>stessa rete Wi-Fi</strong> e
              con SSL/TLS abilitato.
            </div>
          )}
        </div>
      )}

      <div className="grid-2">
        <button
          type="button"
          className="btn secondary"
          onClick={handleTest}
          disabled={testing || !form.ip}
        >
          {testing ? 'Test…' : '🖨 Test stampa'}
        </button>
        <button type="submit" className="btn">
          {saved ? '✓ Salvato' : 'Salva'}
        </button>
      </div>
    </form>
  )
}
