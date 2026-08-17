import { useEffect, useState } from 'react'
import { statoPush, getPushToken } from '../lib/push.js'
import { ensureNotificationPermission } from '../lib/notify.js'
import { saveStaffToken } from '../lib/api.js'
import { idDispositivo } from '../lib/dispositivo.js'
import { auth } from '../lib/firebaseClient.js'

// ── «GLI AVVISI SONO SPENTI SU QUESTO DISPOSITIVO» ───────────────────
//
// Il permesso alle notifiche lo chiede il browser, una volta, con una
// finestrella che compare in alto: chi sta lavorando la scarta senza
// leggerla, e da quel momento quel tablet non suona più. Nessuno se ne
// accorge finché non manca un ordine.
//
// Perciò questo avviso RITORNA. Non c'è «non mostrare più»: finché gli
// avvisi sono spenti la riga resta lì, e ogni volta che si rifiuta per
// sbaglio ricompare — è esattamente il caso che deve coprire. Sparisce
// quando gli avvisi funzionano, e allora questo dispositivo si registra
// subito per riceverli.
//
// Non è una finestra modale: al banco non si blocca il lavoro per una
// impostazione. È una riga in cima, che si vede e non si può ignorare.
export default function AvvisiSpenti({ ruolo }) {
  const [stato, setStato] = useState(null)
  const [rifiutato, setRifiutato] = useState(false)

  useEffect(() => {
    let vivo = true
    const guarda = () => statoPush().then((s) => vivo && setStato(s))
    guarda()
    // Il permesso si può cambiare dalle impostazioni del browser senza
    // passare da qui: tornando sull'app si ricontrolla.
    window.addEventListener('focus', guarda)
    return () => {
      vivo = false
      window.removeEventListener('focus', guarda)
    }
  }, [])

  if (!ruolo) return null
  if (stato !== 'da-permettere' && stato !== 'negato') return null

  const chiedi = async () => {
    const ok = await ensureNotificationPermission()
    setRifiutato(!ok)
    const nuovo = await statoPush()
    setStato(nuovo)
    // Appena si può, ci si registra: senza, l'avviso resterebbe spento
    // fino al prossimo giro nella coda.
    if (nuovo === 'ok') {
      const uid = auth.currentUser?.uid
      const token = await getPushToken()
      if (uid && token) saveStaffToken(uid, token, ruolo, idDispositivo()).catch(() => {})
    }
  }

  return (
    <div className="banner avvisi-spenti">
      <div>
        <strong>🔕 Gli avvisi sono spenti su questo dispositivo.</strong>
        <div className="small">
          {stato === 'negato'
            ? 'Il browser li ha bloccati: si riaccendono dalle sue impostazioni, alla voce Notifiche per questo sito.'
            : rifiutato
              ? 'Non sono stati attivati. Riprova: senza, qui non arriva nessun ordine.'
              : 'Nuovi ordini e chiamate non arrivano finché non li attivi.'}
        </div>
      </div>
      {stato !== 'negato' && (
        <button type="button" className="btn small" onClick={chiedi}>
          Attiva gli avvisi
        </button>
      )}
    </div>
  )
}
