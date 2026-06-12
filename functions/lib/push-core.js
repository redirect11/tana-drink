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

module.exports = {
  decideOrderPush,
  decideStaffCallPush,
  CANCEL_PHRASES,
  STAFF_CALL_VIBRATION,
}
