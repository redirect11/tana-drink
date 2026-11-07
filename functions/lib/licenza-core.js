'use strict'

// ── LA LICENZA, LETTA DALLE FUNCTIONS (BUG-134) ──────────────────────────
//
// Il controllo vero dei moduli sta nelle regole di Firestore (REQ-LIC-008):
// l'app nasconde, le regole rifiutano. Ma le Functions girano coi permessi
// dell'amministratore, e le regole non le fermano: fino al 07/11/2026
// nessuna leggeva la licenza, e i pagamenti SumUp partivano anche dove il
// modulo non c'è, chiamandoli a mano dalla console del browser. Trovato
// dalla matrice dei moduli (REQ-DEV-017).
//
// Questa è la stessa domanda di `modulo(id)` in firestore.rules, scritta
// una seconda volta perché le regole non si chiamano da qui. Le due devono
// dire la stessa cosa: tests/bdd/licenza-functions.test.js le confronta
// sui casi delle regole (stato, scadenza, scadenza verso il Free).

const BLOCCANTI = ['sospesa', 'chiusa', 'non_attivata']

// Un istante in millisecondi da un Timestamp di Firestore, una Date o una
// stringa ISO. Null se non si legge.
function inMillisecondi(v) {
  if (!v) return null
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (v instanceof Date) return v.getTime()
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

// Il modulo è incluso in questa licenza, adesso? Come le regole: senza
// licenza niente; sospesa, chiusa o non attivata niente; scaduta niente, e
// scaduta verso il Free si lavora ma senza moduli; un modulo che la licenza
// non nomina non c'è.
function moduloInLicenza(licenza, id, adesso = Date.now()) {
  if (!licenza || typeof licenza !== 'object') return false
  if (BLOCCANTI.includes(licenza.stato)) return false
  const fino = inMillisecondi(licenza.valida_fino_ts)
  if (fino !== null && adesso >= fino) return false
  return licenza.moduli?.[id] === true
}

// Per chi avvia una Function di un modulo: legge `licenza/attuale` e, se il
// modulo non c'è, risponde come le altre Functions, con un errore che
// HttpsError capisce. La frase la legge il personale al banco, quindi non
// parla di licenze e moduli in gergo.
async function richiediModulo(db, id, adesso = Date.now()) {
  const snap = await db.collection('licenza').doc('attuale').get()
  const licenza = snap.exists ? snap.data() : null
  if (!moduloInLicenza(licenza, id, adesso)) {
    throw {
      code: 'failed-precondition',
      message: 'Questa funzione non è inclusa nell’installazione.',
    }
  }
}

module.exports = { moduloInLicenza, richiediModulo }
