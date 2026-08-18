// =====================================================================
//  PRODOTTI SCRITTI COL MODELLO VECCHIO, per provare il travaso (emulatore).
//
//    node scripts/seed-magazzino-vecchio.js            → aggiunge i prodotti
//    node scripts/seed-magazzino-vecchio.js --pulisci  → prima toglie i suoi
//
//  Dal 1.5 il magazzino si conta solo a PEZZI, e i prodotti scritti coi
//  modelli di ieri si adeguano da soli alla lettura (REQ-MAG-018): non c'è
//  nessuno script che scrive sul database, è l'app che legge tollerante.
//  Il rischio, però, è scoprire al primo aggiornamento che una forma vecchia
//  non l'avevamo prevista — e scoprirlo sulle giacenze vere del locale.
//
//  Qui si riempie l'emulatore con TUTTE le forme che esistono davvero fra i
//  388 articoli, non con una sola:
//
//    · contato a PEZZO con il contenuto (la bottiglia di gin)
//    · contato a PEZZO senza contenuto (la birra che si serve intera)
//    · contato a VOLUME con la confezione (il grosso del magazzino)
//    · contato a PESO con la confezione (lo zucchero al chilo)
//    · contato a VOLUME senza confezione — non si può convertire, e deve
//      restare com'è invece di diventare un numero a caso
//    · «U» con la casella di scorta accesa (il ghiaccio a sacchi)
//    · «U» senza casella, che è il LAVORO: non è merce e non si scarica
//    · con la RESA della stessa famiglia (il fusto comprato a litri e
//      versato a cl): si riassorbe nel contenuto
//    · con la RESA di DUE famiglie (i limoni al chilo, spremuti in cl):
//      cos'è un pezzo lo deve dire una persona, quindi resta com'è
//    · col campo `tipo` delle quattro card, che non vuol più dire niente
//    · con la giacenza SOTTO ZERO, che al banco è successa davvero
//
//  E una RICETTA che li usa, perché il numero che non deve muoversi è il
//  costo del drink: si guarda prima e dopo, e dev'essere lo stesso.
//
//  Gira SOLO sull'emulatore, su un progetto demo: questi prodotti sono finti
//  e in un magazzino vero non ci devono entrare. Sta a parte da
//  `npm run seed:tutto` di proposito — sporca il magazzino di prova con roba
//  che serve una volta sola, per una verifica precisa.
// =====================================================================
import admin from 'firebase-admin'
import { puntaAllEmulatore } from './lib-emulatore.js'

await puntaAllEmulatore('vecchi')

const progetto = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-tana-drink'
if (!progetto.startsWith('demo-')) {
  console.error(
    `[vecchi] Progetto "${progetto}": questo script scrive solo su un progetto demo (emulatore).`
  )
  process.exit(1)
}

admin.initializeApp({ projectId: progetto })
const db = admin.firestore()

// Il prefisso serve a riconoscerli: sono roba di prova, e con --pulisci se
// ne vanno tutti insieme senza toccare il resto del magazzino.
const PREFISSO = '[vecchio] '

const PRODOTTI = [
  {
    id: 'vecchio-gin-pezzo',
    name: 'Gin — a pezzo col contenuto',
    unit: 'pz',
    package_size: 700,
    content_unit: 'ml',
    stock: 3,
    low_threshold: 1,
    cost: 14,
    vat: 22,
    // Il campo delle quattro card: non vuol più dire niente, e non deve
    // dare fastidio a nessuno.
    tipo: 'versato',
  },
  {
    id: 'vecchio-birra-intera',
    name: 'Birra — a pezzo senza contenuto',
    unit: 'pz',
    stock: 24,
    low_threshold: 6,
    cost: 1.2,
    vat: 22,
    tipo: 'intero',
  },
  {
    id: 'vecchio-vodka-volume',
    name: 'Vodka — contata a volume',
    unit: 'ml',
    package_size: 700, // la bottiglia
    stock: 2100, // tre bottiglie
    low_threshold: 700,
    cost: 11,
    vat: 22,
  },
  {
    id: 'vecchio-zucchero-peso',
    name: 'Zucchero — contato a peso',
    unit: 'g',
    package_size: 1000, // il sacchetto da un chilo
    stock: 1870,
    low_threshold: 1000,
    cost: 1.5,
    vat: 10,
  },
  {
    // IL CASO DELLA «BIRRA PILS (SPINA)» vista in test: contata a pezzi, con
    // scritto che un pezzo contiene 330 — ma 330 di cosa? cl, ml, grammi?
    // Nessuno lo sa, e indovinare sbaglia il costo di un drink di dieci
    // volte: deve finire fra quelli da sistemare a mano.
    id: 'vecchio-contenuto-senza-misura',
    name: 'Birra Pils — contenuto senza misura',
    unit: 'pz',
    package_size: 330,
    stock: 1.94,
    cost: 1.4,
    vat: 22,
  },
  {
    id: 'vecchio-sciroppo-senza-confezione',
    name: 'Sciroppo — a volume, senza confezione',
    unit: 'ml',
    stock: 4000,
    cost: 6,
    vat: 22,
  },
  {
    id: 'vecchio-ghiaccio-u',
    name: 'Ghiaccio — a sacchi (U), è una scorta',
    unit: 'U',
    scorta: true,
    stock: 6,
    low_threshold: 2,
    cost: 2,
    vat: 22,
  },
  {
    id: 'vecchio-lavoro-u',
    name: 'Tempo di Lavorazione — non è merce',
    unit: 'U',
    stock: 0,
    cost: 0.5,
    vat: 22,
  },
  {
    id: 'vecchio-spina-resa-stessa-famiglia',
    name: 'Birra alla spina — comprata a L, versata a cl',
    unit: 'ml',
    package_size: 30000, // il fusto da 30 litri
    resa: 1,
    resa_unit: 'ml',
    stock: 18400,
    cost: 90,
    vat: 22,
  },
  {
    id: 'vecchio-limoni-resa-due-famiglie',
    name: 'Limoni — comprati a kg, spremuti in cl',
    unit: 'g',
    package_size: 1000,
    resa: 0.5,
    resa_unit: 'ml',
    stock: 5000,
    low_threshold: 1000,
    cost: 2,
    vat: 4,
  },
  {
    id: 'vecchio-sotto-zero',
    name: 'Amaro — giacenza sotto zero',
    unit: 'ml',
    package_size: 700,
    stock: -28, // il Jagermeister del 17 agosto, a −0,04 pz
    cost: 13,
    vat: 22,
  },
]

