import { useEffect, useState } from 'react'
import { subscribeActiveOrders } from './api.js'
import { contoChiuso } from './comande.js'
import { maxContiAperti } from './limiti.js'

// QUANTI CONTI SONO APERTI ADESSO, per il limite del piano Free
// (REQ-LIC-003, `conti_aperti_max`). Ascolta la stessa coda della cassa —
// dalla cache, quindi la risposta arriva subito anche senza rete — e conta
// quelli che la coda tiene aperti (`contoChiuso`, la regola che usano
// anche la testata e il magazzino).
//
// SOLO SE IL LIMITE C'È: senza `conti_aperti_max` nella licenza non si
// ascolta niente e torna `null`. La Tana non apre un ascolto in più per una
// regola che non la riguarda.
export function useContiAperti(impostazioni) {
  const conLimite = maxContiAperti(impostazioni) != null
  const workflowOn = impostazioni?.workflow_enabled !== false
  const cutoffHour = impostazioni?.business_day_cutoff_hour
  const [aperti, setAperti] = useState(null)
  useEffect(() => {
    if (!conLimite) {
      setAperti(null)
      return undefined
    }
    return subscribeActiveOrders(
      (lista) => setAperti(lista.filter((o) => !contoChiuso(o, { workflowOn })).length),
      // Se la coda non si legge, il limite non ferma il lavoro: si conta
      // zero e si batte. Meglio un conto in più che una cassa bloccata.
      () => setAperti(0),
      cutoffHour != null ? { cutoffHour } : {}
    )
  }, [conLimite, workflowOn, cutoffHour])
  return conLimite ? aperti : null
}
