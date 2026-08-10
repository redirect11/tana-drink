// Gestione utenze dal gestionale. In produzione passa dalla callable
// `staffAdmin` (Admin SDK: l'elenco lo vede chi gestisce, le nomine solo
// l'admin). In ambiente emulatore parla direttamente con l'Auth emulator
// (nessuna function necessaria nel docker-compose).
import { httpsCallable } from 'firebase/functions'
import { functions } from './firebaseClient.js'
import { RUOLI } from './ruoli.js'

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
  const users = (await utenzeEmulatore()).filter((u) => RUOLI.includes(u.role))
  ricordaStaff(users)
  return users
}

// ELENCO COMPLETO, clienti registrati compresi: è la lista da cui l'admin
// nomina i ruoli. Non finisce nella cache dello staff, che serve ad altro
// (cerca-persone, turni) e non deve gonfiarsi con tutti i clienti.
export async function listUtenti() {
  if (!isEmulator) return (await call({ action: 'list', tutti: true })).users
  return utenzeEmulatore()
}

async function utenzeEmulatore() {
  const res = await emulatorRequest('accounts:query', {})
  return (res.userInfo || []).map((u) => ({
    uid: u.localId,
    email: u.email,
    name: u.displayName || null,
    role: safeRole(u.customAttributes),
    disabled: !!u.disabled,
    created_at: u.createdAt ? new Date(Number(u.createdAt)).toISOString() : null,
    last_login_at: u.lastLoginAt ? new Date(Number(u.lastLoginAt)).toISOString() : null,
  }))
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
    // Declassare a cliente vuol dire togliere il claim, non scriverne uno.
    customAttributes: role === 'cliente' ? JSON.stringify({}) : JSON.stringify({ role }),
  })
}

// Sospende l'accesso senza cancellare nulla: l'account resta, con i suoi
// turni e le sue ore, ma non entra più. È il gesto giusto per chi non
// lavora più qui — l'eliminazione è definitiva e porta via lo storico.
export async function setStaffDisabled(uid, disabled) {
  if (!isEmulator) return call({ action: 'setDisabled', uid, disabled })
  return emulatorRequest('accounts:update', { localId: uid, disableUser: disabled })
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
