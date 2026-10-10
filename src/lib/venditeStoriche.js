// ── LE VENDITE DI PRIMA DELL'APP: TILLER (REQ-STAT-006) ───────────────
//
// Dal giugno 2023 all'agosto 2026 il locale batteva su Tiller (oggi SumUp
// POS Pro, che chiude a fine 2026). Gli export «rapporto sugli ordini
// prodotti» danno una riga per prodotto venduto, col suo conto; qui si
// trasformano in conti come quelli dell'app, così statistiche e bilancio li
// leggono con gli stessi conti di sempre.
//
// Stanno in `vendite_storiche`, un documento per giorno di apertura (ora
// italiana) coi conti dentro. Non toccano le giacenze: è merce uscita
// quando il magazzino non lo teneva l'app.
//
// Logica pura (niente Firebase), interamente testabile: la usano lo script
// di import e le schermate.

import { businessDayKey, DEFAULT_CUTOFF_HOUR, istanteDaOraDiRoma } from './businessDay.js'
import { ORDER_STATUSES } from './orderStatus.js'
import { normName } from './nameMatch.js'
import { computeConsumption, qtyInStockUnit } from './inventory.js'
import { arrotonda } from './magazzinoPeriodo.js'

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
// I numeri di Tiller sono all'italiana: «1.234,50».
export const numeroTiller = (s) => {
  const t = String(s ?? '').trim()
  return t ? Number(t.replace(/\./g, '').replace(',', '.')) || 0 : 0
}

// «2026-01-02 22:35:23», ora italiana → istante ISO. I secondi si
// aggiungono dopo: istanteDaOraDiRoma lavora al minuto.
export function istanteTiller(s) {
  const x = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?::(\d{2}))?/.exec(String(s || ''))
  if (!x) return null
  const minuto = istanteDaOraDiRoma(`${x[1]}T${x[2]}`)
  return minuto ? new Date(new Date(minuto).getTime() + (Number(x[3]) || 0) * 1000).toISOString() : null
}

// DALLE RIGHE DEI FILE AI CONTI, giorno per giorno. `righe` sono gli oggetti
// letti dal CSV (intestazioni di Tiller). Torna Map giorno → [conto]:
//   { id, aperto, chiuso, righe: [{ nome, qty, prezzo, sconto, incasso, nota }] }
// Il giorno è quello in cui il conto si è APERTO, in ora italiana: è come
// Tiller li data, e la giornata commerciale la calcola chi legge.
//
// I FILE SI SOVRAPPONGONO ai bordi (uno finisce il 2 gennaio, il dopo
// comincia il 1°): un conto già visto in un altro file si salta. `file` dice
// da dove viene la riga.
//
// `abbinamenti` (nome Tiller → nome della voce nell'app, da
// scripts/tiller-abbinamenti.json): molti nomi sono diversi («GIN TONIC» è
// «GIN TONIC (VETRO)»). La voce scelta resta sulla riga (`voce`), il nome
// di Tiller anche: è quello che si legge nelle classifiche.
export function contiDaRighe(righe, abbinamenti = {}) {
  const alias = new Map(Object.entries(abbinamenti).map(([k, v]) => [chiaveNome(k), v]))
  const fileDelConto = new Map()
  const conti = new Map()
  for (const r of righe) {
    const id = r['ID ordine']
    if (!id) continue
    const visto = fileDelConto.get(id)
    if (visto != null && visto !== r.file) continue
    fileDelConto.set(id, r.file)
    let c = conti.get(id)
    if (!c) {
      c = {
        id,
        giorno: String(r['Data di apertura'] || '').slice(0, 10),
        aperto: istanteTiller(r['Data di apertura']),
        chiuso: istanteTiller(r['Data di chiusura']),
        righe: [],
      }
      conti.set(id, c)
    }
    const nome = String(r.Prodotto || '').trim()
    c.righe.push({
      nome,
      voce: alias.get(chiaveNome(nome)) ?? null,
      qty: numeroTiller(r['Quantità']),
      prezzo: numeroTiller(r['Prezzo unitario (IVA incl.)']),
      sconto: numeroTiller(r.Sconti),
      // L'incassato della riga, già scontato: è il numero che torna con la
      // cassa. Listino × quantità − sconto non sempre ci arriva (uno
      // sconto sul conto Tiller lo spalma sulle righe), questo sì.
      incasso: numeroTiller(r['Vendite (IVA incl.)']),
      // «Codice del buono regalo» è la VARIANTE scelta su un tasto generico
      // («SHOT 2,50» → «Sambuca»), non un buono.
      nota: String(r['Codice del buono regalo'] || '').trim() || null,
    })
  }
  const perGiorno = new Map()
  for (const c of conti.values()) {
    const { giorno, ...resto } = c
    if (!perGiorno.has(giorno)) perGiorno.set(giorno, [])
    perGiorno.get(giorno).push(resto)
  }
  return perGiorno
}

