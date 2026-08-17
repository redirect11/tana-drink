// ── IL PERIODO: da che giorno a che giorno ───────────────────────────
//
// Nella lista ordini si cercava solo fra gli ultimi conti: per ritrovare
// una serata di due settimane fa non c'era strada. Qui c'è la logica del
// selettore a calendario — quello dei siti degli alberghi: si tocca il
// giorno d'inizio, poi quello di fine, e in mezzo si accende tutto. Un
// tocco solo su un giorno vuol dire quel giorno e basta.
//
// Le giornate sono chiavi «AAAA-MM-GG» di GIORNATA COMMERCIALE, non date
// solari: al bar la serata del venerdì finisce alle quattro del sabato, e
// chi cerca «venerdì» cerca quella (vedi businessDay.js).
//
// Logica pura, niente calendario del browser: il selettore disegna quello
// che questa dice.

import { businessDayKey } from './businessDay.js'

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]
const MESI_CORTI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

export const chiaveGiorno = (d) => new Date(d).toISOString().slice(0, 10)

// Somma giorni a una chiave, restando su UTC: sui giorni non serve il fuso
// e con l'ora legale una somma in locale salta o ripete un giorno.
export function piuGiorni(chiave, n) {
  const d = new Date(`${chiave}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return chiaveGiorno(d)
}

// Il periodo si dà in due tocchi e non sempre in ordine: chi tocca prima
// il 20 e poi il 12 intende comunque dal 12 al 20.
export function normalizzaPeriodo(da, a) {
  if (!da && !a) return { da: null, a: null }
  if (!a) return { da, a: da }
  if (!da) return { da: a, a }
  return da <= a ? { da, a } : { da: a, a: da }
}

// Il tocco successivo sul calendario: primo tocco = inizio (e il periodo è
// quel giorno solo); secondo tocco = fine. Il terzo ricomincia — è il modo
// in cui si comportano quei calendari, e si impara toccandoli.
export function tocca(periodo, giorno) {
  if (!periodo?.da || periodo.completo) return { da: giorno, a: giorno, completo: false }
  return { ...normalizzaPeriodo(periodo.da, giorno), completo: true }
}

export function dentroIlPeriodo(giorno, { da, a } = {}) {
  if (!giorno || !da) return true
  return giorno >= da && giorno <= (a || da)
}

// Un ordine cade nel periodo? Si guarda la sua giornata commerciale: quella
// scritta sull'ordine se c'è, altrimenti quella del suo orario.
export function ordineNelPeriodo(o, periodo, cutoffHour) {
  if (!periodo?.da) return true
  const giorno = o?.order_date || businessDayKey(o?.created_at, cutoffHour)
  return dentroIlPeriodo(giorno, periodo)
}

// Come si legge il periodo scelto, in poche parole: «oggi», «ieri»,
// «12 ago», «12 – 18 ago», «28 dic – 3 gen».
export function etichettaPeriodo({ da, a } = {}, oggi = null) {
  if (!da) return 'Sempre'
  const fine = a || da
  const giorno = (k, conAnno = false) => {
    const [y, m, d] = k.split('-')
    return `${Number(d)} ${MESI_CORTI[Number(m) - 1]}${conAnno ? ` ${y}` : ''}`
  }
  if (da === fine) {
    if (oggi && da === oggi) return 'Oggi'
    if (oggi && da === piuGiorni(oggi, -1)) return 'Ieri'
    return giorno(da)
  }
  // Stesso mese: il mese si scrive una volta sola («12 – 18 ago»).
  if (da.slice(0, 7) === fine.slice(0, 7)) {
    return `${Number(da.slice(8))} – ${giorno(fine)}`
  }
  return `${giorno(da)} – ${giorno(fine)}`
}

export function nomeMese(anno, mese) {
  return `${MESI[mese]} ${anno}`
}

// La griglia del mese come si disegna: sei righe da sette, lunedì per
// primo (in Italia la settimana comincia lì), con i giorni di riempimento
// a `null` — così il calendario non si muove passando da un mese all'altro.
export function grigliaMese(anno, mese) {
  const primo = new Date(Date.UTC(anno, mese, 1))
  // getUTCDay(): 0 = domenica. Con lunedì primo, la domenica va in fondo.
  const scarto = (primo.getUTCDay() + 6) % 7
  const giorniNelMese = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate()
  const celle = []
  for (let i = 0; i < scarto; i++) celle.push(null)
  for (let d = 1; d <= giorniNelMese; d++) {
    celle.push(chiaveGiorno(new Date(Date.UTC(anno, mese, d))))
  }
  while (celle.length % 7 !== 0) celle.push(null)
  return celle
}

// Le scorciatoie: quello che si cerca il 90% delle volte, senza aprire il
// calendario.
export function periodiRapidi(oggi) {
  return [
    { id: 'oggi', label: 'Oggi', periodo: { da: oggi, a: oggi, completo: true } },
    {
      id: 'ieri',
      label: 'Ieri',
      periodo: { da: piuGiorni(oggi, -1), a: piuGiorni(oggi, -1), completo: true },
    },
    {
      id: 'settimana',
      label: 'Ultimi 7 giorni',
      periodo: { da: piuGiorni(oggi, -6), a: oggi, completo: true },
    },
    {
      id: 'mese',
      label: 'Ultimi 30 giorni',
      periodo: { da: piuGiorni(oggi, -29), a: oggi, completo: true },
    },
    { id: 'sempre', label: 'Sempre', periodo: { da: null, a: null, completo: true } },
  ]
}
