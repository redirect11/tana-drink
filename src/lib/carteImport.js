// Parser dell'export CSV prodotti di SumUp ("carte"). Logica pura,
// condivisa tra il pannello admin (upload) e scripts/import-carte.js.
//
// Particolarità dell'export:
// - encoding ISO-8859-1 (emoji e apostrofi tipografici persi come '?')
// - campi quotati, anche multilinea (descrizioni)
// - Price e Cost con virgola decimale NON quotata → occupano due colonne

// CSV state-machine: gestisce virgolette, escape "" e campi multilinea.
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f.trim())) rows.push(row)
      row = []
    } else field += ch
  }
  if (field || row.length) { row.push(field); if (row.some((f) => f.trim())) rows.push(row) }
  return rows
}

// Ripristina gli apostrofi tra lettere e rimuove i '?' orfani (caratteri
// persi nell'export ISO-8859: emoji, apostrofi tipografici…).
export function cleanText(s) {
  return s
    .replace(/(\p{L})\?(\p{L})/gu, "$1'$2")
    .replace(/[ \t]*\?+[ \t]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// Decodifica un ArrayBuffer: prova UTF-8 strict, altrimenti ISO-8859-1.
export function decodeCsvBuffer(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('iso-8859-1').decode(buffer)
  }
}

// Parsa l'export "carte" di SumUp.
// Restituisce { products, categories, skipped } o lancia se il file non
// sembra un export valido.
export function parseCarteCsv(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('File vuoto o non valido.')
  const header = rows[0]
  const idx = {
    productId: header.indexOf('ProductId'),
    category: header.indexOf('CategoryName'),
    name: header.indexOf('Name'),
    description: header.indexOf('Description'),
    price: header.indexOf('Price'),
  }
  if (idx.productId < 0 || idx.category < 0 || idx.name < 0 || idx.price < 0) {
    throw new Error('Intestazioni mancanti: non sembra un export prodotti di SumUp.')
  }

  const products = []
  let skipped = 0
  for (const f of rows.slice(1)) {
    if (f.length !== header.length) { skipped++; continue }
    // Price occupa due colonne (euro, centesimi) per la virgola non quotata.
    const price = Number.parseFloat(`${f[idx.price]}.${f[idx.price + 1] || 0}`)
    const name = (f[idx.name] || '').trim()
    if (!name || !Number.isFinite(price)) { skipped++; continue }
    products.push({
      sumup_product_id: f[idx.productId],
      category: (f[idx.category] || '').trim() || 'Altro',
      name: cleanText(name),
      description: f[idx.description]?.trim() ? cleanText(f[idx.description]) : null,
      price,
    })
  }

  // Categorie nell'ordine di prima apparizione.
  const categories = [...new Set(products.map((p) => p.category))]
  if (products.length === 0) throw new Error('Nessun prodotto valido nel file.')
  return { products, categories, skipped }
}
