// LA MAIL DI UNA FATTURA DI CORTESIA: chi la emette, a chi è intestata, le
// righe, il totale. Una sola, per la schermata di pagamento (subito dopo
// l'incasso) e per l'elenco delle fatture (quando la si rimanda): erano due
// copie, e i dati fiscali di chi emette (REQ-FLOTTA-030) erano finiti in
// una sola — la mail più frequente, quella dopo il pagamento, ne restava
// senza. Logica pura: i dati del locale li passa chi chiama.

import { formatPrice } from './orderStatus.js'

export function mailFattura(fattura, { nomeLocale = '', datiFiscali = [] } = {}) {
  const c = fattura.customer || {}
  const righe = (fattura.items || []).map((i) => `${i.qty}x ${i.name} — ${formatPrice(i.qty * i.unit_price)}`).join('\n')
  const corpo = [
    `Fattura di cortesia n. ${fattura.number}`,
    nomeLocale,
    ...datiFiscali,
    '',
    `Intestata a: ${c.denominazione || ''}`,
    c.piva ? `P.IVA: ${c.piva}` : null,
    c.cf ? `CF: ${c.cf}` : null,
    c.indirizzo ? `Indirizzo: ${c.indirizzo}` : null,
    '',
    righe,
    fattura.discount_amount > 0 ? `Sconto: −${formatPrice(fattura.discount_amount)}` : null,
    `Totale: ${formatPrice(fattura.total)}`,
    '',
    'Documento non fiscale — copia di cortesia.',
  ]
    .filter((r) => r !== null)
    .join('\n')
  return `mailto:${encodeURIComponent(c.email || '')}?subject=${encodeURIComponent(
    `Fattura di cortesia n. ${fattura.number}`
  )}&body=${encodeURIComponent(corpo)}`
}
