// =====================================================================
//  IL MODELLO A V: dai bisogni del locale ai test, e ritorno.
//
//    Bisogni del locale (UR-*) ────────── Test di accettazione
//      Specifica di sistema (REQ-*) ─── Test di sistema
//        Architettura (ARC-*) ──────── Test di integrazione
//          Progetto di dettaglio ──── Test di unità
//                       Codice
//
//  Ogni gradino di sinistra ha il suo specchio a destra, e la prova si
//  scrive quando si scrive il gradino, non dopo il codice. Il metodo per
//  intero sta in docs/modello-a-v.md; qui c'è quello che serve per
//  controllarlo: a che livello sta un test, chi è collegato a chi, cosa è
//  nato prima della V e cosa dopo (REQ-DEV-018).
//
//  Perché: l'utente, 08/11/2026, «più qualità e meno regressioni al
//  banco». I test c'erano già, ma non dicevano COSA verificano — un test
//  di unità verde non dice niente sul giro di una serata — e nessun
//  registro diceva quale bisogno del locale un requisito serve.
// =====================================================================
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { caricaRequisiti } from './lib-requisiti.mjs'

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..')
export const FILE_BISOGNI = join(RADICE, 'requirements', 'bisogni.yaml')
export const FILE_ARCHITETTURA = join(RADICE, 'requirements', 'architettura.yaml')

// I quattro livelli di destra, dall'alto in basso. `verifica` è il gradino
// di sinistra che il livello mette alla prova: è quello che si scrive nel
// documento e nel riepilogo, perché «integrazione» da solo non dice niente
// a chi legge.
export const LIVELLI = [
  { id: 'accettazione', nome: 'Accettazione', verifica: 'i bisogni del locale (UR-*)', cartelle: ['tests/accettazione/'] },
  { id: 'sistema', nome: 'Sistema', verifica: "la specifica (REQ-*), sull'app intera", cartelle: ['tests/sistema/'] },
  { id: 'integrazione', nome: 'Integrazione', verifica: "l'architettura (ARC-*): i pezzi messi insieme", cartelle: ['tests/component/', 'tests/bdd/', 'tests/regole/'] },
  { id: 'unita', nome: 'Unità', verifica: 'il progetto di dettaglio: un modulo da solo', cartelle: ['tests/unit/'] },
]
export const NOMI_LIVELLI = LIVELLI.map((l) => l.id)

// A CHE LIVELLO STA UN TEST. Di regola lo dice la cartella. Ma la cartella
// è stata scelta prima della V, e non sempre dice il vero: giroInLocale sta
// in tests/unit e mette insieme api.js con un Firestore finto — è
// integrazione. Spostare i file vorrebbe dire riscrivere i percorsi in
// trecento voci del registro; il test lo dichiara invece nel suo docblock,
// come già fa con l'ambiente (`// @livello integrazione`).
// Un file si legge una volta: lo stesso test è citato da più voci, e il
// riepilogo e la specifica chiedono il livello di tutti.
const letti = new Map()
const leggi = (p) => {
  if (!letti.has(p)) {
    const assoluto = join(RADICE, p)
    letti.set(p, existsSync(assoluto) ? readFileSync(assoluto, 'utf8') : '')
  }
  return letti.get(p)
}

export function livelloDelTest(percorso, testo = null) {
  const p = String(percorso).replace(/\\/g, '/')
  const contenuto = testo ?? leggi(p)
  const dichiarato = contenuto.match(/^\s*\/\/\s*@livello\s+([a-z]+)/m)
  if (dichiarato && NOMI_LIVELLI.includes(dichiarato[1])) return dichiarato[1]
  const per = LIVELLI.find((l) => l.cartelle.some((c) => p.startsWith(c)))
  return per ? per.id : null
}

