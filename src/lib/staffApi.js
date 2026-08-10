// Gestione utenze staff dal gestionale. In produzione passa dalla
// callable `staffAdmin` (Admin SDK, riservata al bartender). In ambiente
// emulatore parla direttamente con l'Auth emulator (nessuna function
// necessaria nel docker-compose).
import { httpsCallable } from 'firebase/functions'
import { functions } from './firebaseClient.js'

const isEmulator = String(import.meta.env.VITE_USE_FIREBASE_EMULATOR) === 'true'
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
const emulatorAuthHost = `http://${window.location.hostname}:9099/identitytoolkit.googleapis.com`

async function emulatorRequest(path, body) {
  const res = await fetch(`${emulatorAuthHost}/v1/projects/${projectId}/${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json
}

const call = (data) => httpsCallable(functions, 'staffAdmin')(data).then((r) => r.data)

// ELENCO STAFF IN CACHE. `listStaff` passa da una Cloud Function: e' lenta e
// vuole la rete, quindi ogni pannello che la apriva mostrava "Carico lo
// staff…" per qualche secondo — e offline non arrivava mai. La lista cambia
// una volta ogni morte di papa: si tiene da parte e la si mostra subito,
// aggiornandola in sottofondo.
const CHIAVE_STAFF = 'tana:staff'
let cacheStaff = null

export function staffFromCache() {
  if (cacheStaff) return cacheStaff
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_STAFF) || 'null')
    if (Array.isArray(v)) cacheStaff = v
  } catch {
    /* niente cache: si aspetta la rete, come prima */
  }
  return cacheStaff
}

function ricordaStaff(list) {
  cacheStaff = Array.isArray(list) ? list : null
  try {
    if (cacheStaff) localStorage.setItem(CHIAVE_STAFF, JSON.stringify(cacheStaff))
  } catch {
    /* memoria piena o negata: pazienza */
  }
}

// Scalda la cache senza che nessuno stia aspettando: si chiama all'apertura
// del gestionale, così quando si aprono i pannelli l'elenco è già lì.
export function preloadStaff() {
  listStaff().catch(() => {})
}

export async function listStaff() {
  if (!isEmulator) {
    const users = (await call({ action: 'list' })).users
    ricordaStaff(users)
    return users
  }
  const res = await emulatorRequest('accounts:query', {})
  const users = (res.userInfo || [])
    .map((u) => ({
      uid: u.localId,
      email: u.email,
      name: u.displayName || null,
      role: safeRole(u.customAttributes),
      disabled: !!u.disabled,
    }))
    .filter((u) => u.role === 'bartender' || u.role === 'staff')
  ricordaStaff(users)
  return users
}

export async function createStaff({ email, password, role, name }) {
  if (!isEmulator) return call({ action: 'create', email, password, role, name })
  const created = await emulatorRequest('accounts', { email, password })
  await emulatorRequest('accounts:update', {
    localId: created.localId,
    displayName: (name || '').trim() || undefined,
    customAttributes: JSON.stringify({ role }),
  })
  return { uid: created.localId, email, name: (name || '').trim() || null, role }
}

export async function setStaffRole(uid, role) {
  if (!isEmulator) return call({ action: 'setRole', uid, role })
  return emulatorRequest('accounts:update', {
    localId: uid,
    customAttributes: JSON.stringify({ role }),
  })
}

export async function removeStaff(uid) {
  if (!isEmulator) return call({ action: 'delete', uid })
  return emulatorRequest('accounts:delete', { localId: uid })
}

function safeRole(customAttributes) {
  try {
    return JSON.parse(customAttributes || '{}').role || 'cliente'
  } catch {
    return 'cliente'
  }
}
