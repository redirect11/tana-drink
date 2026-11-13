// =====================================================================
//  INGREDIENTI DI PROVA PER I SIGNATURE, SOLO SUL TEST (REQ-MENU-019).
//
//    node scripts/ingredienti-prova-signature.mjs            # ANTEPRIMA
//    node scripts/ingredienti-prova-signature.mjs --apply    # scrive sul test
//
//  L'utente, 30/10/2026: «e aggiungili per i signatures su test, ci serve
//  per vedere come viene». Sul test i Signature non hanno ricetta, e il
//  campo «Ingredienti in carta» è vuoto: senza qualcosa scritto non si vede
//  come escono gli ingredienti nel menù, negli Special e nel dettaglio.
//
//  SONO INVENTATI, dal nome e dalla descrizione del drink, e NON SONO LE
//  RICETTE VERE. Per questo lo script rifiuta qualunque progetto che non
//  sia tana-drink-test, e non ha un'opzione per la produzione: in carta un
//  ingrediente sbagliato è un allergene sbagliato. Quelli veri li scrive
//  Flavio nella scheda, e sovrascrivono questi.
//
//  Scrive solo dove il campo è vuoto: quello che qualcuno ha già scritto
//  a mano resta.
// =====================================================================
import { accessToken, arg, flag } from './lib-firestore.js'

const PROGETTO = arg('project', 'tana-drink-test')
const APPLY = flag('apply')
if (PROGETTO !== 'tana-drink-test') {
  console.error(`[ingredienti] solo sul test: "${PROGETTO}" rifiutato. Questi ingredienti sono inventati.`)
  process.exit(1)
}

// Nome in carta (maiuscolo) → ingredienti di prova.
const PROVA = {
  'REGIN DI CUORI': 'Vodka, lampone, sciroppo di rosa, lime',
  BASILICONIGLIO: 'Gin, basilico fresco, lime, sciroppo di zucchero',
  STRAGATTO: 'Gin, liquore alla violetta, limone, albume',
  CAFFELLAIO: 'Vodka, liquore al caffè, caffè espresso, zucchero di canna',
  'ALICE BREAKFAST': "Gin, marmellata d'arancia, triple sec, limone",
  'PINK-O-PANKO': 'Rum bianco, fragola, lime, soda',
  'ORA DEL TE': 'Gin, tè nero, limone, miele',
  BLUKALIF: 'Rum bianco, curaçao blu, ananas, latte di cocco',
}

const token = await accessToken()
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const BASE = `https://firestore.googleapis.com/v1/projects/${PROGETTO}/databases/(default)/documents`
async function tutti(col) {
  let out = []
  let pt = ''
  do {
    const r = await (await fetch(`${BASE}/${col}?pageSize=300${pt ? `&pageToken=${pt}` : ''}`, { headers: H })).json()
    if (r.error) throw new Error(r.error.message)
    out = out.concat(r.documents || [])
    pt = r.nextPageToken || ''
  } while (pt)
  return out
}
const v = (f) => f?.stringValue ?? null
const normale = (n) => String(n || '').trim().replace(/\s+/g, ' ').toUpperCase()

const scritture = []
for (const d of await tutti('drinks')) {
  const f = d.fields || {}
  const prova = PROVA[normale(v(f.name))]
  if (!prova) continue
  if (String(v(f.ingredienti) || '').trim()) {
    console.log(`  = ${v(f.name)}: già scritti, restano («${v(f.ingredienti)}»)`)
    continue
  }
  console.log(`  ~ ${v(f.name)}: ${prova}`)
  scritture.push({ update: { name: d.name, fields: { ingredienti: { stringValue: prova } } }, updateMask: { fieldPaths: ['ingredienti'] } })
}

if (!APPLY) {
  console.log(`[ingredienti] ANTEPRIMA su ${PROGETTO}: ${scritture.length} voci da scrivere. Aggiungi --apply per salvare.`)
  process.exit(0)
}
if (scritture.length) {
  const r = await fetch(`${BASE}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes: scritture }) })
  const j = await r.json()
  if (j.error) throw new Error(j.error.message)
}
console.log(`[ingredienti] ✓ ${scritture.length} voci scritte su "${PROGETTO}".`)
