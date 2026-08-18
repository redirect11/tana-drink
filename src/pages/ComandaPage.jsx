import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import {
  advanceComanda,
  preparazioneParziale,
  setOrderServiceMode,
  settingsIniziali,
  subscribeOrder,
  subscribeSettings,
} from '../lib/api.js'
import {
  comandaNataDallaDivisione,
  dividiComanda,
  statoComandaNuova,
} from '../lib/comande.js'
import { useComandeLocali } from '../lib/comandeLocali.js'
import { ORDER_STATUSES } from '../lib/orderStatus.js'
import { mondoConsegna } from '../lib/consegna.js'
import { isGestore } from '../lib/ruoli.js'
import { showToast } from '../lib/toast.js'
import { printComanda } from '../lib/printer.js'
import Caricamento from '../components/Caricamento.jsx'
import ComandaDetail from '../components/ComandaDetail.jsx'

// ── LA SCHERMATA DI UNA COMANDA ──────────────────────────────────────
//
// Ci si arriva toccando la card in coda, nella vista del banco. È una
// pagina sua e non un riquadro sopra la coda perché al banco ci si torna:
// si apre, si guarda cosa manca, si preme, si torna indietro — e con un
// indirizzo suo il tasto «indietro» del telefono fa la cosa giusta.
//
// Da qui si risale sempre al CONTO: incassare e aggiungere righe sono cose
// del conto, e stanno nella sua schermata. La preparazione parziale no:
// quella si decide guardando il ticket, ed è qui che sta chi lo guarda.

