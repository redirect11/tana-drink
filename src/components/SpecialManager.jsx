import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { subscribeSettings, updateSettings, DEFAULT_SETTINGS } from '../lib/api.js'
import { drinkSpeciali, immagineVoce, PERCORSO_SPECIALI } from '../lib/speciali.js'
import { formatPrice } from '../lib/orderStatus.js'
import { disegniDelLocale } from '../lib/stileMenu.js'
import { useFondoChiaro } from '../lib/useFondoChiaro.js'
import ToggleRow from './ToggleRow.jsx'
import Icona from './Icona.jsx'

// IL MENÙ SPECIAL, DAL GESTIONALE (REQ-MENU-018): il titolo e il
// sottotitolo della pagina, gli special segnati, e il QR da stampare sul
// menù che si porta al tavolo. Il QR dei tavoli resta quello di sempre e
// apre il menù normale, col carosello degli Special in cima.
export default function SpecialManager({ drinks, onEdit }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  const [titolo, setTitolo] = useState(null)
  const [sottotitolo, setSottotitolo] = useState(null)
  const indirizzo = `${window.location.origin}${PERCORSO_SPECIALI}`
  const [qr, setQr] = useState(null)
  useEffect(() => {
    let vivo = true
    QRCode.toDataURL(indirizzo, { margin: 2, width: 480 })
      .then((u) => vivo && setQr(u))
      .catch(() => vivo && setQr(null))
    return () => {
      vivo = false
    }
  }, [indirizzo])

  const speciali = drinkSpeciali(drinks)
  const fondoChiaro = useFondoChiaro()
  const disegni = disegniDelLocale(settings)
  const salva = (campo, valore) => updateSettings({ [campo]: valore.trim() }).catch(() => {})

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><Icona nome="special" gruppo="tasti" /> Menù Special</h3>
      <p className="muted small" style={{ margin: '0 0 10px' }}>
        Le voci segnate come «Drink speciale» nella loro scheda. Il QR qui sotto apre solo il menù Special; il QR
        dei tavoli apre il menù completo, con gli Special in cima.
      </p>

      <ToggleRow
        label="Menù Special attivo"
        desc="Carosello degli special in cima al menù dei clienti e pagina dedicata, raggiungibile col QR qui sotto. Disattivato, i drink speciali compaiono soltanto nelle sezioni del menù a cui appartengono."
        checked={settings.special_attivo !== false}
        onChange={(v) => updateSettings({ special_attivo: v }).catch(() => {})}
      />

      <label htmlFor="special-titolo">Titolo</label>
      <input
        id="special-titolo"
        value={titolo ?? settings.special_titolo ?? ''}
        onChange={(e) => setTitolo(e.target.value)}
        onBlur={(e) => salva('special_titolo', e.target.value)}
        placeholder="Special"
      />
      <label htmlFor="special-sottotitolo">Sottotitolo</label>
      <input
        id="special-sottotitolo"
        value={sottotitolo ?? settings.special_sottotitolo ?? ''}
        onChange={(e) => setSottotitolo(e.target.value)}
        onBlur={(e) => salva('special_sottotitolo', e.target.value)}
        placeholder="Alice nel Paese delle Meraviglie"
      />

      <h4 style={{ margin: '14px 0 6px' }}>Drink speciali ({speciali.length})</h4>
      {speciali.length === 0 ? (
        <p className="muted small">
          Nessun drink speciale: si segnano dalla scheda della voce, con «Drink speciale». Finché non ce ne sono, il
          QR del menù Special porta al menù completo.
        </p>
      ) : (
        <div className="inv-list">
          {speciali.map((d) => {
            const img = immagineVoce(d, import.meta.env.BASE_URL, { chiaro: fondoChiaro, disegni })
            return (
              <div className="inv-row" key={d.id}>
                <div className="inv-row-main statica">
                  {img ? <img className="special-mini" src={img} alt="" /> : <span className="special-mini" />}
                  <span className="inv-row-name">{d.name}</span>
                  <span className="muted small inv-row-price">{formatPrice(d.price)}</span>
                  <button type="button" className="btn ghost small" onClick={() => onEdit(d.id)} aria-label={`Modifica ${d.name}`}>
                    <Icona nome="modifica" gruppo="tasti" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <h4 style={{ margin: '14px 0 6px' }}>QR del menù Special</h4>
      <div className="qr-special">
        {qr && <img src={qr} alt="QR del menù Special" />}
        <div>
          <p className="muted small" style={{ margin: '0 0 8px', wordBreak: 'break-all' }}>
            {indirizzo}
          </p>
          {qr && (
            <a className="btn small" href={qr} download="qr-menu-special.png">
              Scarica il QR
            </a>
          )}{' '}
          <a className="btn ghost small" href={`${PERCORSO_SPECIALI}?vista=cliente`} target="_blank" rel="noreferrer">
            Apri il menù Special
          </a>
        </div>
      </div>
    </div>
  )
}
