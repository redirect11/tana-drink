import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../lib/firebaseClient.js'
import { advanceComanda, subscribeOrder } from '../lib/api.js'
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
// Da qui si risale sempre al CONTO: incassare, aggiungere righe, dividere
// sono cose del conto, e stanno nella sua schermata.

export default function ComandaPage() {
  const { id, comandaId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(undefined) // undefined = si carica
  const [error, setError] = useState(null)
  // Lo stato appena premuto, finché il server non lo racconta: al banco un
  // gesto che non si vede subito è un gesto che si ripete.
  const [statoLocale, setStatoLocale] = useState(null)
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

  useEffect(() => {
    if (!id) return undefined
    return subscribeOrder(
      id,
      (o) => setOrder(o),
      (e) => setError(e.message)
    )
  }, [id])

  // QUELLO CHE VEDE È QUELLO CHE HA APPENA FATTO. L'override se ne va
  // quando dal server arriva lo stesso stato: toglierlo subito farebbe
  // riapparire per un istante quello di prima (il tasto «rimbalza»).
  const comandaVera = (order?.comande || []).find((c) => c.id === comandaId) || null
  useEffect(() => {
    if (statoLocale && comandaVera?.status === statoLocale) setStatoLocale(null)
  }, [comandaVera?.status, statoLocale])

  if (error) return <div className="banner">Errore: {error}</div>
  // Chi non gestisce va sul CONTO: quella pagina sa già cosa far vedere a
  // ognuno, e mandarci chi capita qui per sbaglio è meglio di un «non
  // puoi» davanti a un ordine che magari è il suo.
  if (gestore === false) return <Navigate to={`/ordine/${id}`} replace />
  if (order === undefined || gestore === undefined) return <Caricamento testo="Apro la comanda…" />
  if (!order) return <div className="empty">Questo conto non c’è più.</div>

  if (!comandaVera) {
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
  const comanda = statoLocale ? { ...comandaVera, status: statoLocale } : comandaVera

  const porta = (stato) => {
    setStatoLocale(stato)
    advanceComanda(order.id, comanda.id, stato).catch((e) => {
      setStatoLocale(null)
      showToast(`⚠️ Avanzamento non riuscito: ${e.message}`, { kind: 'error' })
    })
  }

  return (
    <ComandaDetail
      order={order}
      comanda={comanda}
      onAvanza={porta}
      onTornaA={porta}
      onApriConto={() => navigate(`/ordine/${order.id}`)}
      onIndietro={() => navigate('/bar')}
      onStampa={() =>
        printComanda(order, comanda).catch((e) =>
          showToast(`⚠️ Stampa non riuscita: ${e.message}`, { kind: 'error' })
        )
      }
    />
  )
}
