// =====================================================================
//  ACCESSO GREZZO A FIRESTORE per gli script di manutenzione.
//
//  Parla con l'API REST usando la sessione del Firebase CLI (firebase
//  login): niente service account da custodire, niente chiavi nel repo.
//
//  I documenti si maneggiano nel formato NATIVO di Firestore (`fields`,
//  con stringValue/integerValue/…): così un backup e un ripristino
//  restituiscono ESATTAMENTE i tipi di partenza — un timestamp resta un
//  timestamp e un intero non diventa un decimale.
// =====================================================================
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'

export async function accessToken() {
  const percorso = `${homedir()}/.config/configstore/firebase-tools.json`
  let cfg
  try {
    cfg = JSON.parse(readFileSync(percorso, 'utf8'))
  } catch {
    throw new Error('Sessione Firebase assente: esegui "npx firebase-tools login".')
  }
  const res = await (
    await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLI_CLIENT_ID,
        client_secret: CLI_CLIENT_SECRET,
        refresh_token: cfg.tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
  ).json()
  if (!res.access_token) throw new Error('Autenticazione fallita: rifai "npx firebase-tools login".')
  return res.access_token
}

export function client(progetto, token) {
  const radice = `projects/${progetto}/databases/(default)/documents`
  const BASE = `https://firestore.googleapis.com/v1/${radice}`
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  async function chiedi(url, opts = {}) {
    const res = await fetch(url, { ...opts, headers: { ...auth, ...(opts.headers || {}) } })
    const json = await res.json().catch(() => ({}))
    if (json.error) throw new Error(`${json.error.status || res.status}: ${json.error.message}`)
    return json
  }

  return {
    progetto,
    radice,

    // Nomi delle collezioni alla radice (o dentro un documento).
    async collezioni(percorsoDoc = '') {
      const url = percorsoDoc
        ? `https://firestore.googleapis.com/v1/${percorsoDoc}:listCollectionIds`
        : `${BASE}:listCollectionIds`
      const out = []
      let pageToken
      do {
        const r = await chiedi(url, {
          method: 'POST',
          body: JSON.stringify(pageToken ? { pageToken } : {}),
        })
        out.push(...(r.collectionIds || []))
        pageToken = r.nextPageToken
      } while (pageToken)
      return out.sort()
    },

    // Tutti i documenti di una collezione, nel formato nativo.
    async documenti(collezione) {
      const out = []
      let pageToken = ''
      do {
        const r = await chiedi(
          `${BASE}/${collezione}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`
        )
        out.push(...(r.documents || []))
        pageToken = r.nextPageToken || ''
      } while (pageToken)
      return out
    },

    // Scritture in blocco (max 200 per chiamata: il limite del commit è 500
    // ma i documenti di un ordine sono grossi e le richieste enormi vanno
    // in timeout).
    async commit(writes) {
      for (let i = 0; i < writes.length; i += 200) {
        await chiedi(`https://firestore.googleapis.com/v1/${radice}:commit`, {
          method: 'POST',
          body: JSON.stringify({ writes: writes.slice(i, i + 200) }),
        })
      }
    },

    scriviDoc(collezione, id, fields) {
      return { update: { name: `${radice}/${collezione}/${id}`, fields: fields || {} } }
    },
    cancellaDoc(collezione, id) {
      return { delete: `${radice}/${collezione}/${id}` }
    },
  }
}

export const idDi = (doc) => doc.name.split('/').pop()

// Legge un argomento da riga di comando: --nome valore
export function arg(nome, fallback = null) {
  const i = process.argv.indexOf(`--${nome}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
export const flag = (nome) => process.argv.includes(`--${nome}`)
