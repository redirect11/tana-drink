import { useEffect, useRef, useState } from 'react'
import { formatPrice } from '../lib/orderStatus.js'
import { createPaymentCheckout, getPaymentStatus } from '../lib/paymentsApi.js'
import { mountCardWidget } from '../lib/sumupWidget.js'

// Pannello di pagamento online sulla pagina ordine: crea il checkout
// SumUp e monta il Payment Widget. L'esito del widget viene SEMPRE
// ri-verificato lato server; l'aggiornamento dell'ordine arriva poi in
// tempo reale dallo snapshot Firestore.
export default function PaymentPanel({ order }) {
  const [phase, setPhase] = useState('idle') // idle|loading|widget|verifying|error|unavailable
  const [error, setError] = useState(null)
  const widgetRef = useRef(null)
  const cardRef = useRef(null)

  const failed = order.payment_status === 'fallito'

  async function startPayment() {
    setPhase('loading')
    setError(null)
    try {
      const res = await createPaymentCheckout(order.id)
      if (res.unavailable) {
        setPhase('unavailable')
        return
      }
      if (res.alreadyPaid) {
        setPhase('idle') // lo snapshot realtime aggiornerà la pagina
        return
      }
      setPhase('widget')
      // Il contenitore esiste solo dopo il render della fase 'widget'.
      requestAnimationFrame(async () => {
        try {
          widgetRef.current = await mountCardWidget({
            checkoutId: res.checkoutId,
            el: cardRef.current,
            onResponse: async (type) => {
              if (type !== 'sent') {
                setPhase('verifying')
                await getPaymentStatus(order.id).catch(() => {})
                setPhase('idle')
              }
            },
          })
        } catch (e) {
          setError(e.message)
          setPhase('error')
        }
      })
    } catch (e) {
      setError(e.message)
      setPhase('error')
    }
  }

  // Smonta il widget quando il pannello sparisce (ordine pagato/annullato).
  useEffect(() => {
    return () => {
      try {
        widgetRef.current?.unmount?.()
      } catch {
        /* niente */
      }
    }
  }, [])

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h3 style={{ marginTop: 0 }}>💳 Pagamento</h3>

      {order.payment_required && (
        <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
          ⏳ Il tuo ordine entra in coda appena completato il pagamento.
        </p>
      )}

      {failed && phase === 'idle' && (
        <div className="banner" style={{ textAlign: 'left' }}>
          ❌ Il pagamento non è andato a buon fine. Riprova
          {order.payment_required ? '' : ' o paga al bancone'}.
        </div>
      )}

      {(phase === 'idle' || phase === 'error') && (
        <>
          {phase === 'error' && (
            <div className="banner" style={{ textAlign: 'left' }}>
              {error}
              {!order.payment_required &&
                ' Puoi comunque pagare al bancone al ritiro.'}
            </div>
          )}
          <button className="btn block" onClick={startPayment}>
            💳 {failed ? 'Riprova il pagamento' : `Paga ora ${formatPrice(order.total)}`}
          </button>
        </>
      )}

      {phase === 'loading' && <p className="muted">Preparo il pagamento…</p>}
      {phase === 'verifying' && <p className="muted">Verifico il pagamento…</p>}
      {phase === 'unavailable' && (
        <p className="muted" style={{ fontSize: '0.88rem' }}>
          Il pagamento online non è al momento disponibile
          {order.payment_required
            ? ': riprova tra poco o chiedi al bancone.'
            : ': puoi pagare al bancone al ritiro.'}
        </p>
      )}

      {/* Contenitore del widget carta (sempre presente in fase widget). */}
      <div
        id="sumup-card"
        ref={cardRef}
        style={{ display: phase === 'widget' ? 'block' : 'none', marginTop: 8 }}
      />
    </div>
  )
}
