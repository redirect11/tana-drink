// Wrapper delle callable di pagamento. In ambiente emulatore non c'è
// l'emulatore delle functions: si degrada con grazia (la UI mostra il
// fallback e i flussi si simulano dai DevTools).
import { httpsCallable } from 'firebase/functions'
import { functions } from './firebaseClient.js'

const isEmulator = String(import.meta.env.VITE_USE_FIREBASE_EMULATOR) === 'true'

const call = (name) => (data) =>
  httpsCallable(functions, name)(data).then((r) => r.data)

export async function createPaymentCheckout(orderId) {
  if (isEmulator) return { unavailable: true }
  return call('createPaymentCheckout')({ orderId })
}

export async function getPaymentStatus(orderId) {
  if (isEmulator) return { unavailable: true }
  return call('getPaymentStatus')({ orderId })
}

// ── Lettore SumUp (Cloud API) — ruoli bartender/staff ─────────────────

export async function pairSumUpReader(pairingCode) {
  if (isEmulator) return { unavailable: true }
  return call('pairSumUpReader')({ pairing_code: pairingCode })
}

export async function unpairSumUpReader() {
  if (isEmulator) return { unavailable: true }
  return call('unpairSumUpReader')({})
}

// `amount` (euro) e `items` opzionali per gli incassi PARZIALI (split del
// conto): il webhook registra il pagamento e chiude solo a residuo zero.
export async function readerCheckout(orderId, { amount = null, items = null } = {}) {
  if (isEmulator) return { unavailable: true }
  return call('readerCheckout')({ orderId, amount, items })
}

export async function readerTerminate(orderId) {
  if (isEmulator) return { unavailable: true }
  return call('readerTerminate')({ orderId })
}

// ── Pagamento di un GRUPPO via SumUp ──────────────────────────────────

export async function createGroupCheckout(paymentId) {
  if (isEmulator) return { unavailable: true }
  return call('createGroupCheckout')({ paymentId })
}

export async function getGroupPaymentStatus(paymentId) {
  if (isEmulator) return { unavailable: true }
  return call('getGroupPaymentStatus')({ paymentId })
}

export async function groupReaderCheckout(paymentId) {
  if (isEmulator) return { unavailable: true }
  return call('groupReaderCheckout')({ paymentId })
}
