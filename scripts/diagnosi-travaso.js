// =====================================================================
//  A CHE PUNTO STA IL TRAVASO DEL MAGAZZINO — e se i conti tornano.
//
//    node scripts/diagnosi-travaso.js                  → emulatore locale
//    node scripts/diagnosi-travaso.js --project tana-drink-test
//    node scripts/diagnosi-travaso.js --project tana-drink
//
//  QUESTO SCRIPT NON SCRIVE NIENTE, mai, da nessuna parte: legge e conta.
//  Il travaso al modello a pezzi lo fa l'APP (REQ-MAG-018) — legge tollerante
//  e riscrive l'articolo la prima volta che qualcuno lo tocca — proprio per
//  non dover lanciare una migrazione contro le giacenze vere del locale.
//  Qui si guarda solo quanti articoli sono ancora nella forma vecchia, e
//  soprattutto se leggerli a pezzi cambia qualche numero che non doveva
//  cambiare: valore di magazzino, quantità in pezzi, costo per unità.
//
//  Un numero storto in pezzi sembra plausibile a chi lo legge — «47» di
//  limoni non ha niente di strano, giusto o sbagliato che sia — e l'unico
//  controllo che se ne accorge è il confronto prima/dopo.
// =====================================================================
import { accessToken, client, clientEmulatore, arg, idDi } from './lib-firestore.js'
import { trovaEmulatore } from './lib-emulatore.js'
import {
  articoloNormalizzato,
  patchNormalizza,
  motivoNonMigrabile,
  contenutoDelPezzo,
  stockValue,
  pezziInGiacenza,
  costPerUnit,
  entryUnits,
} from '../src/lib/inventory.js'

const PROGETTO = arg('project', null)

// Emulatore o progetto vero: cambia solo a chi si chiede. Le chiamate le fa
// il client di lib-firestore.js, che sa gia' paginare.
async function leggiArticoli() {
  if (!PROGETTO) {
    const dove = await trovaEmulatore()
    if (!dove) {
      console.error('[diagnosi] Nessun emulatore in ascolto: avvialo con "npm run emulators".')
      process.exit(1)
    }
    const docs = await clientEmulatore(dove).documenti('inventory_items')
    return { dove: `emulatore ${dove}`, docs }
  }
  const token = await accessToken()
  return { dove: PROGETTO, docs: await client(PROGETTO, token).documenti('inventory_items') }
}

const valore = (f) => {
  if (!f || 'nullValue' in f) return null
  if (f.stringValue != null) return f.stringValue
  if (f.booleanValue != null) return f.booleanValue
  if (f.doubleValue != null) return Number(f.doubleValue)
  if (f.integerValue != null) return Number(f.integerValue)
  return null
}

// Due numeri che dicono la stessa cosa a meno dell'errore di virgola mobile:
// 7,49 pezzi × 1000 ml non fa mai esattamente 7490.
const stesso = (a, b) => {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))
}

const { dove, docs } = await leggiArticoli()
const articoli = docs.map((d) => {
  const out = { id: idDi(d) }
  for (const [k, v] of Object.entries(d.fields || {})) out[k] = valore(v)
  return out
})

const vecchi = []
const fermi = []
const bugie = []
for (const a of articoli) {
  // Prima di tutto: c'è qualcosa che una persona deve dire? Un contenuto
  // senza misura («330» e basta) o due misure di famiglie diverse non si
  // indovinano, e finire nell'elenco da sistemare è la risposta giusta.
  const motivo = motivoNonMigrabile(a)
  if (motivo) {
    fermi.push({ ...a, motivo })
    continue
  }
  const daFare = patchNormalizza(a)
  if (!daFare) continue
  vecchi.push(a)
  const letto = articoloNormalizzato(a)
  // Gli stessi conti da tutte e due le parti: chiederli in due modi diversi
  // fa sembrare storta una conversione giusta (una giacenza sotto zero si
  // legge zero sia prima sia dopo, ma solo se glielo si chiede allo stesso
  // modo).
  const pezzi = (x) => pezziInGiacenza(x) ?? (Number(x.stock) || 0)
  const controlli = [
    ['valore', stockValue(a), stockValue(letto)],
    ['pezzi', pezzi(a), pezzi(letto)],
    ...entryUnits(a).map((u) => [`costo al ${u}`, costPerUnit(a, u), costPerUnit(letto, u)]),
  ]
  const storti = controlli.filter(([, x, y]) => !stesso(x, y))
  if (storti.length > 0) bugie.push({ a, storti })
}

console.log(`[diagnosi] ${articoli.length} articoli su ${dove}`)
console.log(`\n  già nella forma nuova:  ${articoli.length - vecchi.length - fermi.length}`)
console.log(`  si leggono travasati:   ${vecchi.length}`)
console.log(`  restano nella vecchia:  ${fermi.length}`)

if (vecchi.length > 0) {
  console.log('\n  COME SI LEGGONO ADESSO')
  for (const a of vecchi.slice(0, 30)) {
    const letto = articoloNormalizzato(a)
    const contenuto = contenutoDelPezzo(letto)
      ? `1 pz = ${contenutoDelPezzo(letto)}`
      : 'senza contenuto'
    console.log(
      `   ~ ${(a.name || '(senza nome)').padEnd(30).slice(0, 30)} ${a.unit} → pz · ${contenuto}` +
        ` · giacenza ${a.stock} ${a.unit} → ${letto.stock} pz`
    )
  }
  if (vecchi.length > 30) console.log(`   … e altri ${vecchi.length - 30}`)
}

if (fermi.length > 0) {
  console.log('\n  DA SISTEMARE PRIMA (cosa sia un pezzo lo deve dire una persona)')
  for (const a of fermi.slice(0, 30)) {
    console.log(`   ! ${(a.name || '(senza nome)').padEnd(30).slice(0, 30)} ${a.motivo}`)
  }
  if (fermi.length > 30) console.log(`   … e altri ${fermi.length - 30}`)
}

if (bugie.length > 0) {
  console.log('\n  ⛔ QUI I CONTI NON TORNANO')
  for (const { a, storti } of bugie) {
    console.log(`   ! ${a.name}`)
    for (const [nome, x, y] of storti) console.log(`       ${nome}: ${x} → ${y}`)
  }
  process.exitCode = 1
} else {
  console.log('\n[diagnosi] ✓ valore, pezzi e costi si leggono uguali a prima.')
}
