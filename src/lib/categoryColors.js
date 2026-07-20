// Colori delle categorie, come nell'app SumUp POS: ogni categoria ha un
// colore stabile (pallino nella colonna categorie, angolo colorato sulle
// tile prodotto). L'assegnazione è deterministica dal nome/id della
// categoria, così resta identica su tutti i dispositivi senza configurarla.

export const CATEGORY_PALETTE = [
  '#e74c3c', // rosso
  '#e67e22', // arancio
  '#f1c40f', // giallo
  '#2ecc71', // verde
  '#1abc9c', // teal
  '#3498db', // azzurro
  '#2962ff', // blu
  '#9b59b6', // viola
  '#e91e8c', // magenta
  '#795548', // marrone
  '#607d8b', // grigio-blu
  '#00bcd4', // ciano
]

// Hash stabile (djb2) → indice nella palette.
export function categoryColor(key) {
  const s = String(key || '')
  if (!s) return null
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length]
}

// Colore di una categoria: quello CUSTOM se impostato, altrimenti quello
// automatico deterministico (djb2 sull'id/nome).
export function catColor(cat) {
  return cat?.color || categoryColor(cat?.id ?? cat?.name)
}

// Mappa colore per i drink a partire dalle categorie note: preferisce
// l'id della categoria (stabile ai rinomini), con fallback sul nome.
export function drinkCategoryColor(drink, cats) {
  const cat = (cats || []).find(
    (c) => c.id === drink?.category_id || (drink?.category && c.name === drink.category)
  )
  if (cat?.color) return cat.color
  const key = cat?.id ?? cat?.name ?? drink?.category_id ?? drink?.category
  return categoryColor(key)
}

// Set di icone (emoji) proponibili per le categorie di un bar.
export const CATEGORY_ICONS = [
  '🍸', '🍹', '🍺', '🍷', '🥃', '🍾', '🥂', '🍶', '🧉', '🥤',
  '☕', '🍵', '🧃', '🧊', '🫗', '🍋', '🍊', '🍓', '🌿', '🔥',
  '⭐', '💎', '🎩', '🎲', '🍫', '🍟', '🍕', '🥨', '🥜', '🧀',
]
