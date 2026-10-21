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
import { accessToken, client, aCampi, daCampi, idDi, arg, flag } from './lib-firestore.js'
import { contiDaRighe, indiceSerate, vendutoPerProdotto } from '../src/lib/venditeStoriche.js'
import { parseCsv } from '../src/lib/carteImport.js'

const PROGETTO = arg('project', 'tana-drink-test')
const CARTELLA = arg('cartella', 'registrazioni')
const APPLICA = flag('apply')
const COLLEZIONE = 'vendite_storiche'

// CSV di Tiller: lo stesso lettore dell'export prodotti SumUp, col punto e
// virgola. La prima riga sono le intestazioni.
function leggiCsv(testo) {
  const [testa, ...dati] = parseCsv(testo, ';')
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

// I DUE RIASSUNTI (vedi lib/venditeStoriche.js). L'indice delle serate sta
// nella stessa raccolta, senza `giorno`: le letture per periodo non lo
// prendono. Il venduto per prodotto usa le ricette e i prodotti del
// progetto in cui si scrive.
const serate = indiceSerate(perGiorno)
scritture.push(db.scriviDoc(COLLEZIONE, '_indice', aCampi({ fonte: 'tiller', serate })))
const leggi = async (c) => (await db.documenti(c)).map((d) => ({ id: idDi(d), ...daCampi(d.fields) }))
const [drinks, items] = await Promise.all([leggi('drinks'), leggi('inventory_items')])
const venduto = vendutoPerProdotto(perGiorno, { drinks, items })
const PRODOTTI = 'vendite_storiche_prodotti'
const prima = (await db.documenti(PRODOTTI, { campi: ['__name__'] })).map(idDi)
for (const [itemId, giorniProdotto] of venduto) {
  scritture.push(db.scriviDoc(PRODOTTI, itemId, aCampi({ item_id: itemId, fonte: 'tiller', giorni: giorniProdotto })))
}
// Un prodotto che non risulta più venduto (ricetta cambiata) non tiene il
// riassunto di prima.
for (const id of prima.filter((id) => !venduto.has(id))) scritture.push(db.cancellaDoc(PRODOTTI, id))

await db.commit(scritture)
console.log(`[tiller] Fatto su "${PROGETTO}": ${giorni.length} giorni in ${COLLEZIONE}, ${serate.length} serate nell'indice, ${venduto.size} prodotti in ${PRODOTTI}.`)
