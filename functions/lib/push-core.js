'use strict'

// Logica pura per le notifiche push sugli ordini: decide se e cosa inviare
// quando un ordine cambia stato. Nessuna dipendenza Firebase: testabile.

const CANCEL_PHRASES = {
  bancone: 'Prego recarsi al bancone.',
  staff: 'Lo staff sarà subito da te.',
}

// Dati (before, after) di un documento ordine. Restituisce il messaggio da
// inviare ({ title, body }) oppure null se non va notificato nulla.
function decideOrderPush(before, after) {
  if (!after || !after.push_token) return null
  if (!before || before.status === after.status) return null

  if (after.status === 'pronto') {
    // Al tavolo non si ritira nulla: arriva il servizio.
    const body = after.service_mode === 'tavolo'
      ? `Ordine #${after.daily_number ?? '—'}: il drink verrà servito il prima possibile.`
      : `Ordine #${after.daily_number ?? '—'} pronto al ritiro.`
    return { title: '🔔 Il tuo drink è pronto!', body }
  }

  if (
    after.status === 'annullato' &&
    after.cancelled_by === 'bartender' &&
    after.cancel_notify === true
  ) {
    const phrase = CANCEL_PHRASES[after.cancel_phrase] || CANCEL_PHRASES.bancone
    const motivo = after.cancel_message ? ` Motivazione: ${after.cancel_message}` : ''
    return {
      title: '⚠️ Problema con il tuo ordine',
      body: `${phrase}${motivo}`,
    }
  }

  return null
}

// Pattern di vibrazione "cerca-persone": forte e riconoscibile.
// Lo stesso pattern è usato dal service worker e dalla pagina.
const STAFF_CALL_VIBRATION = [500, 200, 500, 200, 900]

// Documento staff_calls appena creato → messaggio push per il membro
// dello staff chiamato, o null se non c'è nulla da inviare.
function decideStaffCallPush(call) {
  if (!call || !call.to_uid) return null
  if (call.status && call.status !== 'pending') return null
  // Mai l'email del chiamante: al massimo il nome.
  const da = call.from_name || null
  return {
    title: '📟 Chiamata dal bancone',
    body: call.message
      ? da
        ? `${da}: «${call.message}»`
        : `«${call.message}»`
      : da
        ? `${da} ti sta chiamando. Rispondi sul telefono.`
        : 'Rispondi sul telefono.',
  }
}

// Ordine passato a "pronto" da servire al tavolo → notifica per lo
// staff di sala (il ritiro al banco lo gestisce il cliente).
function decideStaffServePush(before, after) {
  if (!before || !after || before.status === after.status) return null
  if (after.status !== 'pronto') return null
  if (after.service_mode === 'banco') return null
  const tavolo = after.table_label ? ` · Tavolo ${after.table_label}` : ''
  const nome = after.customer_name ? ` — ${after.customer_name}` : ''
  return {
    title: '🫱 Drink pronti da servire',
    body: `Ordine #${after.daily_number ?? '—'}${tavolo}${nome}`,
  }
}

// L'ordine è "ricevuto" ed entrato in coda di preparazione? È la stessa
// regola del gestionale (src/lib/payments.js → isAwaitingPayment): un ordine
// con pagamento OBBLIGATORIO non si prepara — e quindi non si notifica —
// finché non risulta pagato.
function isPayableReceived(o) {
  if (!o || o.status !== 'ricevuto') return false
  if (o.payment_required && o.payment_status !== 'pagato') return false
  return true
}

// Nuovo ordine da preparare → notifica allo staff al bancone. Vale sia alla
// creazione (before assente) sia quando un ordine fermo in attesa di pagamento
// obbligatorio viene saldato (e solo allora entra in coda). Restituisce il
// messaggio { title, body } o null se non c'è nulla di nuovo da notificare.
function decideNewOrderStaffPush(before, after) {
  if (!isPayableReceived(after)) return null
  if (isPayableReceived(before)) return null // era già in coda: già notificato
  const tavolo = after.table_label ? ` · Tavolo ${after.table_label}` : ''
  const nome = after.customer_name ? ` — ${after.customer_name}` : ''
  return {
    title: '🆕 Nuovo ordine',
    body: `Ordine #${after.daily_number ?? '—'} ricevuto.${tavolo}${nome}`,
  }
}

module.exports = {
  decideOrderPush,
  decideStaffCallPush,
  decideStaffServePush,
  decideNewOrderStaffPush,
  isPayableReceived,
  CANCEL_PHRASES,
  STAFF_CALL_VIBRATION,
}
