// ── I DATI DI PROVA COME «BUNDLE» DI FIRESTORE (REQ-FLOTTA-019) ─────────
//
// Un bundle è il formato con cui Firestore carica documenti nella sua cache
// senza chiederli al server (`loadBundle`). Nella demo il server non c'è:
// i dati di prova si scrivono qui, nel browser, come un bundle, e si
// caricano a rete spenta. Arrivano nella cache come documenti «del server»
// — non come migliaia di scritture in coda che non partiranno mai — e le
// schermate li leggono con le stesse query di sempre.
//
// Il formato (quello che produce l'SDK stesso, BundleBuilder): una serie di
// elementi JSON, ognuno preceduto dalla sua lunghezza in byte UTF-8. Prima
// i metadati (id, data, numero di documenti, byte che seguono), poi per ogni
// documento i suoi metadati e il documento. Un documento che NON esiste si
// scrive coi soli metadati (`exists: false`): serve per quelli che l'app
// legge uno per uno, che a rete spenta altrimenti darebbero errore invece
// di «non c'è».
//
// Logica pura, senza Firebase: si prova in Node.

const codifica = new TextEncoder()
const byte = (s) => codifica.encode(s).length
const conLunghezza = (oggetto) => {
  const s = JSON.stringify(oggetto)
  return `${byte(s)}${s}`
}

// Un valore JavaScript nel formato di Firestore (Value del REST/proto3).
export function valore(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valore) } }
  switch (typeof v) {
    case 'boolean':
      return { booleanValue: v }
    case 'number':
      return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
    case 'string':
      return { stringValue: v }
    case 'object':
      return { mapValue: { fields: campi(v) } }
    default:
      throw new Error(`Valore non rappresentabile in un bundle: ${typeof v}`)
  }
}

export function campi(oggetto) {
  const out = {}
  for (const [k, v] of Object.entries(oggetto)) {
    if (v === undefined) continue
    out[k] = valore(v)
  }
  return out
}

// `documenti`: [{ percorso: 'drinks/d1', dati: {...} }], con `dati: null`
// per un documento che non esiste.
export function creaBundle({ progetto, id, creato, documenti }) {
  const radice = `projects/${progetto}/databases/(default)/documents`
  const quando = creato.toISOString()
  let corpo = ''
  for (const d of documenti) {
    const nome = `${radice}/${d.percorso}`
    const esiste = d.dati !== null && d.dati !== undefined
    corpo += conLunghezza({ documentMetadata: { name: nome, readTime: quando, exists: esiste } })
    if (esiste) {
      corpo += conLunghezza({
        document: { name: nome, fields: campi(d.dati), createTime: quando, updateTime: quando },
      })
    }
  }
  const metadati = {
    id,
    createTime: quando,
    version: 1,
    totalDocuments: documenti.length,
    totalBytes: byte(corpo),
  }
  return conLunghezza({ metadata: metadati }) + corpo
}
