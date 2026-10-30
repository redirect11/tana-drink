import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OrderPosDetail from '../components/OrderPosDetail.jsx'
import { useCashSession } from '../lib/cashSession.js'
import Caricamento from '../components/Caricamento.jsx'
import AvvisoPiano from '../components/AvvisoPiano.jsx'
import { subscribeSettings, settingsIniziali } from '../lib/api.js'
import { maxContiAperti, puoAprireConto, MESSAGGI_PIANO } from '../lib/limiti.js'
import { useContiAperti } from '../lib/useContiAperti.js'

// ── POS cassa: CREAZIONE di un ordine nuovo ────────────────────────────────
// Stessa identica schermata della modifica: un solo componente
// (OrderPosDetail) che senza `order` lavora in creazione. Vedi lì la logica.
//
// SENZA CASSA APERTA non si battono ordini: la numerazione e gli incassi
// seguono la sessione di cassa, quindi si parte da lì.
//
// I CONTI APERTI DEL PIANO FREE (REQ-LIC-003): con `conti_aperti_max` nella
// licenza, oltre quel numero di conti aperti insieme non se ne apre un
// altro. Si decide QUI, all'ingresso, e una volta sola: dentro la schermata
// il conto nasce alla prima riga e la sua bozza non si perde mai — un
// blocco a metà battuta butterebbe quello che si è appena scritto. E il
// conto appena nato, che fa salire il numero, non deve chiudere la porta a
// chi lo sta battendo. Senza limiti nella licenza non si conta niente.
export default function PosPage() {
  const { open, loading } = useCashSession()
  const [impostazioni, setImpostazioni] = useState(settingsIniziali)
  useEffect(() => subscribeSettings(setImpostazioni, () => {}), [])
  const max = maxContiAperti(impostazioni)
  const aperti = useContiAperti(impostazioni)
  const [pieno, setPieno] = useState(null)
  useEffect(() => {
    if (pieno !== null || loading || !open) return
    // Senza limite la schermata si apre subito, e da lì in poi resta: se
    // le impostazioni fresche portassero un limite a conto già in mano, non
    // si toglie la schermata da sotto le dita di chi sta battendo.
    if (max == null) {
      setPieno(false)
      return
    }
    if (aperti == null) return
    setPieno(!puoAprireConto(impostazioni, aperti))
  }, [pieno, loading, open, max, aperti, impostazioni])

  if (loading) return <Caricamento testo="Apro la cassa…" />

  if (!open) {
    return (
      <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
        <h3 style={{ marginTop: 0 }}>🔴 Cassa chiusa</h3>
        <p className="muted" style={{ margin: '8px 0 14px' }}>
          Per battere ordini bisogna prima <strong>aprire la cassa</strong>: il
          progressivo degli ordini e gli incassi della serata seguono la
          sessione di cassa.
        </p>
        <Link className="btn block" to="/bar?tab=pagamenti">
          🟢 Vai ad aprire la cassa
        </Link>
        <Link className="btn ghost small block" style={{ marginTop: 8 }} to="/bar">
          ← Torna agli ordini
        </Link>
      </div>
    )
  }

  if (pieno === null && max != null) return <Caricamento testo="Apro la cassa…" />
  if (pieno) {
    return (
      <div style={{ marginTop: 16 }}>
        <AvvisoPiano messaggio={MESSAGGI_PIANO.conti(max)} impostazioni={impostazioni} />
        <Link className="btn ghost small block" style={{ marginTop: 8 }} to="/bar">
          ← Torna agli ordini
        </Link>
      </div>
    )
  }

  return <OrderPosDetail order={null} />
}
