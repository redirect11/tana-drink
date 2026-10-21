// LO STORICO IN UN PROGETTO, IN UN GIRO SOLO: le vendite di Tiller
// (REQ-STAT-006) e i fogli mensili di ANALISI DATI (REQ-CASSA-011), con il
// backup prima. È quello che sul test si è fatto a mano, comando per
// comando; per la produzione serve che non si salti un passo.
//
//   1. backup delle raccolte che si toccano (vendite_storiche,
//      vendite_storiche_prodotti, mesi_storici) in backup/
//   2. i fogli mensili dall'xlsx al JSON (Python)
//   3. import di Tiller: giornate, indice delle serate e venduto per
//      prodotto, calcolato con ricette e prodotti DEL PROGETTO in cui si
//      scrive
//   4. import dei fogli mensili
//
// DI PROVA finché non c'è --apply: il backup si fa comunque, gli import
// dicono cosa scriverebbero. Il progetto si nomina a mano, e la produzione
// solo col via libera — e dopo il rilascio, quando in produzione c'è il
// codice che legge questi dati e le regole che lo permettono.
//
//   node scripts/storico-in-produzione.mjs --project tana-drink \
//     --cartella registrazioni --xlsx "ANALISI DATI.xlsx" [--apply]

import { spawnSync } from 'node:child_process'
import { accessToken, arg, client, flag } from './lib-firestore.js'

const PROGETTO = arg('project')
const CARTELLA = arg('cartella', 'registrazioni')
const XLSX = arg('xlsx', 'ANALISI DATI.xlsx')
const APPLICA = flag('apply')

if (!PROGETTO) {
  console.error('[storico] Il progetto si nomina a mano: --project tana-drink-test oppure --project tana-drink.')
  process.exit(1)
}

const istante = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const FOGLI = 'backup/fogli-mensili.json'
const passo = (titolo, comando, args) => {
  console.log(`\n── ${titolo}`)
  const r = spawnSync(comando, args, { stdio: 'inherit', shell: false })
  if (r.status !== 0) {
    console.error(`[storico] Fermo: «${titolo}» non è andato a buon fine. Niente è stato scritto dopo questo passo.`)
    process.exit(r.status || 1)
  }
}

// IL BACKUP DI QUELLO CHE C'È: la prima volta su un progetto queste
// raccolte non esistono, e non c'è niente da mettere da parte.
const TOCCATE = ['vendite_storiche', 'vendite_storiche_prodotti', 'mesi_storici']
const esistenti = (await client(PROGETTO, await accessToken()).collezioni()).filter((c) => TOCCATE.includes(c))
if (esistenti.length) {
  passo('Backup delle raccolte che si toccano', process.execPath, [
    'scripts/backup-db.js',
    '--project',
    PROGETTO,
    '--solo',
    esistenti.join(','),
    '--out',
    `backup/storico-prima-${PROGETTO}-${istante}.json`,
  ])
} else {
  console.log(`\n── Backup: su "${PROGETTO}" queste raccolte non ci sono ancora, niente da mettere da parte.`)
}
passo('Fogli mensili: dall’xlsx al JSON', 'python', ['-I', 'scripts/estrai-fogli-mensili.py', XLSX, FOGLI])
passo('Vendite di Tiller', process.execPath, [
  'scripts/importa-vendite-tiller.mjs',
  '--cartella',
  CARTELLA,
  '--project',
  PROGETTO,
  ...(APPLICA ? ['--apply'] : []),
])
passo('Fogli mensili', process.execPath, [
  'scripts/importa-fogli-mensili.mjs',
  '--file',
  FOGLI,
  '--project',
  PROGETTO,
  ...(APPLICA ? ['--apply'] : []),
])
console.log(APPLICA ? `\n[storico] Fatto su "${PROGETTO}".` : `\n[storico] PROVA su "${PROGETTO}": con --apply si scrive.`)
