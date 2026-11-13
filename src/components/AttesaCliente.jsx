import { useEffect, useState } from 'react'
import { inAttesa, minutiRimasti } from '../lib/attesaCliente.js'

// IL CONTO ASPETTA IL CLIENTE (REQ-CLI-009): il banco ha cambiato prezzo o
// ingredienti di un ordine dal telefono, e il cliente deve accettare. Sta
// accanto al numero in ogni card della coda e nel conto, con i minuti che
// restano; a tempo scaduto la coda lo annulla (BartenderPage).
export default function AttesaCliente({ order }) {
  const attesa = inAttesa(order)
  const [adesso, setAdesso] = useState(() => Date.now())
  useEffect(() => {
    if (!attesa) return
    const t = setInterval(() => setAdesso(Date.now()), 20000)
    return () => clearInterval(t)
  }, [attesa])
  if (!attesa) return null
  const minuti = minutiRimasti(order, adesso)
  return (
    <span className="pill small attesa-cliente" title="Il cliente deve accettare le modifiche">
      In attesa del cliente{minuti > 0 ? ` · ${minuti} min` : ''}
    </span>
  )
}