export default function ComandaPage() {
  const { id, comandaId } = useParams()
  const navigate = useNavigate()
  // «?dividi=1» arriva dal ⋯ della card: apre subito il riquadro delle
  // quantità, che chi ha scelto quella voce ha già deciso.
  const [cerca] = useSearchParams()
  const [order, setOrder] = useState(undefined) // undefined = si carica
  const [error, setError] = useState(null)
  // Quello che si è appena premuto, finché il server non lo racconta: al
  // banco un gesto che non si vede subito è un gesto che si ripete. La
  // copia locale è quella di tutti (lib/comandeLocali.js).
  const comandeLocali = useComandeLocali(order ? [order] : [])
  // La comanda che si è appena divisa: NON è una copia locale, è una
  // navigazione in attesa — si aspetta che dalla divisione nasca il pezzo
  // da preparare, e ci si va sopra. Vedi sotto.
  const [divisa, setDivisa] = useState(null)
  const [settings, setSettings] = useState(settingsIniziali)
  // Chi sta guardando: la comanda è il lavoro del banco, e chi non lo
  // gestisce non ci ha niente da fare. `undefined` finché non si sa — non
  // si manda via nessuno prima di aver letto il ruolo.
  const [gestore, setGestore] = useState(undefined)

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (!u) return setGestore(false)
        try {
          const token = await u.getIdTokenResult()
          setGestore(isGestore(token.claims.role))
        } catch {
          setGestore(false)
        }
      }),
    []
  )

  useEffect(() => subscribeSettings(setSettings), [])

  useEffect(() => {
    if (!id) return undefined
    return subscribeOrder(
      id,
      (o) => setOrder(o),
      (e) => setError(e.message)
    )
  }, [id])

  // QUELLO CHE VEDE È QUELLO CHE HA APPENA FATTO: la comanda si pesca
  // dall'array come lo vede questo terminale, non da quello del server.
  const comanda = comandeLocali.comandeDi(order).find((c) => c.id === comandaId) || null

  // DOPO UNA DIVISIONE, QUESTA COMANDA NON ESISTE PIÙ: al suo posto ne
  // nascono due, e chi ha appena diviso ha in mano la prima — quella che ha
  // detto di preparare adesso. Ci si va sopra, e SI SOSTITUISCE il passo
  // nella storia del browser: «indietro» deve riportare alla coda, non a un
  // ticket che non c'è più.
  //
  // Non si aspetta il server: la scrittura entra in cache e lo snapshot
  // arriva da sé un istante dopo, anche senza linea. È lo stesso motivo per
  // cui non si calcola qui il numero della comanda nuova — lo decide chi
  // scrive, e indovinarlo da fuori vorrebbe dire avere due regole.
  useEffect(() => {
    if (!divisa) return
    const nata = comandaNataDallaDivisione(order, divisa)
    if (!nata) return
    setDivisa(null)
    navigate(`/ordine/${id}/comanda/${nata.id}`, { replace: true })
  }, [order, divisa, id, navigate])

  if (error) return <div className="banner">Errore: {error}</div>
  // Chi non gestisce va sul CONTO: quella pagina sa già cosa far vedere a
  // ognuno, e mandarci chi capita qui per sbaglio è meglio di un «non
  // puoi» davanti a un ordine che magari è il suo.
  if (gestore === false) return <Navigate to={`/ordine/${id}`} replace />
  if (order === undefined || gestore === undefined) return <Caricamento testo="Apro la comanda…" />
  if (!order) return <div className="empty">Questo conto non c’è più.</div>

  // DIVISIONE APPENA PARTITA: la comanda di prima c'è ancora (annullata)
  // finché non arriva lo snapshot, ma se sparisse del tutto non si sbatte
  // in faccia «non c'è più» a chi ha appena premuto — si aspetta il
  // pezzo nuovo, che sta arrivando.
  if (!comanda && divisa) return <Caricamento testo="Divido la comanda…" />

  if (!comanda) {
    // Comanda sparita (conto rifatto, divisione): non si lascia una pagina
    // vuota, si manda dove la risposta c'è di sicuro.
    return (
      <div className="empty">
        Questa comanda non c’è più.{' '}
        <button className="btn small" onClick={() => navigate(`/ordine/${id}`)}>
          Apri il conto
        </button>
      </div>
    )
  }
  const porta = (stato) => {
    const adesso = new Date().toISOString()
    comandeLocali.applica(order, (comande) =>
      comande.map((c) =>
        c.id === comanda.id
          ? { ...c, status: stato, status_times: { ...(c.status_times || {}), [stato]: adesso } }
          : c
      )
    )
    advanceComanda(order.id, comanda.id, stato).catch((e) => {
      comandeLocali.scarta(order.id)
      showToast(`⚠️ Avanzamento non riuscito: ${e.message}`, { kind: 'error' })
    })
  }

  // DIVIDERE. Le quantità le conta `dividiComanda` e a scrivere è
  // `preparazioneParziale`: sono le stesse del conto, e restano le uniche —
  // due posti che dividono una comanda in due modi diversi sono due modi
  // diversi di sbagliare il conto.
  const dividi = (scelte) => {
    const esito = dividiComanda(comanda, scelte)
    if (!esito) return
    // Prese TUTTE le unità non c'è niente da dividere: la comanda avanza e
    // basta, e resta questa. Si vede subito, come col tasto grande.
    // Prese TUTTE le unità non c'è niente da dividere: la comanda avanza e
    // basta, e resta questa. La scrittura la fa preparazioneParziale qui
    // sotto — qui si segna solo quello che si deve già vedere.
    if (esito.tutta) {
      const adesso = new Date().toISOString()
      comandeLocali.applica(order, (comande) =>
        comande.map((c) =>
          c.id === comanda.id
            ? {
                ...c,
                status: ORDER_STATUSES.IN_PREPARAZIONE,
                status_times: {
                  ...(c.status_times || {}),
                  [ORDER_STATUSES.IN_PREPARAZIONE]: adesso,
                },
              }
            : c
        )
      )
    } else setDivisa(comanda.id)
    preparazioneParziale(order.id, comanda.id, scelte).catch((e) => {
      comandeLocali.scarta(order.id)
      setDivisa(null)
      showToast(`⚠️ Divisione non riuscita: ${e.message}`, { kind: 'error' })
    })
  }

  return (
    <ComandaDetail
      order={order}
      comanda={comanda}
      workflowOn={settings.workflow_enabled !== false}
      passoDiNascita={statoComandaNuova(settings)}
      ritiroEsiste={mondoConsegna(settings) === 'entrambi'}
      senzaSupplementi={!settings.coperto_enabled && !settings.service_charge_enabled}
      onCambiaConsegna={(modo) =>
        setOrderServiceMode(order.id, modo).catch((e) =>
          showToast(`⚠️ Modo non cambiato: ${e.message}`, { kind: 'error' })
        )
      }
      onAvanza={porta}
      onTornaA={porta}
      onDividi={dividi}
      onApriConto={() => navigate(`/ordine/${order.id}`)}
      onIndietro={() => navigate('/bar')}
      dividiSubito={cerca.get('dividi') === '1'}
      onStampa={() =>
        printComanda(order, comanda).catch((e) =>
          showToast(`⚠️ Stampa non riuscita: ${e.message}`, { kind: 'error' })
        )
      }
    />
  )
}
