// ── QUANDO L'APP SI PRESENTA ALLA REGIA (REQ-FLOTTA-026, REQ-FLOTTA-031) ──
//
// Dopo l'accesso, all'apertura e TORNANDO IN PRIMO PIANO. Il tablet del
// banco resta aperto per giorni senza essere ricaricato: con la sola
// apertura non si sarebbe più presentato, e la regia, che dimentica chi non
// si presenta da 30 giorni, l'avrebbe perso mentre chiamava ancora le
// interfacce vecchie. Quante volte, lo decide presentaSeServe: al più una
// volta al giorno per dispositivo, di più solo se la licenza manca.
// In sottofondo: nessuno la aspetta, e un errore si riprova alla prossima
// occasione.

import { useEffect } from 'react'
import { presentaSeServe } from './presentazione.js'

export function usePresentazione({ versione, collegato, licenzaMancante, chiama, progetto }) {
  useEffect(() => {
    const presenta = () => presentaSeServe({ versione, collegato, licenzaMancante, chiama, progetto })
    presenta()
    const tornaVisibile = () => {
      if (document.visibilityState === 'visible') presenta()
    }
    document.addEventListener('visibilitychange', tornaVisibile)
    return () => document.removeEventListener('visibilitychange', tornaVisibile)
  }, [versione, collegato, licenzaMancante, chiama, progetto])
}
