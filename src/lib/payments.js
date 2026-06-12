// Logica pura delle opzioni di pagamento al riepilogo ordine (niente
// Firebase: interamente testabile a unità).
//
// Impostazioni coinvolte:
// - payments_online_enabled:  il cliente può pagare online
// - payments_online_required: senza pagamento online non si ordina
// - banco_required_if_unpaid: chi non paga online ritira al banco
// - service_mode:             'banco' | 'tavolo' | 'entrambi'
//
// Con servizio SOLO al tavolo non esiste un banco da cui ritirare:
// l'opzione "paga dopo" diventa «Paga allo staff alla consegna» e il
// vincolo del banco non si applica (deciso dal proprietario).

export function paymentOptions(settings = {}) {
  const enabled = !!settings.payments_online_enabled
  const required = enabled && !!settings.payments_online_required
  const serviceMode = settings.service_mode || 'banco'
  const tavoloOnly = serviceMode === 'tavolo'

  // Il vincolo "banco se non pagato" vale solo dove un banco esiste.
  const counterForcesBanco =
    enabled && !required && !!settings.banco_required_if_unpaid && !tavoloOnly

  return {
    enabled,
    required,
    // Si può scegliere di pagare dopo (al banco o allo staff al tavolo).
    allowCounter: !required,
    counterForcesBanco,
    counterLabel: tavoloOnly ? '💶 Paga allo staff alla consegna' : '💶 Paga al bancone',
  }
}

// L'ordine entra in coda solo se pagato? (per gating coda/notifiche)
export function isAwaitingPayment(order) {
  return !!order?.payment_required && order?.payment_status !== 'pagato'
}
