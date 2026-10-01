// ── I PERIODI DELLE TABELLE DEL BILANCIO ──────────────────────────────
//
// Le colonne di una tabella per macro, per anno, mese, settimana o giorno,
// e come si va avanti e indietro. Le usano «Acquisti × Fatturato» (tutte e
// quattro le viste, REQ-MAG-022) e «Venduto × Incassato» (l'anno).

import { shiftDay, weekDays } from './ore.js'
import { chiaveMese, chiaveSettimana, etichettaPeriodo } from './serate.js'

// `incidenza` è come si chiama, sotto i totali, la quota di una colonna sul
// periodo intero.
export const VISTE = [
  { id: 'anno', label: 'Anno', incidenza: 'Incidenza sull’anno' },
  { id: 'mese', label: 'Mese', incidenza: 'Incidenza sul mese' },
  { id: 'settimana', label: 'Settimana', incidenza: 'Incidenza sulla settimana' },
  { id: 'giorno', label: 'Giorno', incidenza: 'Incidenza sul giorno' },
]

const MESI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC']
const GIORNI = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB']
const SETTIMANE = ['I SETT', 'II SETT', 'III SETT', 'IV SETT']

const pad = (n) => String(n).padStart(2, '0')
const ultimoDelMese = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

// LE COLONNE DI UNA VISTA, attorno a un giorno qualsiasi del periodo
// (`giorno`, 'YYYY-MM-DD'). Ogni colonna è un intervallo di GIORNATE
// COMMERCIALI { key, label, sotto?, dal, al }.
//
// IL MESE SI DIVIDE COME NEL FOGLIO DI FLAVIO, a blocchi di sette giorni dal
// primo (1–7, 8–14, 15–21, 22–28) più quelli che restano: «le 4 settimane e
// la settimana incompleta». Non a settimane da lunedì: così le colonne
// sono sempre le stesse e un mese si confronta con l'altro.
// LA SETTIMANA invece va da lunedì a domenica, come le chiusure
// (REQ-CASSA-014): per un locale la domenica è la coda del fine settimana.
export function colonneDelBilancio(vista, giorno) {
  if (vista === 'anno') {
    const y = giorno.slice(0, 4)
    return MESI.map((label, i) => {
      const ym = `${y}-${pad(i + 1)}`
      return { key: ym, label, dal: `${ym}-01`, al: `${ym}-${pad(ultimoDelMese(ym))}` }
    })
  }
  if (vista === 'mese') {
    const ym = giorno.slice(0, 7)
    const fine = ultimoDelMese(ym)
    const colonne = []
    for (let d = 1; d <= fine; d += 7) {
      const a = Math.min(d + 6, fine)
      colonne.push({
        key: `${ym}-${pad(d)}`,
        label: SETTIMANE[(d - 1) / 7] || 'EXTRA',
        sotto: d === a ? `${d}` : `${d}–${a}`,
        dal: `${ym}-${pad(d)}`,
        al: `${ym}-${pad(a)}`,
      })
    }
    return colonne
  }
  return (vista === 'settimana' ? weekDays(giorno) : [giorno]).map((k) => ({
    key: k,
    label: GIORNI[new Date(`${k}T00:00:00Z`).getUTCDay()],
    sotto: `${Number(k.slice(8))}/${Number(k.slice(5, 7))}`,
    dal: k,
    al: k,
  }))
}

// AVANTI E INDIETRO di un periodo intero. Il mese e l'anno ripartono dal
// primo del mese: un 31 spostato di un mese non deve cadere due mesi dopo.
export function spostaGiorno(vista, giorno, verso) {
  const [y, m] = giorno.split('-').map(Number)
  if (vista === 'anno') return `${y + verso}-${pad(m)}-01`
  if (vista === 'mese') return new Date(Date.UTC(y, m - 1 + verso, 1)).toISOString().slice(0, 10)
  return shiftDay(giorno, vista === 'settimana' ? 7 * verso : verso)
}

// Il periodo mostrato, a parole. Mese e settimana si scrivono come nelle
// chiusure (etichettaPeriodo di serate.js), la settimana con l'anno: qui si
// va avanti e indietro, e fra dicembre e gennaio l'anno cambia.
export function nomeDelPeriodo(vista, giorno) {
  if (vista === 'anno') return giorno.slice(0, 4)
  if (vista === 'mese') return etichettaPeriodo(chiaveMese(giorno), 'mese')
  if (vista === 'settimana') {
    const lunedi = chiaveSettimana(giorno)
    return `${etichettaPeriodo(lunedi, 'settimana')} ${shiftDay(lunedi, 6).slice(0, 4)}`
  }
  return new Date(`${giorno}T12:00:00Z`).toLocaleDateString('it-IT', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
