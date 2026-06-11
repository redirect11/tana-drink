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
    recipe: '4cl Campari, 6cl prosecco, soda, arancia',
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
    recipe: '3cl Campari, 3cl vermouth rosso, 4cl prosecco',
    recipe_items: [
      { item: 'Campari', qty: 30 },
      { item: 'Vermouth Rosso', qty: 30 },
      { item: 'Prosecco', qty: 40 },
    ],
  },
  {
    cat: 'aperitivi', name: 'Hugo', price: 7.0,
    description: 'Fresco e floreale con sciroppo di sambuco e menta',
    recipe: '8cl prosecco, soda, menta, lime',
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
    recipe: '3cl gin, 3cl Campari, 3cl vermouth rosso',
    recipe_items: [
      { item: 'Gin', qty: 30 },
      { item: 'Campari', qty: 30 },
      { item: 'Vermouth Rosso', qty: 30 },
    ],
  },
  {
    cat: 'classici', name: 'Old Fashioned', price: 9.0,
    description: 'Bourbon, zucchero e angostura',
    recipe: '6cl bourbon, zucchero di canna, angostura',
    recipe_items: [
      { item: 'Bourbon', qty: 60 },
      { item: 'Zucchero di Canna', qty: 5 },
    ],
  },
  {
    cat: 'classici', name: 'Manhattan', price: 9.0,
    description: 'Bourbon e vermouth, elegante e deciso',
    recipe: '5cl bourbon, 2.5cl vermouth rosso, angostura',
    recipe_items: [
      { item: 'Bourbon', qty: 50 },
      { item: 'Vermouth Rosso', qty: 25 },
    ],
  },
  {
    cat: 'classici', name: 'Mojito', price: 8.0,
    description: 'Rum, lime, menta e soda: il fresco cubano',
    recipe: '5cl rum bianco, lime, menta, zucchero, soda',
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
    recipe: '5cl rum bianco, 2cl succo lime, 1.5cl sciroppo',
    recipe_items: [
      { item: 'Rum Bianco', qty: 50 },
      { item: 'Succo di Lime', qty: 20 },
      { item: 'Sciroppo di Zucchero', qty: 15 },
    ],
  },
  {
    cat: 'classici', name: 'Margarita', price: 8.0,
    description: 'Tequila, Cointreau e lime sul bordo salato',
    recipe: '5cl tequila, 2cl Cointreau, 2cl succo lime, sale',
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
    recipe: '4cl vodka, 1.5cl Cointreau, 3cl cranberry, 1cl lime',
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
    recipe: '5cl gin, 15cl acqua tonica',
    recipe_items: [
      { item: 'Gin', qty: 50 },
      { item: 'Acqua Tonica', qty: 150 },
    ],
  },
  {
    cat: 'classici', name: 'Moscow Mule', price: 8.0,
    description: 'Vodka, ginger beer e lime nel mug di rame',
    recipe: '5cl vodka, 15cl ginger beer, 1.5cl lime',
    recipe_items: [
      { item: 'Vodka', qty: 50 },
      { item: 'Ginger Beer', qty: 150 },
      { item: 'Succo di Lime', qty: 15 },
    ],
  },
  {
    cat: 'classici', name: 'Americano', price: 6.0,
    description: 'Campari, vermouth e soda: leggero e bitter',
    recipe: '3cl Campari, 3cl vermouth rosso, soda',
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
    recipe: '4cl gin, 2cl Aperol, 1.5cl lime, 4cl prosecco',
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
    recipe: '5cl bourbon, 2.5cl limone, 1.5cl sciroppo, panna',
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
    recipe: '4cl vodka, 2cl Cointreau, 4cl ananas, 6cl ginger beer',
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
    recipe: '5cl rum scuro, 15cl Cola, 1cl lime',
    recipe_items: [
      { item: 'Rum Scuro', qty: 50 },
      { item: 'Cola', qty: 150 },
      { item: 'Succo di Lime', qty: 10 },
    ],
  },
  {
    cat: 'long', name: 'Vodka Soda', price: 7.0,
    description: 'Semplice, leggero, con un twist di lime',
    recipe: '5cl vodka, 15cl soda, lime',
    recipe_items: [
      { item: 'Vodka', qty: 50 },
      { item: 'Soda Water', qty: 150 },
      { item: 'Lime Fresco', qty: 0.25 },
    ],
  },
  {
    cat: 'long', name: 'Gin Fizz', price: 8.0,
    description: 'Gin, succo di limone e soda: fresco e frizzante',
    recipe: '5cl gin, 2cl limone, 1.5cl sciroppo, soda',
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
    recipe: '5cl tequila, 10cl succo arancia, granatina',
    recipe_items: [
      { item: 'Tequila Blanco', qty: 50 },
      { item: "Succo d'Arancia", qty: 100 },
    ],
  },
  // --- Analcolici ---
  {
    cat: 'analcolici', name: 'Virgin Mojito', price: 5.0,
    description: 'Tutta la freschezza del Mojito, senza alcol',
    recipe: 'Lime, menta, zucchero, soda',
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
    recipe: '8cl ananas, 2cl lime, 6cl ginger beer',
    recipe_items: [
      { item: 'Succo di Ananas', qty: 80 },
      { item: 'Succo di Lime', qty: 20 },
      { item: 'Ginger Beer', qty: 60 },
    ],
  },
  {
    cat: 'analcolici', name: 'Sunrise Analcolico', price: 5.0,
    description: 'Arancia, cranberry e soda: colorato e fresco',
    recipe: '10cl arancia, 4cl cranberry, soda',
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
    recipe: 'Birra Pils 0,4L',
    recipe_items: [{ item: 'Birra Pils (spina)', qty: 400 }],
  },
  {
    cat: 'birre', name: 'IPA alla Spina 0,4L', price: 6.0,
    description: 'India Pale Ale artigianale, luppolata e amara',
    recipe: 'Birra IPA 0,4L',
    recipe_items: [{ item: 'Birra IPA (spina)', qty: 400 }],
  },
  {
    cat: 'birre', name: 'Birra in Bottiglia', price: 5.0,
    description: 'Birra in bottiglia da 33cl',
    recipe: '1 bottiglia da 33cl',
    recipe_items: [{ item: 'Birra Bottiglia', qty: 1 }],
  },
  // --- Bollicine ---
  {
    cat: 'bollicine', name: 'Prosecco al Calice', price: 5.0,
    description: 'Prosecco DOC frizzante, 12cl',
    recipe: 'Prosecco 12cl',
    recipe_items: [{ item: 'Prosecco', qty: 120 }],
  },
  {
    cat: 'bollicine', name: 'Vino Bianco al Calice', price: 5.0,
    description: 'Vino bianco secco, 12cl',
    recipe: 'Vino bianco 12cl',
    recipe_items: [{ item: 'Vino Bianco', qty: 120 }],
  },
  // --- Shots ---
  {
    cat: 'shots', name: 'Tequila Shot', price: 4.0,
    description: 'Con sale e lime',
    recipe: 'Tequila 4cl, sale, lime',
    recipe_items: [
      { item: 'Tequila Blanco', qty: 40 },
      { item: 'Sale Fino', qty: 2 },
      { item: 'Lime Fresco', qty: 0.25 },
    ],
  },
  {
    cat: 'shots', name: 'Limoncello Shot', price: 3.5,
    description: 'Freddo e agrumato',
    recipe: 'Limoncello 4cl',
    recipe_items: [{ item: 'Limoncello', qty: 40 }],
  },
  {
    cat: 'shots', name: 'Baileys Shot', price: 4.0,
    description: 'Cremoso e dolce',
    recipe: 'Baileys 4cl',
    recipe_items: [{ item: 'Baileys', qty: 40 }],
  },
  {
    cat: 'shots', name: 'Amaretto Shot', price: 4.0,
    description: 'Dolce e mandorlato',
    recipe: 'Amaretto 4cl',
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
}
