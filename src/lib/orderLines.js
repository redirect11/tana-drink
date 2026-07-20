// Righe dell'ordine in composizione (POS / bozza dettaglio). Ogni tocco
// aggiunge una RIGA A SÉ: gli items uguali NON si sommano in automatico.
// L'unione è manuale ("Unisci uguali") e reversibile ("Dissocia").
// Due righe sono "uguali" solo se combaciano drink, nome, prezzo e
// ingredienti: un item modificato (prezzo/nome/ricetta) è diverso e non
// si accorpa con gli originali.

let seq = 0
// Id di riga univoco (locale): base + contatore per evitare collisioni
// anche nello stesso millisecondo. `rand` iniettabile per i test.
export function makeLineId(rand = Math.random) {
  seq += 1
  return `ln-${Date.now().toString(36)}-${seq}-${Math.floor(rand() * 1e6)}`
}

// Firma di equivalenza: righe con la stessa firma sono "uguali".
export function lineSignature(line) {
  const recipe = Array.isArray(line.recipe_items)
    ? line.recipe_items
        .map((r) => `${r.inventory_item_id || r.name}:${r.qty}`)
        .sort()
        .join(',')
    : ''
  return [
    line.custom ? 'c' : 'd',
    line.drink_id ?? '',
    (line.name ?? '').trim().toLowerCase(),
    Number(line.price ?? line.unit_price ?? 0),
    recipe,
  ].join('|')
}

// Accorpa le righe uguali (stessa firma) sommandone le quantità; mantiene
// l'ordine di prima comparsa e il line_id della prima riga di ogni gruppo.
export function mergeLines(lines) {
  const bySig = new Map()
  const out = []
  for (const l of lines || []) {
    const sig = lineSignature(l)
    const ex = bySig.get(sig)
    if (ex) ex.qty += l.qty
    else {
      const copy = { ...l }
      bySig.set(sig, copy)
      out.push(copy)
    }
  }
  return out
}

// Ci sono righe uguali accorpabili? (per abilitare "Unisci uguali")
export function hasMergeable(lines) {
  const seen = new Set()
  for (const l of lines || []) {
    const sig = lineSignature(l)
    if (seen.has(sig)) return true
    seen.add(sig)
  }
  return false
}

// Spezza una riga (qty>1) in righe da 1 ciascuna, al posto dell'originale.
export function splitLine(lines, lineId, makeId = makeLineId) {
  const out = []
  for (const l of lines || []) {
    if (l.line_id === lineId && l.qty > 1) {
      for (let i = 0; i < l.qty; i++) out.push({ ...l, line_id: i === 0 ? l.line_id : makeId(), qty: 1 })
    } else {
      out.push(l)
    }
  }
  return out
}

// Quantità per drink (griglia prodotti): somma solo le righe di catalogo
// NON modificate (i custom/modificati escono dal conteggio della tile).
export function qtyByDrink(lines) {
  const m = {}
  for (const l of lines || []) {
    if (l.custom) continue
    if (l.drink_id) m[l.drink_id] = (m[l.drink_id] || 0) + l.qty
  }
  return m
}

export const linesTotal = (lines) =>
  (lines || []).reduce((s, l) => s + l.qty * Number(l.price ?? l.unit_price ?? 0), 0)
export const linesCount = (lines) => (lines || []).reduce((s, l) => s + l.qty, 0)
