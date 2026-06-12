// Caricamento (una sola volta) del Payment Widget di SumUp e mount del
// form carta. Il widget gestisce carte / Apple Pay / Google Pay senza
// che i dati passino mai dalla nostra app (PCI a carico di SumUp).
const SDK_URL = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js'

let sdkPromise = null

export function loadSumUpSdk() {
  if (window.SumUpCard) return Promise.resolve(window.SumUpCard)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => {
      if (window.SumUpCard) resolve(window.SumUpCard)
      else reject(new Error('SDK SumUp non disponibile.'))
    }
    script.onerror = () => {
      sdkPromise = null
      reject(new Error('Impossibile caricare il modulo di pagamento.'))
    }
    document.head.appendChild(script)
  })
  return sdkPromise
}

// Monta il widget nel nodo `el`. onResponse(type, body) riceve gli esiti
// ('success' | 'error' | 'fail' | …): al termine va SEMPRE verificato lo
// stato lato server (getPaymentStatus), mai fidarsi solo del widget.
export async function mountCardWidget({ checkoutId, el, onResponse }) {
  const SumUpCard = await loadSumUpSdk()
  return SumUpCard.mount({
    id: el.id,
    checkoutId,
    locale: 'it-IT',
    showFooter: false,
    onResponse,
  })
}