// COSA È NATO PRIMA DELLA V. Il registro aveva 320 requisiti e 134 difetti
// quando il modello è arrivato (08/11/2026): pretendere subito da tutti il
// bisogno e le prove di ogni livello voleva dire fermare il lavoro per
// settimane. Le voci vecchie si allineano a mano a mano, col cricchetto;
// quelle NUOVE nascono con la V intera. «Nuova» si legge dal numero: per
// ogni area, quello più alto che c'era quel giorno. Un'area che qui non
// c'è è nata dopo, e quindi è nuova tutta.
export const PRIMA_DEL_MODELLO_A_V = {
  ORD: 22, PAG: 15, POS: 20, CASSA: 16, STAT: 8, MAG: 53, UI: 31, MENU: 31,
  AVVISI: 5, GRP: 4, STAFF: 20, TAVOLI: 2, CLI: 6, STAMPA: 20, NOTIF: 4,
  OFFLINE: 7, DATI: 2, SIC: 4, LIC: 15, VENUE: 6, FLOTTA: 30, CODA: 9, AI: 4,
  DEV: 17, 'SUMUP-CONFIG': 1, 'SUMUP-SYNC': 2, 'SUMUP-SALE': 1,
  'SUMUP-STATUS': 1, 'SUMUP-WEBHOOK': 1,
  BUG: 136,
}

export function natoPrimaDellaV(id) {
  const req = String(id).match(/^REQ-(.+)-(\d+)$/)
  if (req) return Number(req[2]) <= (PRIMA_DEL_MODELLO_A_V[req[1]] ?? 0)
  const bug = String(id).match(/^BUG-(\d+)$/)
  if (bug) return Number(bug[1]) <= PRIMA_DEL_MODELLO_A_V.BUG
  return false
}

export const caricaBisogni = () => (existsSync(FILE_BISOGNI) ? caricaRequisiti(FILE_BISOGNI) : [])
export const caricaArchitettura = () => (existsSync(FILE_ARCHITETTURA) ? caricaRequisiti(FILE_ARCHITETTURA) : [])

// Da un requisito ai bisogni che lo citano. Il legame si scrive in UN
// verso solo — il bisogno elenca i suoi requisiti — e l'altro si ricava:
// scritto in due posti, prima o poi i due posti dicono cose diverse.
export function bisogniPerRequisito(bisogni) {
  const per = new Map()
  for (const b of bisogni) {
    for (const id of b.requisiti) {
      if (!per.has(id)) per.set(id, [])
      per.get(id).push(b.id)
    }
  }
  return per
}

// LA V DI UNA VOCE: quanti test ha a ogni livello. L'accettazione non
// appartiene al requisito ma ai suoi bisogni, e si conta da lì.
export function vDellaVoce(req, { bisogni = [], livello = livelloDelTest } = {}) {
  const conteggi = Object.fromEntries(NOMI_LIVELLI.map((l) => [l, 0]))
  for (const t of req.test_cases) {
    const l = livello(t)
    if (l) conteggi[l]++
  }
  const suoi = bisogni.filter((b) => b.requisiti.includes(req.id))
  conteggi.accettazione = suoi.reduce((n, b) => n + b.test_cases.length, 0)
  return { bisogni: suoi.map((b) => b.id), livelli: conteggi }
}

// Il colpo d'occhio per il riepilogo e per la specifica.
export function statoDellaV({ requisiti, bisogni, architettura, livello = livelloDelTest }) {
  const vivi = requisiti.filter((r) => r.status !== 'deprecated')
  const per = bisogniPerRequisito(bisogni)
  const testPerLivello = Object.fromEntries(NOMI_LIVELLI.map((l) => [l, new Set()]))
  for (const t of [...requisiti, ...bisogni, ...architettura].flatMap((v) => v.test_cases)) {
    const l = livello(t)
    if (l) testPerLivello[l].add(t)
  }
  return {
    bisogni: bisogni.length,
    bisogniAccettati: bisogni.filter((b) => b.test_cases.length > 0).length,
    requisiti: vivi.length,
    requisitiConBisogno: vivi.filter((r) => per.has(r.id)).length,
    componenti: architettura.length,
    test: Object.fromEntries(NOMI_LIVELLI.map((l) => [l, testPerLivello[l].size])),
  }
}
