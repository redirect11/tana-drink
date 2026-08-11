'use strict'

// Logica pura per le notifiche push sugli ordini: decide se e cosa inviare
// quando un ordine cambia stato. Nessuna dipendenza Firebase: testabile.

const CANCEL_PHRASES = {
  bancone: 'Prego recarsi al bancone.',
  staff: 'Lo staff sarà subito da te.',
}

// Chi sta al banco: batte gli ordini di persona, quindi non ha bisogno che
// glieli annuncino. (Stessa coppia di src/lib/ruoli.js: qui non si possono
// importare i moduli del client.)
const BANCO = ['admin', 'bartender']

// Conta le comande di un ordine in un dato stato. Retrocompatibile: i doc
// legacy (senza `comande`) valgono come una sola comanda con lo stato
// dell'ordine.
function countComande(o, status) {
  if (!o) return 0
  if (Array.isArray(o.comande)) return o.comande.filter((c) => c && c.status === status).length
  return o.status === status ? 1 : 0
}

// Dati (before, after) di un documento ordine. Restituisce il messaggio da
// inviare ({ title, body }) oppure null se non va notificato nulla.
function decideOrderPush(before, after) {
  if (!after || !after.push_token) return null

  // Una comanda in più è passata a "pronto" (vale anche per le aggiunte
  // a un conto aperto: ogni comanda pronta notifica il cliente).
  // SOLO col RITIRO AL BANCO: è l'unico caso in cui il cliente deve fare
  // qualcosa (alzarsi e venire a prendere il drink). Al tavolo ci pensa il
  // servizio, quindi avvisarlo sarebbe un disturbo inutile.
  // Il push arriva comunque solo a chi ha ordinato dal menù: gli ordini
  // battuti dallo staff nascono senza push_token (vedi sopra).
  if (
    after.service_mode === 'banco' &&
    countComande(after, 'pronto') > countComande(before, 'pronto')
  ) {
    return {
      title: '🔔 Il tuo drink è pronto!',
      body: `Ordine #${after.daily_number ?? '—'} pronto al ritiro.`,
    }
  }

  if (!before || before.status === after.status) return null
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
  if (!after) return null
  if (countComande(after, 'pronto') <= countComande(before, 'pronto')) return null
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
  if (!o || countComande(o, 'ricevuto') === 0) return false
  if (o.payment_required && o.payment_status !== 'pagato') return false
  return true
}

// Numero di comande "in coda" pagabili (0 se il pagamento obbligatorio manca).
function payableReceivedCount(o) {
  if (!isPayableReceived(o)) return 0
  return countComande(o, 'ricevuto')
}

// Nuovo ordine da preparare → notifica allo staff al bancone. Vale sia alla
// creazione (before assente) sia quando un ordine fermo in attesa di pagamento
// obbligatorio viene saldato (e solo allora entra in coda). Restituisce il
// messaggio { title, body } o null se non c'è nulla di nuovo da notificare.
function decideNewOrderStaffPush(before, after) {
  // Ordine battuto al banco (admin o bartender): nessuna notifica —
  // avvisano solo gli ordini di clienti o staff di sala.
  if (after && after.placed_by && BANCO.includes(after.placed_by.role)) return null
  const now = payableReceivedCount(after)
  const prev = payableReceivedCount(before)
  if (now <= prev) return null // niente di nuovo in coda
  const tavolo = after.table_label ? ` · Tavolo ${after.table_label}` : ''
  const nome = after.customer_name ? ` — ${after.customer_name}` : ''
  // Aggiunta a un conto già esistente (seconda comanda in poi) vs primo invio.
  const isAddition = Array.isArray(after.comande) && after.comande.length > 1
  return isAddition
    ? {
        title: '➕ Aggiunta al conto',
        body: `Nuova comanda sull'ordine #${after.daily_number ?? '—'}.${tavolo}${nome}`,
      }
    : {
        title: '🆕 Nuovo ordine',
        body: `Ordine #${after.daily_number ?? '—'} ricevuto.${tavolo}${nome}`,
      }
}

module.exports = {
  countComande,
  decideOrderPush,
  decideStaffCallPush,
  decideStaffServePush,
  decideNewOrderStaffPush,
  isPayableReceived,
  CANCEL_PHRASES,
  STAFF_CALL_VIBRATION,
}