// LA RICETTA È LA PROVA VERA: il costo di questo drink non deve muoversi di
// un centesimo fra prima e dopo il travaso. Dosa nelle unità in cui si dosa
// davvero — cl di distillato, grammi di zucchero, un pezzo intero, il lavoro
// a unità — così se una conversione mente si vede subito nel prezzo.
const DRINK = {
  id: 'vecchio-drink-prova',
  name: 'Prova travaso (drink)',
  price: 9,
  category: 'Prova',
  available: true,
  recipe_items: [
    { inventory_item_id: 'vecchio-gin-pezzo', name: 'Gin', unit: 'cl', qty: 4 },
    { inventory_item_id: 'vecchio-vodka-volume', name: 'Vodka', unit: 'cl', qty: 2 },
    { inventory_item_id: 'vecchio-zucchero-peso', name: 'Zucchero', unit: 'g', qty: 8 },
    { inventory_item_id: 'vecchio-birra-intera', name: 'Birra', unit: 'pz', qty: 1 },
    { inventory_item_id: 'vecchio-ghiaccio-u', name: 'Ghiaccio', unit: 'U', qty: 1 },
    { inventory_item_id: 'vecchio-lavoro-u', name: 'Lavoro', unit: 'U', qty: 2 },
    { inventory_item_id: 'vecchio-spina-resa-stessa-famiglia', name: 'Spina', unit: 'cl', qty: 20 },
  ],
}

if (process.argv.includes('--pulisci')) {
  const lotto = db.batch()
  for (const p of PRODOTTI) lotto.delete(db.collection('inventory_items').doc(p.id))
  lotto.delete(db.collection('drinks').doc(DRINK.id))
  await lotto.commit()
  console.log(`[vecchi] tolti ${PRODOTTI.length} prodotti di prova e il drink.`)
  process.exit(0)
}

const lotto = db.batch()
for (const { id, name, ...resto } of PRODOTTI) {
  lotto.set(
    db.collection('inventory_items').doc(id),
    { name: PREFISSO + name, ...resto, created_at: admin.firestore.FieldValue.serverTimestamp() },
    { merge: false }
  )
}
const { id: drinkId, ...drink } = DRINK
lotto.set(
  db.collection('drinks').doc(drinkId),
  { ...drink, name: PREFISSO + drink.name },
  { merge: false }
)
await lotto.commit()

console.log(`[vecchi] scritti ${PRODOTTI.length} prodotti nella forma VECCHIA su ${progetto}.`)
console.log('[vecchi] Cosa guardare, aprendo il magazzino con la versione nuova:')
console.log('   · si leggono tutti in pezzi, senza che nessuno abbia toccato niente')
console.log('   · «Sciroppo» e «Limoni» restano com’erano: lì cosa sia un pezzo lo dice una persona')
console.log('   · «Tempo di Lavorazione» non è una scorta e non risulta esaurito')
console.log(`   · il costo di «${DRINK.name}» dev’essere lo stesso prima e dopo`)
console.log('   · tocca un articolo (modifica, carico, conta): da lì resta scritto nella forma nuova')
