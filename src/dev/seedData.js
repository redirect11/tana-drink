// =====================================================================
//  Dati di seed condivisi: usati da scripts/seed.js (Node, Admin SDK) e
//  dal pannello sviluppatore in-app (solo ambiente emulatore).
// =====================================================================

// ── Categorie inventario ──────────────────────────────────────────────
export const INV_CATS = [
  { key: 'distillati',    name: 'Distillati',          sort_order: 0 },
  { key: 'liquori',       name: 'Liquori e Amari',     sort_order: 1 },
  { key: 'bollicine',     name: 'Vini e Bollicine',    sort_order: 2 },
  { key: 'birre',         name: 'Birre',                sort_order: 3 },
  { key: 'mixer',         name: 'Mixer e Soft Drink',  sort_order: 4 },
  { key: 'freschi',       name: 'Freschi e Garnish',   sort_order: 5 },
  { key: 'base',          name: 'Ingredienti Base',    sort_order: 6 },
]

// ── Ingredienti (unit base: ml per liquidi, g per solidi, pz per pezzi)
//    package_size in unità base (ml o g); stock = 3 bottiglie aperte
export const INV_ITEMS = [
  // Distillati
  { cat: 'distillati', name: 'Rum Bianco',         unit: 'ml', package_size: 700, stock: 2100, low_threshold: 700 },
  { cat: 'distillati', name: 'Rum Scuro',           unit: 'ml', package_size: 700, stock: 1400, low_threshold: 700 },
  { cat: 'distillati', name: 'Gin',                 unit: 'ml', package_size: 700, stock: 2100, low_threshold: 700 },
  { cat: 'distillati', name: 'Vodka',               unit: 'ml', package_size: 700, stock: 2100, low_threshold: 700 },
  { cat: 'distillati', name: 'Tequila Blanco',      unit: 'ml', package_size: 700, stock: 1400, low_threshold: 700 },
  { cat: 'distillati', name: 'Bourbon',             unit: 'ml', package_size: 700, stock: 1400, low_threshold: 700 },
  // Liquori e Amari
  { cat: 'liquori', name: 'Aperol',                 unit: 'ml', package_size: 700, stock: 2100, low_threshold: 700 },
  { cat: 'liquori', name: 'Campari',                unit: 'ml', package_size: 700, stock: 1400, low_threshold: 700 },
  { cat: 'liquori', name: 'Cointreau',              unit: 'ml', package_size: 700, stock: 700,  low_threshold: 350 },
  { cat: 'liquori', name: 'Vermouth Rosso',         unit: 'ml', package_size: 750, stock: 1500, low_threshold: 750 },
  { cat: 'liquori', name: 'Limoncello',             unit: 'ml', package_size: 700, stock: 700,  low_threshold: 350 },
  { cat: 'liquori', name: 'Baileys',                unit: 'ml', package_size: 700, stock: 700,  low_threshold: 350 },
  { cat: 'liquori', name: 'Amaretto',               unit: 'ml', package_size: 700, stock: 700,  low_threshold: 350 },
  // Vini e Bollicine
  { cat: 'bollicine', name: 'Prosecco',             unit: 'ml', package_size: 750, stock: 3750, low_threshold: 750 },
  { cat: 'bollicine', name: 'Vino Bianco',          unit: 'ml', package_size: 750, stock: 750,  low_threshold: 750 },
  // Birre
  { cat: 'birre', name: 'Birra Pils (spina)',       unit: 'ml', package_size: 20000, stock: 40000, low_threshold: 5000 },
  { cat: 'birre', name: 'Birra IPA (spina)',        unit: 'ml', package_size: 20000, stock: 20000, low_threshold: 5000 },
  { cat: 'birre', name: 'Birra Bottiglia',          unit: 'pz', package_size: null, stock: 24, low_threshold: 6 },
  // Mixer e Soft Drink
  { cat: 'mixer', name: 'Soda Water',               unit: 'ml', package_size: 1000, stock: 10000, low_threshold: 2000 },
  { cat: 'mixer', name: 'Acqua Tonica',             unit: 'ml', package_size: 200,  stock: 4000,  low_threshold: 600 },
  { cat: 'mixer', name: 'Ginger Beer',              unit: 'ml', package_size: 200,  stock: 2000,  low_threshold: 400 },
  { cat: 'mixer', name: 'Cola',                     unit: 'ml', package_size: 250,  stock: 5000,  low_threshold: 500 },
  { cat: 'mixer', name: 'Succo di Lime',            unit: 'ml', package_size: 1000, stock: 2000,  low_threshold: 500 },
  { cat: 'mixer', name: 'Succo di Limone',          unit: 'ml', package_size: 1000, stock: 2000,  low_threshold: 500 },
  { cat: 'mixer', name: 'Succo di Ananas',          unit: 'ml', package_size: 1000, stock: 2000,  low_threshold: 500 },
  { cat: 'mixer', name: 'Succo di Cranberry',       unit: 'ml', package_size: 1000, stock: 2000,  low_threshold: 500 },
  { cat: 'mixer', name: "Succo d'Arancia",          unit: 'ml', package_size: 1000, stock: 2000,  low_threshold: 500 },
  // Freschi e Garnish
  { cat: 'freschi', name: 'Lime Fresco',            unit: 'pz', package_size: null, stock: 20, low_threshold: 5 },
  { cat: 'freschi', name: 'Limone Fresco',          unit: 'pz', package_size: null, stock: 20, low_threshold: 5 },
  { cat: 'freschi', name: 'Menta Fresca',           unit: 'pz', package_size: null, stock: 10, low_threshold: 3 },
  { cat: 'freschi', name: 'Arancia',                unit: 'pz', package_size: null, stock: 10, low_threshold: 3 },
  // Ingredienti Base
  { cat: 'base', name: 'Sciroppo di Zucchero',      unit: 'ml', package_size: 700, stock: 1400, low_threshold: 350 },
  { cat: 'base', name: 'Zucchero di Canna',         unit: 'g',  package_size: 1000, stock: 2000, low_threshold: 200 },
  { cat: 'base', name: 'Sale Fino',                 unit: 'g',  package_size: 1000, stock: 1000, low_threshold: 100 },
  { cat: 'base', name: 'Panna Fresca',              unit: 'ml', package_size: 200,  stock: 400,  low_threshold: 100 },
]

