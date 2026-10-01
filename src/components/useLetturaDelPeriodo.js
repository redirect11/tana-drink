import { useEffect, useState } from 'react'
import { shiftDay } from '../lib/ore.js'

// ── LA LETTURA DI UNA SCHEDA DELLE STATISTICHE PER PERIODO ────────────
//
// «Magazzino nel periodo» (REQ-STAT-002) legge migliaia di documenti, quindi:
//   · SI LEGGE A RICHIESTA (`aperto`): chi guarda l'incasso non paga una
//     lettura che non ha chiesto;
//   · SI RILEGGE SOLO SE SI GUARDA PIÙ INDIETRO: ritoccare l'ora di fine o
//     spostare l'inizio in avanti lavora su quello che è già in mano —
//     prima ogni ritocco rileggeva tutto.
// Il primo istante da leggere è `da` per un periodo all'ora; per le
// giornate, UN GIORNO DI MARGINE: la giornata commerciale comincia alle
// cinque del mattino, e la notte precedente appartiene già a quella prima.
// Si legge largo e si taglia preciso.
//
// `leggi(dove)` torna una Promise con quello che serve alla scheda; deve
// essere sempre la stessa funzione (una di modulo), se no si rilegge a ogni
// disegno.
export function useLetturaDelPeriodo(aperto, { dal, da = null }, leggi) {
  const [letti, setLetti] = useState(null) // { ...dati, dove }
  const [caricando, setCaricando] = useState(false)
  const [errore, setErrore] = useState(null)
  const dove = da || `${shiftDay(dal, -1)}T00:00:00.000Z`
  const bastaQuelloCheCe = !!letti && letti.dove <= dove

  useEffect(() => {
    if (!aperto || bastaQuelloCheCe) return undefined
    let vivo = true
    setCaricando(true)
    setErrore(null)
    leggi(dove)
      .then((dati) => vivo && setLetti({ ...dati, dove }))
      .catch((e) => vivo && setErrore(e.message))
      .finally(() => vivo && setCaricando(false))
    return () => {
      vivo = false
    }
  }, [aperto, dove, bastaQuelloCheCe, leggi])

  return { letti, caricando, errore }
}
