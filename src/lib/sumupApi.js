import { httpsCallable } from 'firebase/functions'
import { functions } from './firebaseClient.js'

// Abilitato solo se VITE_SUMUP_ENABLED=true nel .env.
// Quando non configurato, tutte le chiamate sono no-op silenziosi.
const enabled = import.meta.env.VITE_SUMUP_ENABLED === 'true'

// Esposto alla UI: il box di sync nel gestionale appare solo se attivo.
export const isSumUpEnabled = enabled

function call(name) {
  return httpsCallable(functions, name)
}

// Mappa stato Tana Drink → stato SumUp POS Pro
const TANA_TO_SUMUP = {
  in_preparazione: 'ACCEPTED',  // triggers printing + KDS in SumUp
  ritirato: 'COMPLETED',
}

export function toSumUpStatus(tanaStatus) {
  return TANA_TO_SUMUP[tanaStatus] ?? null
}

// Invia un ordine a SumUp POS Pro come External Sale.
// Fire-and-forget: non blocca il flusso del cliente in caso di errore.
export async function createSumUpSale(payload) {
  if (!enabled) return { skipped: true }
  try {
    const res = await call('createSumUpSale')(payload)
    return res.data
  } catch (e) {
    console.error('[SumUp] createSale:', e.message)
    return { error: e.message }
  }
}

// Aggiorna lo stato di una vendita su SumUp POS Pro.
export async function updateSumUpSaleStatus(saleId, sumupStatus) {
  if (!enabled || !saleId) return { skipped: true }
  try {
    const res = await call('updateSumUpSaleStatus')({ saleId, status: sumupStatus })
    return res.data
  } catch (e) {
    console.error('[SumUp] updateStatus:', e.message)
    return { error: e.message }
  }
}

// Scarica il catalogo da SumUp POS Pro e sincronizza su Firestore.
export async function syncSumUpProducts() {
  if (!enabled) {
    return { skipped: true, message: 'Imposta VITE_SUMUP_ENABLED=true nel .env per abilitare.' }
  }
  const res = await call('syncSumUpProducts')()
  return res.data
}
