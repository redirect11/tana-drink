// IMPORTA LE VENDITE DI TILLER IN `vendite_storiche` (REQ-STAT-006).
//
// Legge gli export «rapporto sugli ordini prodotti» di Tiller (CSV col
// punto e virgola, intestazioni in italiano), toglie i conti doppi dei file
// che si sovrappongono e scrive un documento per giorno di apertura, coi
// suoi conti dentro. Non tocca le giacenze né nient'altro.
//
// Di PROVA finché non c'è --apply: legge, conta e stampa cosa scriverebbe.
// Scrive su tana-drink-test; la produzione va nominata a mano.
//
//   node scripts/importa-vendite-tiller.mjs --cartella registrazioni
//   node scripts/importa-vendite-tiller.mjs --cartella registrazioni --apply
//   node scripts/importa-vendite-tiller.mjs --cartella registrazioni --project tana-drink --apply
//
// Rilanciarlo è innocuo: gli stessi giorni si riscrivono uguali.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { accessToken, client, aCampi, arg, flag } from './lib-firestore.js'
import { contiDaRighe } from '../src/lib/venditeStoriche.js'

const PROGETTO = arg('project', 'tana-drink-test')
const CARTELLA = arg('cartella', 'registrazioni')
const APPLICA = flag('apply')
const COLLEZIONE = 'vendite_storiche'

// CSV di Tiller: campi fra virgolette, separati da «;», virgolette doppie
// per una virgoletta dentro un campo.
function leggiCsv(testo) {
  const righe = []
  let campo = ''
  let riga = []
  let tra = false
  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i]
    if (tra) {
      if (ch === '"' && testo[i + 1] === '"') {
        campo += '"'
        i++
      } else if (ch === '"') tra = false
      else campo += ch
    } else if (ch === '"') tra = true
    else if (ch === ';') {
      riga.push(campo)
      campo = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && testo[i + 1] === '\n') i++
      riga.push(campo)
      if (riga.some((c) => c !== '')) righe.push(riga)
      riga = []
      campo = ''
    } else campo += ch
  }
  if (campo || riga.length) {
    riga.push(campo)
    righe.push(riga)
  }
  const [testa, ...dati] = righe
  return dati.map((r) => Object.fromEntries(testa.map((h, k) => [h, r[k] ?? ''])))
}

const file = readdirSync(CARTELLA)
  .filter((f) => /^rapporto-sugli-ordini-prodotti-.*\.csv$/i.test(f))
  .sort()
if (!file.length) {
  console.error(`[tiller] Nessun export «rapporto-sugli-ordini-prodotti-*.csv» in ${CARTELLA}`)
  process.exit(1)
}

const righe = []
for (const f of file) {
  const lette = leggiCsv(readFileSync(join(CARTELLA, f), 'utf8').replace(/^﻿/, ''))
  for (const r of lette) righe.push({ ...r, file: f })
  console.log(`  ${f.padEnd(58)} ${String(lette.length).padStart(6)} righe`)
}

// Nome Tiller → voce dell'app, dove i nomi non coincidono.
const abbinamenti = JSON.parse(readFileSync(new URL('./tiller-abbinamenti.json', import.meta.url), 'utf8'))
delete abbinamenti._nota
const perGiorno = contiDaRighe(righe, abbinamenti)
const giorni = [...perGiorno.keys()].sort()
const conti = [...perGiorno.values()].reduce((s, l) => s + l.length, 0)
const incasso = [...perGiorno.values()].flat().flatMap((c) => c.righe).reduce((s, r) => s + r.incasso, 0)
console.log(`\n[tiller] ${giorni.length} giorni, ${conti} conti, dal ${giorni[0]} al ${giorni.at(-1)}`)
console.log(`         incassato ${incasso.toFixed(2)} €`)

if (!APPLICA) {
  console.log(`\n[tiller] PROVA: niente scritto. Con --apply scrive ${giorni.length} documenti in ${PROGETTO}/${COLLEZIONE}.`)
  process.exit(0)
}

const db = client(PROGETTO, await accessToken())
const scritture = giorni.map((g) =>
  db.scriviDoc(COLLEZIONE, g, aCampi({ giorno: g, fonte: 'tiller', conti: perGiorno.get(g) }))
)
await db.commit(scritture)
console.log(`[tiller] Fatto su "${PROGETTO}": ${scritture.length} giorni scritti in ${COLLEZIONE}.`)
