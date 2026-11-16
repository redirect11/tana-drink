// =====================================================================
//  IL TEMPO DI LAVORAZIONE IN RICETTA: DA GRAMMI A U (BUG-164).
//
//    node scripts/lavorazione-in-u.js                         # ANTEPRIMA su test
//    node scripts/lavorazione-in-u.js --apply                 # scrive su test
//    node scripts/lavorazione-in-u.js --project tana-drink    # anteprima in produzione
//
//  Le righe di ricetta che dosano in grammi un articolo che si conta a U
//  (il «Tempo di Lavorazione»: 1 pz = 60 U, 10 € a pezzo) non hanno un
//  costo, e restavano fuori dal costo del drink. Qui diventano U, con la
//  stessa quantità. Si tocca solo l'unità di quelle righe; il resto della
//  ricetta resta com'era. Rilanciato, non trova più niente da fare.
//
//  Default: progetto tana-drink-test. La produzione va indicata a mano, col
//  via libera, e prima si fa il backup:
//    node scripts/backup-db.js --project tana-drink
// =====================================================================
import { accessToken, client, idDi, arg, flag } from './lib-firestore.js'
import { siDosaAU, righeInGrammi } from './lib-lavorazione.js'

const PROJECT = arg('project', 'tana-drink-test')
const APPLY = flag('apply')

const db = client(PROJECT, await accessToken())
const strOf = (f) => (f?.stringValue != null ? f.stringValue : null)
const numOf = (f) =>
  f?.doubleValue != null ? Number(f.doubleValue) : f?.integerValue != null ? Number(f.integerValue) : null

const articoli = await db.documenti('inventory_items', { campi: ['name', 'unit', 'content_unit', 'package_size'] })
const inU = articoli.filter((d) =>
  siDosaAU({
    unit: strOf(d.fields?.unit),
    content_unit: strOf(d.fields?.content_unit),
    package_size: numOf(d.fields?.package_size),
  })
)
const idsInU = new Set(inU.map(idDi))
console.log(`[lavorazione] su "${PROJECT}", articoli che si dosano a U: ${inU.length}`)
for (const d of inU) console.log(`   ${idDi(d).padEnd(24)} ${strOf(d.fields?.name)}`)

const drinks = await db.documenti('drinks')
const scritture = []
let righeToccate = 0
for (const d of drinks) {
  const valori = d.fields?.recipe_items?.arrayValue?.values || []
  const righe = valori.map((v) => {
    const rf = v.mapValue?.fields || {}
    return { inventory_item_id: strOf(rf.inventory_item_id), unit: strOf(rf.unit) }
  })
  const indici = new Set(righeInGrammi(righe, idsInU))
  if (indici.size === 0) continue
  const nome = strOf(d.fields?.name) || idDi(d)
  for (const i of indici) {
    const rf = valori[i].mapValue.fields
    console.log(`   ~ ${nome.padEnd(30)} ${strOf(rf.name) || ''}: ${numOf(rf.qty)} g → ${numOf(rf.qty)} U`)
  }
  righeToccate += indici.size
  const nuovi = valori.map((v, i) =>
    indici.has(i) ? { mapValue: { fields: { ...v.mapValue.fields, unit: { stringValue: 'U' } } } } : v
  )
  scritture.push({
    update: { name: d.name, fields: { recipe_items: { arrayValue: { values: nuovi } } } },
    updateMask: { fieldPaths: ['recipe_items'] },
  })
}

console.log(`\n  ricette da riscrivere: ${scritture.length} (${righeToccate} righe da grammi a U)`)
if (!APPLY) {
  console.log('\n[lavorazione] ANTEPRIMA: nessuna scrittura. Aggiungi --apply per salvare.')
  process.exit(0)
}
if (scritture.length) await db.commit(scritture)
console.log(`\n[lavorazione] ✓ riscritte ${scritture.length} ricette su "${PROJECT}".`)
