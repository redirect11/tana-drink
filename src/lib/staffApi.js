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

export async function listStaff() {
  if (!isEmulator) return (await call({ action: 'list' })).users
  const res = await emulatorRequest('accounts:query', {})
  return (res.userInfo || [])
    .map((u) => ({
      uid: u.localId,
      email: u.email,
      role: safeRole(u.customAttributes),
      disabled: !!u.disabled,
    }))
    .filter((u) => u.role === 'bartender' || u.role === 'staff')
}

export async function createStaff({ email, password, role }) {
  if (!isEmulator) return call({ action: 'create', email, password, role })
  const created = await emulatorRequest('accounts', { email, password })
  await emulatorRequest('accounts:update', {
    localId: created.localId,
    customAttributes: JSON.stringify({ role }),
  })
  return { uid: created.localId, email, role }
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
