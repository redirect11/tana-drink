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

// C'È POSTO PER UNA COLONNA DI MENU ACCANTO AL CONTENUTO? Il conto è la
// larghezza che resta: sotto i 768px una colonna da 200-250px si mangia
// più di metà schermo, e quello che avanza non è un contenuto stretto, è
// un contenuto inutilizzabile. Da lì in su (l'iPad in verticale, cioè il
// tablet del banco) ci sta, e il menu può stare aperto DENTRO la pagina.
const QUERY_LARGO = '(min-width: 768px)'

export function useSchermoLargo() {
  const [largo, setLargo] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(QUERY_LARGO).matches === true
  )
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY_LARGO)
    if (!mq) return undefined
    const aggiorna = () => setLargo(mq.matches)
    aggiorna()
    mq.addEventListener('change', aggiorna)
    return () => mq.removeEventListener('change', aggiorna)
  }, [])
  return largo
}
