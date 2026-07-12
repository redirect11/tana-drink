// Stili condivisi dell'interfaccia POS (cassa e dettaglio ordine).
// In un modulo separato dai componenti per non rompere il fast refresh.

export function catBtnStyle(active) {
  return {
    width: '100%',
    padding: '10px 6px',
    borderRadius: 10,
    border: 'none',
    background: active
      ? 'var(--accent, #b47a3c)'
      : 'var(--tile-bg)',
    color: active ? '#fff' : 'inherit',
    fontWeight: active ? 700 : 400,
    fontSize: '0.8rem',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.12s',
    lineHeight: 1.25,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }
}

export const qtyBtnStyle = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '1px solid var(--line)',
  background: 'var(--tile-bg)',
  color: 'inherit',
  fontSize: '1.1rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
}
