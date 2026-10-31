// ── I PERMESSI PER RUOLO, CONTRO firestore.rules (REQ-FLOTTA-021) ─────
//
// La tabella sta in tests/contratto/permessi.js, scritta uguale per ogni
// backend. Qui la si fa girare contro le regole vere di Firestore,
// sull'emulatore: per ogni collezione, ogni ruolo e ogni operazione, chi
// la tabella lascia passare passa, e chi no viene fermato. Ogni prova è
// doppia, come le altre di questa cartella: una regola che chiude tutto è
// facile da scrivere e la sera manda a casa il locale.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { avviaAmbiente, CHI } from './ambiente.js'
import { RUOLI, PERMESSI, OPERAZIONI, PROPRI, chiPuo } from '../contratto/permessi.js'

let env

beforeAll(async () => {
  env = await avviaAmbiente('permessi')
})
afterAll(async () => {
  await env?.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
})

const uid = (ruolo) => `${ruolo}-1`
const dbDi = (ruolo) => (ruolo === 'anonimo' ? CHI.anonimo(env) : CHI[ruolo](env, uid(ruolo)))

// Il documento c'è già (scritto senza regole), tranne che per crearlo.
async function semina(percorso, dati = { nome: 'esistente', uid: null }) {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), percorso), dati))
}

// Un'operazione, come la fa l'app.
async function prova(ruolo, operazione, collezione, id, datiSemina) {
  const db = dbDi(ruolo)
  const percorso = `${collezione}/${id}`
  if (operazione !== 'crea') await semina(percorso, datiSemina)
  switch (operazione) {
    case 'legge':
      return Promise.all([getDoc(doc(db, percorso)), ...(id.endsWith('-1') ? [] : [getDocs(collection(db, collezione))])])
    case 'crea':
      return setDoc(doc(db, percorso), { nome: 'nuovo', uid: uid(ruolo) })
    case 'aggiorna':
      return updateDoc(doc(db, percorso), { nome: 'cambiato' })
    case 'cancella':
      return deleteDoc(doc(db, percorso))
  }
}

const atteso = (puo) => (puo ? assertSucceeds : assertFails)

describe.each(PERMESSI)('$collezione', (riga) => {
  it.each(OPERAZIONI)('%s', async (operazione) => {
    const puo = chiPuo(riga, operazione)
    for (const ruolo of RUOLI) {
      await env.clearFirestore()
      await atteso(puo.includes(ruolo))(prova(ruolo, operazione, riga.collezione, 'x'))
    }
  })
})

describe.each(PROPRI)('$collezione, documenti propri e altrui', (riga) => {
  it.each(OPERAZIONI)('%s', async (operazione) => {
    for (const [di, chi] of [['proprio', riga.proprio], ['altrui', riga.altrui]]) {
      const puo = operazione === 'legge' ? chi.legge : chi[operazione] ?? chi.scrive
      for (const ruolo of RUOLI) {
        await env.clearFirestore()
        // Il documento proprio porta l'uid di chi bussa, nell'id e dentro.
        const id = di === 'proprio' ? uid(ruolo) : 'qualcun-altro-1'
        const proprietario = di === 'proprio' ? uid(ruolo) : 'qualcun-altro-1'
        await atteso(puo.includes(ruolo))(prova(ruolo, operazione, riga.collezione, id, { nome: 'esistente', uid: proprietario }))
      }
    }
  })
})
