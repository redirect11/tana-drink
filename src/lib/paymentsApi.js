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
