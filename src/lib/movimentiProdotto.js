// ── LA MOVIMENTAZIONE DI UN PRODOTTO, DIVISA PER TIPO (REQ-MAG-048) ────
//
// Flavio, 22/09/2026: «se voglio analizzare un prodotto di magazzino il
// gestionale dovrebbe registrarmi tutte le movimentazioni e suddividermele
// in quelle da consegna di ordine a fornitore, carico diretto da prodotti di
// magazzino, modifica del contenuto reale, rimanenza reale durante la
// chiusura di un inventario». E il 07/10, dall'utente: le vendite di Tiller
// «nella movimentazione dal 2024».
//
// I movimenti hanno già il motivo che serve; qui si mettono in fila, si
// riportano all'unità della giacenza (movimentoInPezzi) e si sommano per
// tipo. Le vendite di Tiller arrivano a parte — non sono movimenti, le
// giacenze di allora non le teneva l'app — come venduto per giornata.
//
// Logica pura (niente Firebase), interamente testabile.

import { arrotonda, gruppoMovimento, movimentoInPezzi } from './magazzinoPeriodo.js'

// I TIPI, nell'ordine in cui li dice Flavio, più le vendite. Un motivo che
// non c'è qui finisce fra le altre correzioni: si vede, non si perde.
export const TIPI_MOVIMENTO = [
  { id: 'ordine fornitore', label: 'Consegna ordine fornitore' },
  { id: 'carico', label: 'Carico diretto' },
  { id: 'fattura fornitore', label: 'Carico da fattura' },
  { id: 'rettifica', label: 'Contenuto reale' },
  { id: 'conta', label: 'Chiusura inventario' },
  { id: 'vendite', label: 'Vendite' },
  { id: 'tiller', label: 'Vendite su Tiller' },
  { id: 'altro', label: 'Altre correzioni' },
]
// Le vendite sono il gruppo «consumo» dei movimenti (GRUPPO_MOTIVO, in
// magazzinoPeriodo.js): ordini, loro modifiche e storni. Un motivo di
// vendita nuovo si aggiunge lì, e qui segue.
const NOTI = new Set(TIPI_MOVIMENTO.map((t) => t.id))
export const tipoDi = (reason) =>
  gruppoMovimento({ reason }) === 'consumo' ? 'vendite' : NOTI.has(reason) ? reason : 'altro'
const LABEL = Object.fromEntries(TIPI_MOVIMENTO.map((t) => [t.id, t.label]))
export const etichettaTipo = (id) => LABEL[id] || id

// IL RIEPILOGO DEL PERIODO (`dal`: giornata 'YYYY-MM-DD', null = tutto).
//   movimenti: quelli del prodotto (fetchMovimentiProdotto)
//   tiller:    { giornata: quantità venduta } (fetchVendutoStoricoProdotto)
// Ritorna:
//   tipi:   [{ id, label, q }] — q col segno: entrate +, uscite −
//   mesi:   [{ mese, vendite, tiller }] — il venduto mese per mese, in
//           positivo, dal più recente
//   righe:  i movimenti del periodo, dal più recente, con tipo e q
export function riepilogoMovimenti(movimenti, item, tiller = {}, { dal = null } = {}) {
  const tot = new Map()
  const mesi = new Map()
  const mese = (k) => {
    if (!mesi.has(k)) mesi.set(k, { mese: k, vendite: 0, tiller: 0 })
    return mesi.get(k)
  }
  const righe = []
  for (const m of movimenti || []) {
    const giorno = String(m.created_at || '').slice(0, 10)
    if (dal && (!giorno || giorno < dal)) continue
    const mp = movimentoInPezzi(m, item)
    if (!mp) continue
    const tipo = tipoDi(m.reason)
    tot.set(tipo, (tot.get(tipo) || 0) + mp.q)
    if (tipo === 'vendite' && giorno) mese(giorno.slice(0, 7)).vendite -= mp.q
    righe.push({ ...m, tipo, q: arrotonda(mp.q) })
  }
  for (const [giorno, q] of Object.entries(tiller || {})) {
    if (dal && giorno < dal) continue
    const n = Number(q) || 0
    tot.set('tiller', (tot.get('tiller') || 0) - n)
    mese(giorno.slice(0, 7)).tiller += n
  }
  return {
    tipi: TIPI_MOVIMENTO.filter((t) => tot.has(t.id)).map((t) => ({ ...t, q: arrotonda(tot.get(t.id)) })),
    mesi: [...mesi.values()]
      .map((x) => ({ ...x, vendite: arrotonda(x.vendite), tiller: arrotonda(x.tiller) }))
      .sort((a, b) => b.mese.localeCompare(a.mese)),
    righe,
  }
}
