import { useEffect, useState } from 'react'

// SIAMO SU UN TELEFONO? Non per "mobile sì/mobile no", ma per decidere
// dove mettere i tasti: sotto i 700px di larghezza non ci stanno tutti in
// pagina, e quello che conta — le righe del conto e la griglia dei
// prodotti — resterebbe schiacciato in mezzo.
//
// Si aggiorna girando il telefono o cambiando la finestra: la stessa
// schermata deve reggere entrambi i versi senza ricaricare.
const QUERY = '(max-width: 700px)'

export function useTelefono() {
  const [telefono, setTelefono] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches === true
  )
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY)
    if (!mq) return undefined
    const aggiorna = () => setTelefono(mq.matches)
    aggiorna()
    mq.addEventListener('change', aggiorna)
    return () => mq.removeEventListener('change', aggiorna)
  }, [])
  return telefono
}

export default useTelefono
