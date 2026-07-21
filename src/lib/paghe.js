// COSTO DEL PERSONALE: tariffa oraria per persona, storicizzata.
//
// La paga cambia nel tempo (aumenti, passaggi di livello). Se si tenesse
// solo la tariffa corrente, alzandola si riscriverebbe il passato: le ore
// di gennaio verrebbero ricalcolate alla paga di aprile e i conti delle
// serate già chiuse cambierebbero da soli. Per questo ogni persona ha un
// ELENCO DI TARIFFE con la data da cui valgono, e ogni turno è valorizzato
// con quella in vigore NEL GIORNO in cui è stato lavorato.
//
//   rates: [{ from: 'YYYY-MM-DD', rate: 9 }, { from: '2026-03-01', rate: 10 }]
//
// Logica pura (niente Firebase), interamente testabile.

// Tariffa in vigore a una certa data: l'ultima che parte entro quel giorno.
// Null se in quel periodo non ne era ancora stata definita nessuna — un
// costo non si inventa, si dichiara mancante.
export function rateAt(rates, date) {
  if (!date) return null
  let best = null
  for (const r of rates || []) {
    const from = String(r?.from || '')
    const rate = Number(r?.rate)
    if (!from || !Number.isFinite(rate) || rate < 0) continue
    if (from <= date && (!best || from > best.from)) best = { from, rate }
  }
  return best ? best.rate : null
}

// Elenco tariffe ordinato e ripulito (per mostrarlo e salvarlo).
export function sortRates(rates) {
  return (rates || [])
    .filter((r) => r?.from && Number.isFinite(Number(r.rate)))
    .map((r) => ({ from: String(r.from), rate: Number(r.rate) }))
    .sort((a, b) => a.from.localeCompare(b.from))
}

// Inserisce/aggiorna una tariffa: due tariffe con la stessa decorrenza non
// hanno senso, la nuova sostituisce la vecchia.
export function upsertRate(rates, { from, rate }) {
  const others = sortRates(rates).filter((r) => r.from !== String(from))
  return sortRates([...others, { from, rate }])
}

export function removeRate(rates, from) {
  return sortRates(rates).filter((r) => r.from !== String(from))
}

// Costo di un turno: ore × tariffa del giorno. Null se la tariffa manca.
export function entryCost(entry, rates) {
  const h = Number(entry?.hours) || 0
  if (h <= 0) return 0
  const r = rateAt(rates, entry?.date)
  return r == null ? null : Math.round(h * r * 100) / 100
}

// Riepilogo costo personale su un elenco di turni.
//   entries: [{ staff_uid, staff_name, date, hours, kind }]
//   ratesFor(entry) → elenco tariffe della persona (per uid, con ricaduta
//   sul nome per i turni registrati prima che ci fosse l'uid)
// Conta solo le ore EFFETTIVE (le programmate sono una previsione, non un
// costo sostenuto). Ritorna il totale, il dettaglio per persona e le
// persone senza tariffa: il totale è parziale e va detto.
export function payrollReport(entries, ratesFor, { onlyKind = 'effettivo' } = {}) {
  const perPerson = new Map()
  const senzaTariffa = new Set()
  let totale = 0
  let oreTotali = 0

  for (const e of entries || []) {
    const kind = e?.kind === 'programmato' ? 'programmato' : 'effettivo'
    if (onlyKind && kind !== onlyKind) continue
    const nome = e?.staff_name || '—'
    const h = Number(e?.hours) || 0
    if (h <= 0) continue
    const rates = typeof ratesFor === 'function' ? ratesFor(e) : ratesFor?.[nome]
    const cost = entryCost(e, rates)
    const cur = perPerson.get(nome) || { name: nome, hours: 0, cost: 0, mancante: false }
    cur.hours = Math.round((cur.hours + h) * 100) / 100
    if (cost == null) {
      cur.mancante = true
      senzaTariffa.add(nome)
    } else {
      cur.cost = Math.round((cur.cost + cost) * 100) / 100
      totale = Math.round((totale + cost) * 100) / 100
    }
    oreTotali = Math.round((oreTotali + h) * 100) / 100
    perPerson.set(nome, cur)
  }

  return {
    totale,
    oreTotali,
    persone: [...perPerson.values()].sort((a, b) => a.name.localeCompare(b.name)),
    senzaTariffa: [...senzaTariffa],
    parziale: senzaTariffa.size > 0,
  }
}

// Incidenza del costo del personale sull'incasso (%). Null se non c'è
// incasso: dividere per zero non direbbe nulla di utile.
export function costoSuIncasso(costo, incasso) {
  const c = Number(costo) || 0
  const i = Number(incasso) || 0
  if (i <= 0) return null
  return Math.round((c / i) * 1000) / 10
}
