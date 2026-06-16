import { useState } from 'react'
import {
  loadPrinterSettings,
  savePrinterSettings,
  printTest,
  disconnectPrinter,
  DEFAULT_PRINTER_SETTINGS,
} from '../lib/printer.js'

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
      setForm((f) => ({ ...f, [key]: val }))
      setSaved(false)
      setTestResult(null)
    }
  }

  function handleSave(e) {
    e.preventDefault()
    savePrinterSettings(form)
    disconnectPrinter() // forza riconnessione con nuovi parametri
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleTest() {
    savePrinterSettings(form)
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
          Porta 8043 + HTTPS attivo = connessione sicura (necessario con app in HTTPS).
        </p>
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
