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

// ── Estrazione inventario dal catalogo ────────────────────────────────
// Individua i prodotti che sono bottiglie/ingredienti (serviti senza
// preparazione) e li trasforma in voci di inventario con default sensati.

// Voci che sono fasce di prezzo o preparazioni, non prodotti fisici.
const NON_PRODUCT = /^(SHOT\b|LAVORAZIONE|GIN TONIC|GIN LEMON|VODKA TONIC|VODKA LEMON|LEMON \d|JOHN COLLINS|RECUPERO|CALICE \d|VINO \d|DRINK \d|SPECIAL|SOUR\b|PREMIUM \d|COCKTAIL \d|GRANITA)/i

// Mixer in bottiglietta (ml) dentro la categoria BIBITE.
const MIXERS = /TONICA|FEVER TREE|THOMAS HENRY|SCHWEPPES|FENTIMANS|TASSONI|GINGER BEER|^SUCCO/i

const titleCase = (s) =>
  s.toLowerCase().replace(/(^|[\s'\-./])\p{L}/gu, (m) => m.toUpperCase())

// Restituisce { categories: [{key,name,sort_order}], items: [{cat,name,unit,package_size,stock,low_threshold}] }
export function extractInventory(products) {
  const items = []
  const seen = new Set()
  const push = (item) => {
    const k = item.name.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    items.push(item)
  }

  for (const p of products) {
    if (NON_PRODUCT.test(p.name)) continue
    const name = titleCase(p.name)

    switch (p.category) {
      case 'DISTILLATI':
        push({ cat: 'distillati', name, unit: 'ml', package_size: 700, stock: 700, low_threshold: 140 })
        break
      case 'GIN & VODKA':
        push({ cat: 'gin_vodka', name, unit: 'ml', package_size: 700, stock: 700, low_threshold: 140 })
        break
      case 'AMARI':
        push({ cat: 'liquori', name, unit: 'ml', package_size: 700, stock: 700, low_threshold: 140 })
        break
      case 'BIRRE':
        push({ cat: 'birre', name, unit: 'pz', package_size: null, stock: 12, low_threshold: 4 })
        break
      case 'BIBITE':
        if (MIXERS.test(p.name)) {
          const big = /^SUCCO/i.test(p.name)
          push({ cat: 'mixer', name, unit: 'ml', package_size: big ? 1000 : 200, stock: big ? 2000 : 2000, low_threshold: big ? 500 : 400 })
        } else {
          push({ cat: 'soft', name, unit: 'pz', package_size: null, stock: 24, low_threshold: 6 })
        }
        break
      case 'VINO':
        if (/PROSECCO/i.test(p.name)) {
          push({ cat: 'bollicine', name: 'Prosecco', unit: 'ml', package_size: 750, stock: 1500, low_threshold: 750 })
        } else if (/^CALICE|BOTTIGLIA|SANGRIA|PORTO/i.test(p.name) === false) {
          push({ cat: 'bollicine', name, unit: 'ml', package_size: 750, stock: 750, low_threshold: 750 })
        }
        break
      default:
        break // cocktail, signature, food… non sono ingredienti
    }
  }

  const CATS = [
    ['distillati', 'Distillati'],
    ['gin_vodka', 'Gin e Vodka'],
    ['liquori', 'Liquori e Amari'],
    ['bollicine', 'Vini e Bollicine'],
    ['birre', 'Birre'],
    ['mixer', 'Mixer'],
    ['soft', 'Soft Drink'],
  ]
  const used = new Set(items.map((i) => i.cat))
  const categories = CATS.filter(([key]) => used.has(key)).map(([key, name], i) => ({
    key,
    name,
    sort_order: i,
  }))
  return { categories, items }
}

// ── Collegamento 1:1 menu → inventario ────────────────────────────────
// Per le voci di menu che non sono preparazioni, individua l'ingrediente
// corrispondente e la quantità consumata per vendita.
// Restituisce { invName, qty, unit } oppure null (voce non collegabile).
export function recipeLinkFor(product) {
  if (NON_PRODUCT.test(product.name)) {
    // Eccezione: i calici di vino nominati restano collegabili.
    if (!/^CALICE \p{L}/iu.test(product.name)) return null
  }
  const name = titleCase(product.name)

  switch (product.category) {
    case 'DISTILLATI':
      return { invName: name, qty: 40, unit: 'ml' } // servito liscio/shot
    case 'AMARI':
      return { invName: name, qty: 40, unit: 'ml' }
    case 'GIN & VODKA':
      // Gin tonic col gin premium indicato: scala il distillato.
      return { invName: name, qty: 50, unit: 'ml' }
    case 'BIRRE':
      return { invName: name, qty: 1, unit: 'pz' }
    case 'BIBITE':
      if (MIXERS.test(product.name)) {
        const big = /^SUCCO/i.test(product.name)
        return { invName: name, qty: 200, unit: 'ml' } // bottiglietta intera / bicchiere
      }
      return { invName: name, qty: 1, unit: 'pz' }
    case 'VINO': {
      if (/PROSECCO/i.test(product.name)) {
        const qty = /BOTTIGLIA/i.test(product.name) ? 750 : 150
        return { invName: 'Prosecco', qty, unit: 'ml' }
      }
      const calice = product.name.match(/^CALICE (\p{L}.+)/iu)
      if (calice) return { invName: titleCase(calice[1]), qty: 150, unit: 'ml' }
      if (/^CALICE|BOTTIGLIA|SANGRIA|PORTO/i.test(product.name)) return null
      // Vino nominato: sopra ~15€ è la bottiglia, altrimenti il calice.
      const qty = product.price >= 15 ? 750 : 150
      return { invName: name, qty, unit: 'ml' }
    }
    default:
      return null
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
