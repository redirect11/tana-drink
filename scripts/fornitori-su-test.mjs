// =====================================================================
//  I FORNITORI VERI DEL LOCALE, SUL DATABASE DI TEST.
//
//    node scripts/fornitori-su-test.mjs --prova   # non scrive, racconta
//    node scripts/fornitori-su-test.mjs           # scrive su tana-drink-test
//
//  In anagrafica ce n'erano sei; nei fogli di Flavio (GEN ORD REC.xlsx,
//  colonna `FORNIT`, compilata su tutti e 126) ne compaiono TREDICI. Quelli
//  che mancavano non sono comparse: MAR è il secondo per volume di righe
//  d'ordine dopo Nova, e senza di lui la sezione Fornitori racconta una
//  serata che non è quella del locale.
//
//  IL COLORE SI DÀ A TUTTI, anche ai sei che c'erano già. Serve a
//  distinguere le righe nella tabella del nuovo ordine, dove lo stesso
//  prodotto compare una volta per fornitore (REQ-MAG-029): un fornitore
//  senza colore è una riga che si può leggere solo per nome, cioè la fatica
//  che il colore doveva togliere. Si scorre la tavolozza invece di pescare a
//  caso, perché importandone dieci in blocco il caso ne farebbe due uguali.
//
//  SI SCRIVE SOLO SU `tana-drink-test`. Il nome del progetto è scritto qui
//  dentro e non si può cambiare da fuori: la produzione ha i dati veri del
//  locale e va nominata a mano, da chi se ne prende la responsabilità.
//  Lo script è IDEMPOTENTE: rilanciarlo non crea doppioni e non ricolora
//  chi ha già un colore.
// =====================================================================
import { accessToken, client } from './lib-firestore.js'
import { COLORI_FORNITORE } from '../src/lib/listini.js'

const PROGETTO = 'tana-drink-test'
const PROVA = process.argv.includes('--prova')

// I tredici che compaiono nei fogli, con quante righe d'ordine porta
// ciascuno: serve a dare un ordine di comparsa sensato in anagrafica,
// perché chi ordina apre la tendina e cerca prima quelli che usa.
const DAI_FOGLI = [
  ['NOVA', 30988],
  ['MAR', 4273],
  ['PICCOLO', 2604],
  ['OKOREY', 756],
  ['BERNABEI', 440],
  ['PAD', 364],
  ['ARUBA', 249],
  ['FONT', 220],
  ['LUPIN', 126],
  ['COL NAPPI', 126],
  ['CONAD', 125],
  ['CASAM', 123],
  ['SOLE', 123],
]

const token = await accessToken()
const test = client(PROGETTO, token)

const esistenti = await test.documenti('suppliers')
const perNome = new Map(
  esistenti.map((d) => [(d.fields?.name?.stringValue || '').toUpperCase(), d])
)

const daCreare = DAI_FOGLI.filter(([nome]) => !perNome.has(nome))
const daColorare = esistenti.filter((d) => !d.fields?.color?.stringValue)

console.log(`progetto            : ${PROGETTO}`)
console.log(`fornitori in archivio: ${esistenti.length}`)
console.log(`da creare            : ${daCreare.length}${daCreare.length ? ' → ' + daCreare.map(([n]) => n).join(', ') : ''}`)
console.log(`da colorare          : ${daColorare.length}${daColorare.length ? ' → ' + daColorare.map((d) => d.fields.name.stringValue).join(', ') : ''}`)

if (!daCreare.length && !daColorare.length) {
  console.log('\nniente da fare: già a posto.')
  process.exit(0)
}
if (PROVA) {
  console.log('\n(prova: non ho scritto niente)')
  process.exit(0)
}

const writes = []
let colore = 0
const prossimoColore = () => COLORI_FORNITORE[colore++ % COLORI_FORNITORE.length]

// Prima i colori mancanti su chi c'era già: si tocca UN campo solo, con
// updateMask, per non riscrivere email, note o altro che qualcuno ha messo
// a mano su quel database.
for (const d of daColorare) {
  writes.push({
    update: { name: d.name, fields: { color: { stringValue: prossimoColore() } } },
    updateMask: { fieldPaths: ['color'] },
  })
}

let ordine = esistenti.length
for (const [nome] of daCreare) {
  const id = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  writes.push({
    update: {
      name: `${test.radice}/suppliers/${id}`,
      fields: {
        name: { stringValue: nome },
        email: { nullValue: null },
        notes: { nullValue: null },
        color: { stringValue: prossimoColore() },
        sort_order: { integerValue: String(++ordine) },
        created_at: { timestampValue: new Date().toISOString() },
      },
    },
  })
}

await test.commit(writes)
console.log(`\nscritti ${writes.length} documenti su ${PROGETTO}. La produzione non è stata toccata.`)
