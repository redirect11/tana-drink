// ── LA FATTURA LETTA DALL'AI, DA RIVEDERE (REQ-AI-001) ─────────────────
//
// Il cassetto AI della regia legge la foto o il PDF di una fattura
// d'acquisto e restituisce i dati così come sono scritti (fornitore,
// numero, data, righe, totali, i punti dubbi). Qui quei dati diventano una
// PROPOSTA nel linguaggio del gestionale: il fornitore dell'archivio, i
// prodotti del magazzino, i costi dopo lo sconto. Niente si registra da
// solo: la proposta la rivede chi ha la fattura in mano (Daniele, 12/11/2026),
// perché un modello può leggere male una cifra, e una fattura sbagliata è
// un costo sbagliato e un magazzino sbagliato.
//
// Logica pura: archivio, magazzino e listini li passa chi chiama.

import { rigaDaProdotto } from './fatture.js'

// Minuscole, senza accenti né punteggiatura: «S.R.L.» e «srl» sono la
// stessa cosa, e così «Caffè» e «CAFFE».
const parole = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

// LE FORME SOCIALI NON DICONO CHI È: «Rossi Bevande S.r.l.» in archivio è
// «Rossi Bevande». Spezzate dalla punteggiatura, restano lettere sole.
const FORME_SOCIALI = new Set(['srl', 'srls', 'spa', 'sas', 'snc', 'sapa', 'coop', 'soc', 'societa', 'cooperativa', 'unipersonale', 's', 'r', 'l', 'p', 'a', 'c', 'n', 'di', 'e', 'f', 'lli', 'fratelli'])
const nucleo = (s) => parole(s).filter((w) => !FORME_SOCIALI.has(w))

const tutteIn = (alcune, tutte) => alcune.length > 0 && alcune.every((w) => tutte.includes(w))

// IL FORNITORE DELL'ARCHIVIO. In archivio c'è solo il nome (niente partita
// IVA), quindi si confronta quello: uguale nel nucleo, oppure uno dei due
// contiene tutte le parole dell'altro («Rossi» e «Rossi Bevande srl»).
// Uguale vince su contenuto; se il contenuto è ambiguo (due fornitori
// possibili) non si sceglie: lo sceglie chi rivede.
export function fornitoreDellaFattura(letto, suppliers) {
  const cercato = nucleo(letto?.ragione_sociale)
  if (cercato.length === 0) return null
  const chiave = cercato.join(' ')
  const candidati = []
  for (const s of suppliers || []) {
    const n = nucleo(s?.name)
    if (n.length === 0) continue
    if (n.join(' ') === chiave) return s
    if (tutteIn(n, cercato) || tutteIn(cercato, n)) candidati.push(s)
  }
  return candidati.length === 1 ? candidati[0] : null
}

// LE UNITÀ E I NUMERI NON DICONO QUALE PRODOTTO: «70cl», «6x», «lt» stanno
// su metà delle righe di una fattura di bevande.
const RUMORE = /^(\d+(cl|ml|l|lt|g|gr|kg|x|pz|pezzi|bt|bott|ct|cf)?|cl|ml|l|lt|g|gr|kg|x|pz|pezzi|bt|bott|ct|cf|cartone|conf|confezione|bottiglia|bottiglie|vap|vetro|pet|lattina|lattine)$/
const paroleUtili = (s) => parole(s).filter((w) => w.length > 1 && !RUMORE.test(w))

// IL PRODOTTO DEL MAGAZZINO PER UNA RIGA LETTA.
// 1. Il CODICE dell'articolo sul listino di quel fornitore (REQ-MAG-029):
//    se la fattura lo stampa ed è lo stesso, non c'è dubbio.
// 2. Il NOME: un prodotto le cui parole stanno TUTTE nella descrizione
//    della riga («Gin Tanqueray» in «GIN TANQUERAY LONDON DRY 70CL»). Fra
//    più prodotti così vince quello con più parole, il più preciso; a pari
//    merito non si sceglie.
// Senza nessuno dei due la riga resta da abbinare: chi rivede sceglie il
// prodotto, o la lascia fuori.
export function prodottoDellaRiga(riga, { items = [], listini = [], supplierId = null } = {}) {
  const codice = parole(riga?.codice).join('')
  if (codice && supplierId) {
    const dalListino = (listini || []).find(
      (r) => r?.supplier_id === supplierId && r?.item_id && parole(r?.code).join('') === codice
    )
    const item = dalListino && (items || []).find((i) => i.id === dalListino.item_id)
    if (item) return item
  }
  const letta = paroleUtili(riga?.descrizione)
  if (letta.length === 0) return null
  let migliore = null
  let quante = 0
  let pari = false
  for (const item of items || []) {
    const sue = paroleUtili(item?.name)
    if (!tutteIn(sue, letta)) continue
    if (sue.length > quante) {
      migliore = item
      quante = sue.length
      pari = false
    } else if (sue.length === quante) {
      pari = true
    }
  }
  return pari ? null : migliore
}

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const arrotonda = (v, cifre = 4) => Math.round(v * 10 ** cifre) / 10 ** cifre