// IL NOME DI UNA VOCE, per abbinarla: lo stesso confronto dei listini
// (normName: senza maiuscole, accenti e punteggiatura — «TENNENT’S» e
// «Tennent's» sono lo stesso nome).
export const chiaveNome = normName

// L'ULTIMO GIORNO DI TILLER: dal 28/08/2026 si batte solo sull'app. Un
// periodo che comincia dopo non ha niente da leggere in `vendite_storiche`,
// e le statistiche di ogni sera non devono pagare una lettura per saperlo.
export const ULTIMO_GIORNO_TILLER = '2026-08-28'

// Un conto o una serata che viene da Tiller: sola lettura, niente scontrino.
export const daTiller = (x) => x?.origine === 'tiller'

// UN CONTO STORICO COME UN CONTO DELL'APP: chiuso, pagato, con le righe
// abbinate alle voci del menù per nome (`perNome`: chiaveNome → drink). Lo
// sconto è quello che separa il listino dall'incassato, così l'incasso del
// conto (orderNet) è la somma delle righe, al centesimo.
export function contoStorico(c, perNome) {
  const order_items = c.righe.map((r) => {
    const voce = perNome.get(chiaveNome(r.voce || r.nome))
    return {
      drink_id: voce?.id ?? null,
      name: r.nome,
      qty: r.qty,
      unit_price: r.prezzo,
      ...(r.nota ? { note: r.nota } : {}),
    }
  })
  const total = r2(c.righe.reduce((s, r) => s + r.qty * r.prezzo, 0))
  const incasso = r2(c.righe.reduce((s, r) => s + r.incasso, 0))
  return {
    id: `tiller:${c.id}`,
    origine: 'tiller',
    status: ORDER_STATUSES.PAGATO,
    payment_status: 'pagato',
    created_at: c.aperto,
    paid_at: c.chiuso,
    order_items,
    total,
    discount_amount: r2(Math.max(0, total - incasso)),
  }
}

// I CONTI DELL'APP E QUELLI STORICI INSIEME, UN SISTEMA PER GIORNATA.
// Dal 26 al 28 agosto 2026 si è tornati a Tiller per qualche sera, e quei
// conti risultano ribattuti nell'app a fine serata: sommarli li conterebbe
// due volte. Per ogni giornata commerciale contano quelli dell'app, se ce
// ne sono; se no quelli di Tiller.
//   giornate: i documenti di `vendite_storiche` ([{ giorno, conti }])
//   drinks:   le voci del menù, per abbinare i nomi
//   dal, al:  le giornate commerciali chieste (gli estremi inclusi): i
//             documenti si leggono con un giorno di margine, qui si taglia
export function unisciVendite(
  ordiniApp,
  giornate,
  { drinks = [], cutoffHour = DEFAULT_CUTOFF_HOUR, dal = null, al = null } = {}
) {
  if (!giornate?.length) return ordiniApp
  const conApp = new Set((ordiniApp || []).map((o) => businessDayKey(o.created_at, cutoffHour)).filter(Boolean))
  const perNome = perNomeDi(drinks)
  const storici = []
  for (const g of giornate) {
    for (const c of g.conti || []) {
      const giornata = c.aperto ? businessDayKey(c.aperto, cutoffHour) : null
      if (!giornata || conApp.has(giornata)) continue
      if ((dal && giornata < dal) || (al && giornata > al)) continue
      storici.push(contoStorico(c, perNome))
    }
  }
  return [...storici, ...(ordiniApp || [])]
}

