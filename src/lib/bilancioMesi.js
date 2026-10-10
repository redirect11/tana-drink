// ── BILANCIO → MESI (REQ-CASSA-011) ───────────────────────────────────
//
// La versione navigabile dei fogli mensili di ANALISI DATI: il mese diviso
// per settimane come il foglio (1–7, 8–14, 15–21, 22–28 e i giorni che
// restano), e per ogni giorno MINIMO (quanto doveva fare il locale), INCASSATO
// (quanto ha fatto) e DIFFERENZA. Sotto, i conti del mese: incassi, stipendi,
// spese, netto, e due righe che il foglio non ha — costo del lavoro e prime
// cost in percentuale.
//
// DA DOVE VIENE OGNI NUMERO, e perché:
//   · INCASSATO: i conti, per giornata commerciale (REQ-CASSA-005), quelli
//     dell'app e quelli di Tiller (REQ-STAT-006). Anche per i mesi del
//     foglio: lì la riga REALE è battuta a mano, i conti sono i conti.
//   · MINIMO: nei mesi del foglio, il suo (battuto a mano, come Flavio lo
//     decideva). Nei mesi dell'app, la regola decisa il 19/08
//     (REQ-STAFF-015): la somma delle paghe di chi lavora quel giorno — le ore
//     effettive per i giorni passati, i turni programmati per quelli a venire.
//     L'extra messo a mano dall'admin non c'è ancora: il minimo dell'app è,
//     per ora, il solo costo del personale. Un giorno senza ore non ha
//     minimo: un obiettivo inventato non lo insegue nessuno.
//   · STIPENDI e SPESE: nei mesi del foglio, i suoi. Nei mesi dell'app gli
//     stipendi escono dalle ore registrate (ore × paga in vigore quel
//     giorno, REQ-STAFF-006) e le spese sono la merce fatturata più le altre
//     spese, dal Riepilogo di Fornitori (REQ-CASSA-012).
//
// Logica pura (niente Firebase), interamente testabile.

import { colonneDelBilancio } from './periodiBilancio.js'
import { shiftDay, byDay } from './ore.js'
import { payrollReport, costoSuIncasso } from './paghe.js'

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

// IL COSTO DEL PERSONALE DI OGNI GIORNO: Map giorno → euro. Le ore EFFETTIVE
// per i giorni fino a `oggi`, i turni PROGRAMMATI per quelli dopo: un giorno
// passato si misura su chi ha lavorato davvero, uno futuro su chi è in turno.
// Un giorno dove qualcuno non ha una tariffa NON ha minimo: il costo sarebbe
// solo una parte, e un obiettivo più basso del vero si legge come vero.
export function paghePerGiorno(voci, tariffePer, oggi) {
  const out = new Map()
  for (const [giorno, { entries }] of byDay(voci || [])) {
    const onlyKind = giorno <= oggi ? 'effettivo' : 'programmato'
    const { totale, oreTotali, parziale } = payrollReport(entries, tariffePer, { onlyKind })
    if (oreTotali > 0 && !parziale) out.set(giorno, r2(totale))
  }
  return out
}

// LA TABELLA DEL MESE.
//   mese:     'YYYY-MM'
//   incassi:  Map giornata → incassato (revenueByDay)
//   foglio:   il mese del foglio, se c'è ({ giorni: { g: { minimo, nota } },
//             stipendi, spese })
//   paghe:    Map giornata → costo del personale (paghePerGiorno)
//   stipendi, spese: i totali dell'app per il mese (si usano dove il foglio
//             non li ha); `stipendiParziali` se a qualcuno manca la tariffa
//   incassoNetto, costoVenduto: dal conto per macro, IVA scorporata — per le
//             due percentuali
//   oggi:     giornata di oggi; i giorni dopo non hanno incassato
export function tabellaDelMese({
  mese,
  incassi = new Map(),
  foglio = null,
  paghe = new Map(),
  stipendi = null,
  stipendiParziali = false,
  spese = null,
  incassoNetto = null,
  costoVenduto = null,
  oggi,
}) {
  const settimane = colonneDelBilancio('mese', `${mese}-01`).map((col) => {
    const giorni = []
    for (let g = col.dal; g <= col.al; g = shiftDay(g, 1)) {
      const dalFoglio = foglio?.giorni?.[g]
      const minimo = dalFoglio?.minimo ?? paghe.get(g) ?? null
      const incassato = g <= oggi ? r2(incassi.get(g) || 0) : null
      giorni.push({
        giorno: g,
        nome: `${GIORNI[new Date(`${g}T12:00:00Z`).getUTCDay()]} ${Number(g.slice(8))}`,
        minimo,
        incassato,
        differenza: minimo != null && incassato != null ? r2(incassato - minimo) : null,
        nota: dalFoglio?.nota || null,
      })
    }
    const somma = (k) => r2(giorni.reduce((s, x) => s + (Number(x[k]) || 0), 0))
    return {
      label: col.label,
      sotto: col.sotto,
      giorni,
      tot: { minimo: somma('minimo'), incassato: somma('incassato'), differenza: somma('differenza') },
    }
  })

  const incassiMese = r2(settimane.reduce((s, w) => s + w.tot.incassato, 0))
  const stipendiMese = foglio?.stipendi ?? stipendi
  const speseMese = foglio?.spese ?? spese
  return {
    settimane,
    totali: {
      incassi: incassiMese,
      stipendi: stipendiMese,
      spese: speseMese,
      // Dal foglio o dall'app: lo si dice accanto al numero.
      dalFoglio: { stipendi: foglio?.stipendi != null, spese: foglio?.spese != null },
      stipendiParziali: foglio?.stipendi == null && stipendiParziali,
      netto: stipendiMese != null && speseMese != null ? r2(incassiMese - stipendiMese - speseMese) : null,
      differenza: r2(settimane.reduce((s, w) => s + w.tot.differenza, 0)),
      // Le due percentuali sull'incassato al NETTO dell'IVA: stipendi e merce
      // l'IVA non ce l'hanno, e dividerli per un lordo li farebbe sembrare
      // più leggeri di quello che sono.
      costoLavoroPct: stipendiMese != null ? costoSuIncasso(stipendiMese, incassoNetto) : null,
      primeCostPct:
        stipendiMese != null && costoVenduto != null ? costoSuIncasso(stipendiMese + costoVenduto, incassoNetto) : null,
    },
  }
}