// IL COSTO DI UN PEZZO, DOPO LO SCONTO DI RIGA: è quello che si è pagato,
// ed è quello che va nel costo del prodotto. Senza prezzo unitario si
// ricava dall'importo della riga diviso la quantità.
export function costoDellaRiga(riga) {
  const prezzo = numero(riga?.prezzo_unitario)
  const sconto = numero(riga?.sconto_percentuale) ?? 0
  if (prezzo != null) return arrotonda(prezzo * (1 - sconto / 100))
  const importo = numero(riga?.importo)
  const qta = numero(riga?.quantita)
  return importo != null && qta ? arrotonda(importo / qta) : null
}

// Una data AAAA-MM-GG vera, o null: «2026-13-45» non è una data.
function dataValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s
}

// LA PROPOSTA, da mostrare e correggere. Le righe riconosciute partono
// incluse; quelle senza prodotto partono escluse, con la descrizione letta
// in vista, perché chi rivede scelga.
export function propostaDaFattura(risultato, { suppliers = [], items = [], listini = [], oggi = new Date() } = {}) {
  const r = risultato || {}
  const fornitore = fornitoreDellaFattura(r.fornitore, suppliers)
  const righe = (Array.isArray(r.righe) ? r.righe : []).map((riga, i) => {
    const item = prodottoDellaRiga(riga, { items, listini, supplierId: fornitore?.id ?? null })
    return {
      chiave: i,
      letta: String(riga?.descrizione ?? ''),
      codice: riga?.codice ?? null,
      item_id: item?.id ?? '',
      quantita: numero(riga?.quantita) ?? 1,
      costo: costoDellaRiga(riga) ?? 0,
      iva: numero(riga?.aliquota_iva) ?? item?.vat ?? 22,
      includi: Boolean(item),
    }
  })
  return {
    supplier_id: fornitore?.id ?? '',
    fornitore_letto: r.fornitore?.ragione_sociale ?? null,
    number: r.numero ?? '',
    date: dataValida(r.data) ?? oggi.toISOString().slice(0, 10),
    amount: numero(r.totale) ?? '',
    righe,
    daVerificare: (Array.isArray(r.da_verificare) ? r.da_verificare : []).filter((x) => typeof x === 'string'),
  }
}

// IL DOCUMENTO DA REGISTRARE, nella forma di «Nuovo documento». Una
// fattura letta è una Fattura: una proforma non porta il numero fiscale,
// e chi ne ha una la corregge qui.
export function documentoDaProposta(proposta, suppliers = []) {
  const sup = suppliers.find((s) => s.id === proposta.supplier_id)
  return {
    supplier_id: proposta.supplier_id,
    supplier_name: sup?.name ?? '',
    number: String(proposta.number ?? '').trim() || null,
    doc_type: 'Fattura',
    date: proposta.date,
    amount: Number(String(proposta.amount ?? '').replace(',', '.')) || 0,
    notes: null,
    paid: false,
  }
}

// LE RIGHE DA REGISTRARE: solo quelle incluse e con un prodotto. La forma è
// quella di «Aggiungi prodotti» (rigaDaProdotto), con quantità, costo e IVA
// della fattura al posto di quelli in archivio.
export function righeDaProposta(proposta, { items = [], listini = [] } = {}) {
  const perId = new Map(items.map((i) => [i.id, i]))
  return proposta.righe
    .filter((r) => r.includi && perId.has(r.item_id))
    .map((r) => ({
      ...rigaDaProdotto(perId.get(r.item_id), { listini, supplierId: proposta.supplier_id, qty: r.quantita }),
      unit_cost: Number(r.costo) || 0,
      vat: Number(r.iva) || 0,
    }))
}

// Si può registrare? Serve il fornitore (come in «Nuovo documento») e
// l'importo; le righe no: una fattura si registra anche senza abbinarle.
export const propostaRegistrabile = (proposta) =>
  Boolean(proposta?.supplier_id) && String(proposta?.amount ?? '').trim() !== ''