// ── Categorie drink ───────────────────────────────────────────────────
export const DRINK_CATS = [
  { key: 'aperitivi',  name: 'Aperitivi',           sort_order: 0 },
  { key: 'classici',   name: 'Cocktail Classici',   sort_order: 1 },
  { key: 'signature',  name: 'Cocktail della Casa', sort_order: 2 },
  { key: 'long',       name: 'Long Drinks',         sort_order: 3 },
  { key: 'analcolici', name: 'Analcolici',          sort_order: 4 },
  { key: 'birre',      name: 'Birre',                sort_order: 5 },
  { key: 'bollicine',  name: 'Bollicine',           sort_order: 6 },
  { key: 'shots',      name: 'Shots',               sort_order: 7 },
]

// ── Drink (recipe usa nomi inventario → rimpiazzati con ID reali)
//    qty nelle ricette in unità base: ml per liquidi, g per solidi, pz per pezzi
export const DRINKS = [
  // --- Aperitivi ---
  {
    cat: 'aperitivi', name: 'Spritz Aperol', price: 6.0,
    description: "L'aperitivo estivo per eccellenza",
    recipe: '4cl Aperol, 6cl prosecco, soda, arancia',
    recipe_items: [
      { item: 'Aperol', qty: 40 },
      { item: 'Prosecco', qty: 60 },
      { item: 'Soda Water', qty: 20 },
      { item: 'Arancia', qty: 0.25 },
    ],
  },
  {
    cat: 'aperitivi', name: 'Spritz Campari', price: 6.0,
    description: 'Amaro e vivace, con Campari',
    recipe: 'Ghiaccio nel calice, Campari e prosecco, un dito di soda.\nMescola piano e fetta d’arancia.',
    recipe_items: [
      { item: 'Campari', qty: 40 },
      { item: 'Prosecco', qty: 60 },
      { item: 'Soda Water', qty: 20 },
      { item: 'Arancia', qty: 0.25 },
    ],
  },
  {
    cat: 'aperitivi', name: 'Negroni Sbagliato', price: 7.0,
    description: 'Il Negroni col prosecco al posto del gin',
    recipe: 'Ghiaccio nel tumbler, Campari e vermouth, prosecco per ultimo.\nMescola una volta sola: le bollicine non si girano. Mezza fetta d’arancia.',
    recipe_items: [
      { item: 'Campari', qty: 30 },
      { item: 'Vermouth Rosso', qty: 30 },
      { item: 'Prosecco', qty: 40 },
    ],
  },
  {
    cat: 'aperitivi', name: 'Hugo', price: 7.0,
    description: 'Fresco e floreale con sciroppo di sambuco e menta',
    recipe: 'Calice pieno di ghiaccio, menta schiacciata appena con le mani.\nProsecco, un dito di soda, lime.',
    recipe_items: [
      { item: 'Prosecco', qty: 80 },
      { item: 'Soda Water', qty: 20 },
      { item: 'Menta Fresca', qty: 0.5 },
      { item: 'Lime Fresco', qty: 0.25 },
    ],
  },
  // --- Cocktail Classici ---
  {
    cat: 'classici', name: 'Negroni', price: 8.0,
    description: 'Il classico italiano per eccellenza',
    recipe: 'Tumbler basso, ghiaccio grande. Gin, Campari, vermouth.\nMescola dieci secondi, scorza d’arancia strizzata sopra.',
    recipe_items: [
      { item: 'Gin', qty: 30 },
      { item: 'Campari', qty: 30 },
      { item: 'Vermouth Rosso', qty: 30 },
    ],
  },
  {
    cat: 'classici', name: 'Old Fashioned', price: 9.0,
    description: 'Bourbon, zucchero e angostura',
    recipe: 'Zucchero e angostura sul fondo, bagna col bourbon e sciogli.\nGhiaccio grande, resto del bourbon, mescola. Scorza d’arancia.',
    recipe_items: [
      { item: 'Bourbon', qty: 60 },
      { item: 'Zucchero di Canna', qty: 5 },
    ],
  },
  {
    cat: 'classici', name: 'Manhattan', price: 9.0,
    description: 'Bourbon e vermouth, elegante e deciso',
    recipe: 'Mixing glass col ghiaccio: bourbon, vermouth, due gocce di angostura.\nMescola, filtra in coppetta fredda. Ciliegia.',
    recipe_items: [
      { item: 'Bourbon', qty: 50 },
      { item: 'Vermouth Rosso', qty: 25 },
    ],
  },
  {
    cat: 'classici', name: 'Mojito', price: 8.0,
    description: 'Rum, lime, menta e soda: il fresco cubano',
    recipe: 'Lime a spicchi e zucchero nel bicchiere, pesta piano.\nMenta schiacciata con le mani, rum, ghiaccio tritato, soda.\nMescola dal fondo verso l’alto.',
    recipe_items: [
      { item: 'Rum Bianco', qty: 50 },
      { item: 'Lime Fresco', qty: 0.5 },
      { item: 'Menta Fresca', qty: 1 },
      { item: 'Zucchero di Canna', qty: 10 },
      { item: 'Soda Water', qty: 100 },
    ],
  },
  {
    cat: 'classici', name: 'Daiquiri', price: 8.0,
    description: 'Rum, lime e sciroppo: semplice e perfetto',
    recipe: 'Shaker con ghiaccio: rum, lime, sciroppo.\nShakera forte, filtra in coppetta fredda.',
    recipe_items: [
      { item: 'Rum Bianco', qty: 50 },
      { item: 'Succo di Lime', qty: 20 },
      { item: 'Sciroppo di Zucchero', qty: 15 },
    ],
  },
  {
    cat: 'classici', name: 'Margarita', price: 8.0,
    description: 'Tequila, Cointreau e lime sul bordo salato',
    recipe: 'Bordo del bicchiere col sale, solo mezzo giro.\nShaker: tequila, Cointreau, lime. Shakera e filtra.',
    recipe_items: [
      { item: 'Tequila Blanco', qty: 50 },
      { item: 'Cointreau', qty: 20 },
      { item: 'Succo di Lime', qty: 20 },
      { item: 'Sale Fino', qty: 2 },
    ],
  },
  {
    cat: 'classici', name: 'Cosmopolitan', price: 8.0,
    description: 'Vodka, Cointreau, cranberry e lime',
    recipe: 'Shaker con ghiaccio: vodka, Cointreau, cranberry, lime.\nShakera, filtra in coppetta. Scorza di limone.',
    recipe_items: [
      { item: 'Vodka', qty: 40 },
      { item: 'Cointreau', qty: 15 },
      { item: 'Succo di Cranberry', qty: 30 },
      { item: 'Succo di Lime', qty: 10 },
    ],
  },
  {
    cat: 'classici', name: 'Gin Tonic', price: 8.0,
    description: 'Gin e tonica artigianale, guarnito con botaniche',
    recipe: 'Balloon pieno di ghiaccio, gin, tonica versata sul cucchiaio.\nMescola una volta. Scorza di limone.',
    recipe_items: [
      { item: 'Gin', qty: 50 },
      { item: 'Acqua Tonica', qty: 150 },
    ],
  },
  {
    cat: 'classici', name: 'Moscow Mule', price: 8.0,
    description: 'Vodka, ginger beer e lime nel mug di rame',
    recipe: 'Tazza di rame col ghiaccio: vodka, lime, ginger beer.\nMescola piano, lime a spicchio.',
    recipe_items: [
      { item: 'Vodka', qty: 50 },
      { item: 'Ginger Beer', qty: 150 },
      { item: 'Succo di Lime', qty: 15 },
    ],
  },
  {
    cat: 'classici', name: 'Americano', price: 6.0,
    description: 'Campari, vermouth e soda: leggero e bitter',
    recipe: 'Tumbler col ghiaccio: Campari e vermouth, soda a colmare.\nFetta d’arancia.',
    recipe_items: [
      { item: 'Campari', qty: 30 },
      { item: 'Vermouth Rosso', qty: 30 },
      { item: 'Soda Water', qty: 80 },
    ],
  },
  // --- Cocktail della Casa ---
  {
    cat: 'signature', name: 'Il Coniglio', price: 10.0,
    description: 'Il nostro signature: gin, Aperol, lime e prosecco',
    recipe: 'Shaker: gin, Aperol, lime. Shakera e filtra nel calice col ghiaccio.\nProsecco per ultimo, mescola una volta.',
    recipe_items: [
      { item: 'Gin', qty: 40 },
      { item: 'Aperol', qty: 20 },
      { item: 'Succo di Lime', qty: 15 },
      { item: 'Prosecco', qty: 40 },
    ],
  },
  {
    cat: 'signature', name: 'Tana Sour', price: 9.0,
    description: 'Bourbon, limone, sciroppo e schiuma di panna',
    recipe: 'Shaker: bourbon, limone, sciroppo, un cucchiaio di panna.\nShakera forte (fa la schiuma), filtra nel tumbler col ghiaccio.',
    recipe_items: [
      { item: 'Bourbon', qty: 50 },
      { item: 'Succo di Limone', qty: 25 },
      { item: 'Sciroppo di Zucchero', qty: 15 },
      { item: 'Panna Fresca', qty: 20 },
    ],
  },
  {
    cat: 'signature', name: 'White Rabbit', price: 9.0,
    description: 'Vodka, Cointreau, ananas e ginger beer',
    recipe: 'Shaker: vodka, Cointreau, ananas. Filtra nel tumbler col ghiaccio.\nGinger beer a colmare.',
    recipe_items: [
      { item: 'Vodka', qty: 40 },
      { item: 'Cointreau', qty: 20 },
      { item: 'Succo di Ananas', qty: 40 },
      { item: 'Ginger Beer', qty: 60 },
    ],
  },
  // --- Long Drinks ---
  {
    cat: 'long', name: 'Cuba Libre', price: 7.0,
    description: 'Rum scuro, Cola e una spruzzata di lime',
    recipe: 'Ghiaccio, rum, lime strizzato dentro, cola a colmare.\nMescola una volta.',
    recipe_items: [
      { item: 'Rum Scuro', qty: 50 },
      { item: 'Cola', qty: 150 },
      { item: 'Succo di Lime', qty: 10 },
    ],
  },
  {
    cat: 'long', name: 'Vodka Soda', price: 7.0,
    description: 'Semplice, leggero, con un twist di lime',
    recipe: 'Ghiaccio, vodka, soda. Lime strizzato e lasciato dentro.',
    recipe_items: [
      { item: 'Vodka', qty: 50 },
      { item: 'Soda Water', qty: 150 },
      { item: 'Lime Fresco', qty: 0.25 },
    ],
  },
  {
    cat: 'long', name: 'Gin Fizz', price: 8.0,
    description: 'Gin, succo di limone e soda: fresco e frizzante',
    recipe: 'Shaker: gin, limone, sciroppo. Shakera, filtra nel tumbler col ghiaccio.\nSoda a colmare.',
    recipe_items: [
      { item: 'Gin', qty: 50 },
      { item: 'Succo di Limone', qty: 20 },
      { item: 'Sciroppo di Zucchero', qty: 15 },
      { item: 'Soda Water', qty: 80 },
    ],
  },
  {
    cat: 'long', name: 'Tequila Sunrise', price: 8.0,
    description: 'Tequila, arancia e granatina: tramonto nel bicchiere',
    recipe: 'Ghiaccio, tequila e arancia. La granatina versata piano sul fondo,\nsenza mescolare: deve restare l’alba.',
    recipe_items: [
      { item: 'Tequila Blanco', qty: 50 },
      { item: "Succo d'Arancia", qty: 100 },
    ],
  },
  // --- Analcolici ---
  {
    cat: 'analcolici', name: 'Virgin Mojito', price: 5.0,
    description: 'Tutta la freschezza del Mojito, senza alcol',
    recipe: 'Come il Mojito ma senza rum: lime e zucchero pestati piano,\nmenta, ghiaccio tritato, soda.',
    recipe_items: [
      { item: 'Lime Fresco', qty: 0.5 },
      { item: 'Menta Fresca', qty: 1 },
      { item: 'Zucchero di Canna', qty: 10 },
      { item: 'Soda Water', qty: 120 },
    ],
  },
  {
    cat: 'analcolici', name: 'Tana Detox', price: 5.0,
    description: 'Ananas, lime e ginger beer: dissetante e speziato',
    recipe: 'Ghiaccio, ananas e lime, ginger beer a colmare.\nMescola dal fondo.',
    recipe_items: [
      { item: 'Succo di Ananas', qty: 80 },
      { item: 'Succo di Lime', qty: 20 },
      { item: 'Ginger Beer', qty: 60 },
    ],
  },
  {
    cat: 'analcolici', name: 'Sunrise Analcolico', price: 5.0,
    description: 'Arancia, cranberry e soda: colorato e fresco',
    recipe: 'Ghiaccio, arancia e cranberry, un dito di soda.\nSpicchio d’arancia.',
    recipe_items: [
      { item: "Succo d'Arancia", qty: 100 },
      { item: 'Succo di Cranberry', qty: 40 },
      { item: 'Soda Water', qty: 40 },
    ],
  },
  // --- Birre ---
  {
    cat: 'birre', name: 'Pils alla Spina 0,4L', price: 5.5,
    description: 'Birra artigianale bionda, leggera e fresca',
    recipe: 'Bicchiere bagnato, inclinato a 45°. Due dita di schiuma.',
    recipe_items: [{ item: 'Birra Pils (spina)', qty: 400 }],
  },
  {
    cat: 'birre', name: 'IPA alla Spina 0,4L', price: 6.0,
    description: 'India Pale Ale artigianale, luppolata e amara',
    recipe: 'Bicchiere bagnato, inclinato a 45°. Due dita di schiuma.',
    recipe_items: [{ item: 'Birra IPA (spina)', qty: 400 }],
  },
  {
    cat: 'birre', name: 'Birra in Bottiglia', price: 5.0,
    description: 'Birra in bottiglia da 33cl',
    recipe: 'Si serve stappata, col bicchiere accanto.',
    recipe_items: [{ item: 'Birra Bottiglia', qty: 1 }],
  },
  // --- Bollicine ---
  {
    cat: 'bollicine', name: 'Prosecco al Calice', price: 5.0,
    description: 'Prosecco DOC frizzante, 12cl',
    recipe: 'Calice freddo, versato piano lungo la parete.',
    recipe_items: [{ item: 'Prosecco', qty: 120 }],
  },
  {
    cat: 'bollicine', name: 'Vino Bianco al Calice', price: 5.0,
    description: 'Vino bianco secco, 12cl',
    recipe: 'Calice freddo, versato piano lungo la parete.',
    recipe_items: [{ item: 'Vino Bianco', qty: 120 }],
  },
  // --- Shots ---
  {
    cat: 'shots', name: 'Tequila Shot', price: 4.0,
    description: 'Con sale e lime',
    recipe: 'Sale sulla mano, shot, spicchio di lime.',
    recipe_items: [
      { item: 'Tequila Blanco', qty: 40 },
      { item: 'Sale Fino', qty: 2 },
      { item: 'Lime Fresco', qty: 0.25 },
    ],
  },
  {
    cat: 'shots', name: 'Limoncello Shot', price: 3.5,
    description: 'Freddo e agrumato',
    recipe: 'Dal congelatore, bicchierino freddo.',
    recipe_items: [{ item: 'Limoncello', qty: 40 }],
  },
  {
    cat: 'shots', name: 'Baileys Shot', price: 4.0,
    description: 'Cremoso e dolce',
    recipe: 'Bicchierino, senza ghiaccio.',
    recipe_items: [{ item: 'Baileys', qty: 40 }],
  },
  {
    cat: 'shots', name: 'Amaretto Shot', price: 4.0,
    description: 'Dolce e mandorlato',
    recipe: 'Bicchierino, a temperatura.',
    recipe_items: [{ item: 'Amaretto', qty: 40 }],
  },
]

