// Buoni VIP: credito ricaricabile associato a una persona. Logica pura.
// Un buono ha un saldo in € che si scala al pagamento e si ricarica.

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Importo effettivamente scalabile da un buono per coprire `amount`:
// mai più del saldo, mai negativo.
export function redeemable(balance, amount) {
  const b = Math.max(0, round2(balance))
  const a = Math.max(0, round2(amount))
  return round2(Math.min(b, a))
}

// Saldo dopo aver scalato (mai sotto zero).
export function balanceAfterRedeem(balance, amount) {
  return round2(Math.max(0, round2(balance) - redeemable(balance, amount)))
}

// ── Scadenza ──────────────────────────────────────────────────────────
// Tipi: 'none' | 'daily' | 'monthly' | 'yearly' | 'date' (expires_at).
// Con rinnovo automatico i periodici valgono sempre fino alla fine del
// periodo CORRENTE (rolling); senza, fino alla fine del periodo in cui il
// buono è stato creato (scadenza fissa).

const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
const endOfYear = (d) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)

// Data di scadenza effettiva (Date) o null se il buono non scade.
export function voucherExpiresAt(voucher, now = new Date()) {
  const type = voucher?.expiry_type || 'none'
  if (type === 'none') return null
  if (type === 'date') return voucher?.expires_at ? new Date(voucher.expires_at) : null
  const base = voucher?.auto_renew ? now : new Date(voucher?.created_at || now)
  if (type === 'daily') return endOfDay(base)
  if (type === 'monthly') return endOfMonth(base)
  if (type === 'yearly') return endOfYear(base)
  return null
}

export function isVoucherExpired(voucher, now = new Date()) {
  const exp = voucherExpiresAt(voucher, now)
  return exp != null && now.getTime() > exp.getTime()
}

// Solo i buoni SPENDIBILI (saldo utile e non scaduti), ordinati per nome.
export function activeVouchers(vouchers, now = new Date()) {
  return (vouchers || [])
    .filter((v) => round2(v.balance) > 0 && !isVoucherExpired(v, now))
    .sort((a, b) => String(a.holder_name).localeCompare(String(b.holder_name)))
}

// Etichetta breve della scadenza per la UI.
export function expiryLabel(voucher, now = new Date()) {
  const type = voucher?.expiry_type || 'none'
  if (type === 'none') return 'nessuna scadenza'
  const exp = voucherExpiresAt(voucher, now)
  if (!exp) return 'nessuna scadenza'
  const d = exp.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const renew = voucher?.auto_renew ? ' · si rinnova' : ''
  if (isVoucherExpired(voucher, now)) return `scaduto il ${d}`
  return `scade il ${d}${renew}`
}

// Totale del credito in circolazione.
export const totalOutstanding = (vouchers) =>
  round2((vouchers || []).reduce((s, v) => s + Math.max(0, Number(v.balance) || 0), 0))

// ── Riaprire un conto annullato che era stato scontato con un buono ──
// Annullando, il saldo era tornato al beneficiario (storno). Riaprendo, lo
// sconto sul conto è ancora lì: se non si ri-addebita, quello sconto diventa
// un regalo che nessuno ha pagato — e il credito in circolazione non torna
// più con i conti.
//
// Se nel frattempo il buono è stato speso altrove e il saldo non basta, si
// addebita quello che c'è e lo sconto si riduce a quella cifra (fino a
// sparire): meglio un conto che chiede qualche euro in più che un buono in
// rosso, che è credito inventato.
//
// Torna { addebito, discount, discount_amount }: `discount` è quello nuovo
// da scrivere sul conto (null = sconto tolto).
export function riaddebitoBuono(discount, saldo) {
  const voluto = Math.max(0, round2(discount?.value))
  const addebito = redeemable(saldo, voluto)
  if (addebito === voluto) {
    // Il saldo copre tutto: sul conto non cambia niente.
    return { addebito, discount, discount_amount: voluto }
  }
  return {
    addebito,
    discount: addebito > 0 ? { ...discount, value: addebito } : null,
    discount_amount: addebito,
  }
}
