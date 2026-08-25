import { useEffect, useRef, useState } from 'react'
import { auth } from '../lib/firebaseClient.js'
import { subscribeMyCalls, ackStaffCall } from '../lib/api.js'
import { notify } from '../lib/notify.js'

// ── LA CHIAMATA SI PRESENTA DOVUNQUE SI STIA GUARDANDO ───────────────
//
// Il cerca-persone viveva dentro la sezione «Da servire»: l'ascolto delle
// chiamate e il riquadro erano montati SOLO su quella scheda. Chi veniva
// chiamato con l'app in secondo piano sentiva la notifica di sistema,
// riapriva il telefono — e si ritrovava sulla coda, dove la chiamata non
// esisteva: compariva soltanto andando a mano su «Da servire». Il gesto di
// chi aveva chiamato si perdeva lì (BUG-037).
//
// Adesso l'ascolto sta in cima all'app, montato per tutto il tempo in cui
// c'è qualcuno dello staff collegato: la chiamata in sospeso è già lì al
// rientro, su qualunque schermata — coda, conto, cassa — e non serve
// navigare per farla saltare fuori.
//
// Il riquadro copre lo schermo apposta: una chiamata al bancone è la sola
// cosa che vale interrompere quello che si sta facendo, e si chiude
// rispondendo.

// Vibrazione "cerca-persone": forte e riconoscibile. Lo stesso pattern lo
// usano il service worker (public/sw.js) e la Cloud Function.
const VIBRAZIONE = [500, 200, 500, 200, 900]

export default function ChiamataInArrivo({ ruolo }) {
  const [calls, setCalls] = useState([])
  const [errore, setErrore] = useState(null)
  const vibrateTimer = useRef(null)

  // `ruolo` arriva valorizzato solo dopo che l'accesso è andato a buon
  // fine: quando c'è, `auth.currentUser` c'è di sicuro.
  useEffect(() => {
    if (!ruolo) return setCalls([])
    const uid = auth.currentUser?.uid
    if (!uid) return
    return subscribeMyCalls(uid, setCalls)
  }, [ruolo])

  const incoming = calls[0] ?? null

  useEffect(() => {
    if (!incoming) {
      if (vibrateTimer.current) {
        clearInterval(vibrateTimer.current)
        vibrateTimer.current = null
        navigator.vibrate?.(0) // ferma la vibrazione in corso
      }
      // Chiudi anche la notifica di sistema della chiamata, se presente:
      // risposto qui, non deve restare lì a dire che c'è qualcuno che aspetta.
      navigator.serviceWorker
        ?.getRegistration?.()
        .then((reg) => reg?.getNotifications?.({ tag: 'staff-call' }))
        .then((ns) => ns?.forEach((n) => n.close()))
        .catch(() => {})
      return
    }
    // Notifica + vibrazione forte e continua finché non si risponde.
    // Stesso tag della push FCM: se arrivano entrambe, una sola notifica.
    notify('📟 Chiamata dal bancone', incoming.message || 'Rispondi sul telefono.', {
      vibrate: VIBRAZIONE,
      tag: 'staff-call',
      renotify: true,
      requireInteraction: true,
    })
    navigator.vibrate?.(VIBRAZIONE)
    vibrateTimer.current = setInterval(() => navigator.vibrate?.(VIBRAZIONE), 2600)
    return () => {
      clearInterval(vibrateTimer.current)
      vibrateTimer.current = null
      navigator.vibrate?.(0)
    }
  }, [incoming?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!incoming) return null

  const rispondi = () => {
    setErrore(null)
    // Niente `await` prima di far sparire il riquadro: chi risponde deve
    // tornare al lavoro subito, la scrittura va per conto suo.
    ackStaffCall(incoming.id).catch((e) => setErrore(e.message))
  }

  return (
    <div className="overlay confirm-overlay">
      <div className="confirm-box pager-call">
        <div className="pager-icon">📟</div>
        <h3 style={{ margin: '8px 0' }}>Chiamata dal bancone</h3>
        {incoming.from_name && (
          <p className="muted" style={{ margin: 0 }}>da {incoming.from_name}</p>
        )}
        {incoming.message && (
          <p style={{ fontSize: '1.05rem', margin: '12px 0 0' }}>«{incoming.message}»</p>
        )}
        {errore && <p className="muted small" style={{ marginTop: 10 }}>Errore: {errore}</p>}
        <button className="btn block" style={{ marginTop: 18 }} onClick={rispondi}>
          ✓ Rispondo
        </button>
      </div>
    </div>
  )
}
