// IMPORTA I FOGLI MENSILI DI ANALISI DATI IN `mesi_storici` (REQ-CASSA-011).
//
// Il file lo prepara scripts/estrai-fogli-mensili.py (Python legge l'xlsx):
// un mese per voce, coi giorni (minimo, reale, nota) e i totali del mese
// (stipendi, spese, incassi). Qui si scrive un documento per mese, con l'id
// 'YYYY-MM'. Bilancio → Mesi ne prende minimo e note giorno per giorno, e
// stipendi e spese dove l'app non li ha ancora.
//
// Di PROVA finché non c'è --apply. Scrive su tana-drink-test; la produzione
// va nominata a mano.
//
//   python scripts/estrai-fogli-mensili.py "ANALISI DATI.xlsx" backup/fogli-mensili.json
//   node scripts/importa-fogli-mensili.mjs --file backup/fogli-mensili.json [--apply]

import { readFileSync } from 'node:fs'
import { accessToken, client, aCampi, arg, flag } from './lib-firestore.js'

const PROGETTO = arg('project', 'tana-drink-test')
const FILE = arg('file', 'backup/fogli-mensili.json')
const APPLICA = flag('apply')

const mesi = JSON.parse(readFileSync(FILE, 'utf8'))
for (const m of mesi) {
  console.log(`  ${m.mese}  ${String(Object.keys(m.giorni).length).padStart(2)} giorni  stipendi ${m.stipendi ?? '—'}  spese ${m.spese ?? '—'}`)
}
if (!APPLICA) {
  console.log(`\n[fogli] PROVA: niente scritto. Con --apply scrive ${mesi.length} mesi in ${PROGETTO}/mesi_storici.`)
  process.exit(0)
}
const db = client(PROGETTO, await accessToken())
await db.commit(mesi.map((m) => db.scriviDoc('mesi_storici', m.mese, aCampi({ ...m, fonte: 'analisi dati' }))))
console.log(`[fogli] Fatto su "${PROGETTO}": ${mesi.length} mesi in mesi_storici.`)