// ── I DUE RIASSUNTI CHE SI SCRIVONO CON L'IMPORT ──────────────────────
// Le giornate di Tiller sono quasi mille documenti, decine di megabyte:
// non si scaricano tutte per fare un elenco. L'import scrive anche due
// riassunti leggeri, e le schermate leggono quelli; i conti di una giornata
// si scaricano solo quando la si apre.

const perNomeDi = (drinks) => {
  const m = new Map()
  for (const d of drinks || []) {
    const k = chiaveNome(d.name)
    if (k && !m.has(k)) m.set(k, d)
  }
  return m
}

// LE SERATE DI TILLER, per «Statistiche → Per serata»: una per giornata
// commerciale, col primo conto aperto e l'ultimo chiuso (la finestra in cui
// il dettaglio li ritrova), l'incassato e quanti conti.
export function indiceSerate(perGiorno, cutoffHour = DEFAULT_CUTOFF_HOUR) {
  const serate = new Map()
  for (const conti of perGiorno.values()) {
    for (const c of conti) {
      const giorno = c.aperto ? businessDayKey(c.aperto, cutoffHour) : null
      if (!giorno) continue
      const s = serate.get(giorno) || { giorno, aperto: c.aperto, chiuso: c.chiuso || c.aperto, incassato: 0, conti: 0 }
      if (c.aperto < s.aperto) s.aperto = c.aperto
      const fine = c.chiuso || c.aperto
      if (fine > s.chiuso) s.chiuso = fine
      s.incassato = r2(s.incassato + c.righe.reduce((t, x) => t + x.incasso, 0))
      s.conti += 1
      serate.set(giorno, s)
    }
  }
  return [...serate.values()].sort((a, b) => a.giorno.localeCompare(b.giorno))
}

// LE SERATE DI TILLER COME CHIUSURE DI CASSA, per l'elenco di «Per serata».
// Tiller le chiusure non le ha: la serata è la giornata, dal primo conto
// all'ultimo, coi numeri dell'indice al posto di quelli della chiusura. Un
// giorno con una chiusura vera dell'app la tiene lei, come per i conti.
//   serate:   l'indice ([{ giorno, aperto, chiuso, incassato, conti }])
//   sessions: le chiusure dell'app
export function serateDaTiller(serate, sessions = [], cutoffHour = DEFAULT_CUTOFF_HOUR) {
  const conCassa = new Set((sessions || []).map((s) => businessDayKey(s.opened_at, cutoffHour)).filter(Boolean))
  return (serate || [])
    .filter((s) => s.aperto && !conCassa.has(s.giorno))
    .map((s) => ({
      id: `tiller:${s.giorno}`,
      origine: 'tiller',
      business_day: s.giorno,
      opened_at: s.aperto,
      closed_at: s.chiuso || s.aperto,
      snapshot: { incassato: s.incassato, nPagati: s.conti },
    }))
}

// IL VENDUTO DI TILLER PER PRODOTTO DI MAGAZZINO, giorno per giorno, per la
// movimentazione di un prodotto (REQ-MAG-048). Dalle voci vendute agli
// ingredienti con le RICETTE DI OGGI (computeConsumption), riportati
// all'unità della giacenza: è una stima — la ricetta di allora non c'è —
// e per le bottiglie vendute intere coincide col vero.
// Torna Map item_id → { giornata: quantità }.
export function vendutoPerProdotto(perGiorno, { drinks = [], items = [], cutoffHour = DEFAULT_CUTOFF_HOUR } = {}) {
  const perNome = perNomeDi(drinks)
  const drinksById = Object.fromEntries((drinks || []).map((d) => [d.id, d]))
  const itemsById = Object.fromEntries((items || []).map((i) => [i.id, i]))
  const out = new Map()
  for (const conti of perGiorno.values()) {
    for (const c of conti) {
      const giorno = c.aperto ? businessDayKey(c.aperto, cutoffHour) : null
      if (!giorno) continue
      const { order_items } = contoStorico(c, perNome)
      for (const u of computeConsumption(order_items, drinksById)) {
        const item = itemsById[u.inventory_item_id]
        if (!item) continue
        const q = qtyInStockUnit(u.qty, u.unit, item)
        if (!(q > 0)) continue
        const giorni = out.get(item.id) || {}
        giorni[giorno] = arrotonda((giorni[giorno] || 0) + q)
        out.set(item.id, giorni)
      }
    }
  }
  return out
}
