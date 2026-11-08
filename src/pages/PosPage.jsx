import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OrderPosDetail from '../components/OrderPosDetail.jsx'
import Caricamento from '../components/Caricamento.jsx'
import AvvisoPiano from '../components/AvvisoPiano.jsx'
import { subscribeSettings, settingsIniziali } from '../lib/api.js'
import { maxContiAperti, puoAprireConto, MESSAGGI_PIANO } from '../lib/limiti.js'
import { useContiAperti } from '../lib/useContiAperti.js'

// ── POS cassa: CREAZIONE di un ordine nuovo ────────────────────────────────
// Stessa identica schermata della modifica: un solo componente
// (OrderPosDetail) che senza `order` lavora in creazione. Vedi lì la logica.
//
// A CASSA CHIUSA SI BATTE LO STESSO (REQ-CASSA-017): il conto nasce, si
// numera sulla giornata (REQ-ORD-016) e le comande partono; quello che
// aspetta la cassa è l'incasso, e lo spegne il pagamento (PaymentScreen).
// Prima qui c'era un cartello «Cassa chiusa» al posto del conto.
//
// I CONTI APERTI DEL PIANO FREE (REQ-LIC-003): con `conti_aperti_max` nella
// licenza, oltre quel numero di conti aperti insieme non se ne apre un
// altro. Si decide QUI, all'ingresso, e una volta sola: dentro la schermata
// il conto nasce alla prima riga e la sua bozza non si perde mai — un
// blocco a metà battuta butterebbe quello che si è appena scritto. E il
// conto appena nato, che fa salire il numero, non deve chiudere la porta a
// chi lo sta battendo. Senza limiti nella licenza non si conta niente.
export default function PosPage() {
  const [impostazioni, setImpostazioni] = useState(settingsIniziali)
  useEffect(() => subscribeSettings(setImpostazioni, () => {}), [])
  const max = maxContiAperti(impostazioni)
  const aperti = useContiAperti(impostazioni)
  const [pieno, setPieno] = useState(null)
  useEffect(() => {
    if (pieno !== null) return
    // Senza limite la schermata si apre subito, e da lì in poi resta: se
    // le impostazioni fresche portassero un limite a conto già in mano, non
    // si toglie la schermata da sotto le dita di chi sta battendo.
    if (max == null) {
      setPieno(false)
      return
    }
    if (aperti == null) return
    setPieno(!puoAprireConto(impostazioni, aperti))
  }, [pieno, max, aperti, impostazioni])

  if (pieno === null && max != null) return <Caricamento testo="Apro il conto…" />
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