// ── Immagini mock dei drink (file in public/drinks/) ─────────────────
export const DRINK_IMAGES = {
  'Spritz Aperol': '/drinks/spritz-aperol.jpg',
  'Spritz Campari': '/drinks/spritz-campari.jpg',
  'Negroni Sbagliato': '/drinks/negroni.jpg',
  'Hugo': '/drinks/hugo.jpg',
  'Negroni': '/drinks/negroni.jpg',
  'Old Fashioned': '/drinks/old-fashioned.jpg',
  'Manhattan': '/drinks/whiskey-sour.jpg',
  'Mojito': '/drinks/mojito.jpg',
  'Daiquiri': '/drinks/coupe.jpg',
  'Margarita': '/drinks/margarita.jpg',
  'Cosmopolitan': '/drinks/cocktail-rosso.jpg',
  'Gin Tonic': '/drinks/gin-tonic.jpg',
  'Moscow Mule': '/drinks/moscow-mule.jpg',
  'Americano': '/drinks/negroni.jpg',
  'Il Coniglio': '/drinks/coniglio.jpg',
  'Tana Sour': '/drinks/whiskey-sour.jpg',
  'White Rabbit': '/drinks/coupe.jpg',
  'Cuba Libre': '/drinks/cuba-libre.jpg',
  'Vodka Soda': '/drinks/gin-tonic.jpg',
  'Gin Fizz': '/drinks/hugo.jpg',
  'Tequila Sunrise': '/drinks/tequila-sunrise.jpg',
  'Virgin Mojito': '/drinks/mojito.jpg',
  'Tana Detox': '/drinks/detox.jpg',
  'Sunrise Analcolico': '/drinks/sunrise-analcolico.jpg',
  'Pils alla Spina 0,4L': '/drinks/birra.jpg',
  'IPA alla Spina 0,4L': '/drinks/spina.jpg',
  'Birra in Bottiglia': '/drinks/birra.jpg',
  'Prosecco al Calice': '/drinks/prosecco.jpg',
  'Vino Bianco al Calice': '/drinks/vino-bianco.jpg',
  'Tequila Shot': '/drinks/tequila-shot.jpg',
  'Limoncello Shot': '/drinks/shots.jpg',
  'Amaretto Shot': '/drinks/shots.jpg',
  'Baileys Shot': '/drinks/shots.jpg',
}

// ── Impostazioni iniziali del bar ─────────────────────────────────────
export const SEED_SETTINGS = {
  menu_only: false,
  coperto_enabled: false,
  coperto_amount: 2,
  service_charge_enabled: false,
  service_charge_percent: 10,
  tip_enabled: false,
  show_ingredient_quantities: true,
  service_mode: 'tavolo',
  eta_enabled: false,
  eta_base_minutes: 10,
  cancel_phrase_default: 'bancone',
  show_serving_board: true,
  queue_view: 'tabs',
  customer_accounts_enabled: true,
  geofence_enabled: false,
  venue_address: '',
  venue_lat: null,
  venue_lng: null,
  venue_radius_m: 150,
}
