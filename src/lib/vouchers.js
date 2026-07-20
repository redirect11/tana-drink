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

// Solo i buoni con saldo utile (per la scelta al pagamento), ordinati per nome.
export function activeVouchers(vouchers) {
  return (vouchers || [])
    .filter((v) => round2(v.balance) > 0)
    .sort((a, b) => String(a.holder_name).localeCompare(String(b.holder_name)))
}

// Totale del credito in circolazione.
export const totalOutstanding = (vouchers) =>
  round2((vouchers || []).reduce((s, v) => s + Math.max(0, Number(v.balance) || 0), 0))
