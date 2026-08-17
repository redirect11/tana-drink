import { useEffect, useState } from 'react'
import { auth } from '../lib/firebaseClient.js'
import {
  avvisiPerRuolo,
  avvisoAttivo,
  leggiAvvisi,
  scriviAvviso,
  subscribeAvvisi,
} from '../lib/preferenzeNotifiche.js'
import {
  stileAvvisiInApp,
  scegliStileAvvisi,
  subscribeStileAvvisi,
} from '../lib/avvisiInApp.js'

// ── QUALI AVVISI VOGLIO ARRIVINO QUI ─────────────────────────────────
// Sta nel PROFILO e non nelle impostazioni del locale: la scelta è per
// persona e per dispositivo (`tana:avvisi:<uid>`), non una regola del bar.
// E soprattutto: le impostazioni le vede solo chi gestisce, mentre chi è in
// sala — quello a cui serve davvero sapere quando un drink è pronto — non
// ha quel menu. Lì gli avvisi erano fuori portata proprio per chi li usa.
export default function AvvisiPanel({ gestore }) {
  const uid = auth.currentUser?.uid
  const [avvisi, setAvvisi] = useState(() => leggiAvvisi(uid))
  useEffect(() => subscribeAvvisi(uid, setAvvisi), [uid])
  // DOVE compaiono, oltre a QUALI arrivano: stessa natura, stesso posto.
  const [stile, setStile] = useState(stileAvvisiInApp)
  useEffect(() => subscribeStileAvvisi(setStile), [])
  const elenco = avvisiPerRuolo(gestore)
  const spenti = elenco.filter((a) => !avvisoAttivo(avvisi, a.id)).length

  return (
    <div className="card settings-section">
      <h3>🔔 Notifiche</h3>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
        Valgono <strong>su questo dispositivo</strong> e per te: il tablet della
        cassa e il telefono in sala possono volere avvisi diversi, anche con lo
        stesso accesso. Chi manda un ordine non riceve l&apos;avviso di
        quell&apos;ordine: sa già di averlo mandato.
      </p>
      {elenco.map((a) => (
        <ToggleRow
          key={a.id}
          label={a.label}
          desc={a.desc}
          checked={avvisoAttivo(avvisi, a.id)}
          onChange={(v) => setAvvisi(scriviAvviso(uid, a.id, v))}
        />
      ))}
      {/* DOVE COMPAIONO, ad app aperta. La strisciolina non si perde ma
          interrompe: arriva mentre stai battendo un conto o contando la
          cassa. Il fumetto sta solo nella coda ordini — che è il posto dove
          gli ordini si aspettano — e toccandolo apre gli avvisi. */}
      <h4 style={{ margin: '16px 0 4px' }}>Dove compaiono, ad app aperta</h4>
      <div className="mode-choice">
        {[
          ['toast', '🔔 In alto, ovunque'],
          ['fumetto', '💬 Dalla campanella, solo in coda'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={`mode-option${stile === value ? ' active' : ''}`}
            onClick={() => setStile(scegliStileAvvisi(value))}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted small" style={{ margin: '8px 0 0' }}>
        {stile === 'fumetto'
          ? 'Fuori dalla coda non compare niente: gli avvisi restano nella campanella, col loro numero.'
          : 'La strisciolina compare su qualunque schermata, anche in cassa o in magazzino.'}
      </p>

      {spenti > 0 && (
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          {spenti === 1 ? 'Un avviso è spento' : `${spenti} avvisi sono spenti`} su
          questo dispositivo: quello che succede lo vedi comunque nella coda,
          ma nessuno te lo verrà a dire.
        </p>
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
