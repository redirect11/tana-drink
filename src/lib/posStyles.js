// Stili condivisi dell'interfaccia POS (cassa e dettaglio ordine).
// In un modulo separato dai componenti per non rompere il fast refresh.

export function catBtnStyle(active) {
  return {
    width: '100%',
    // padding in em: l'altezza del tasto scala col font (che segue la larghezza)
    padding: '0.6em 0.5em',
    borderRadius: 10,
    border: 'none',
    background: active
      ? 'var(--accent, #b47a3c)'
      : 'var(--tile-bg)',
    color: active ? '#fff' : 'inherit',
    fontWeight: active ? 700 : 400,
    // em (non rem): così il font segue la scala della colonna categorie
    // (--cats-scale su .posd-cats), crescendo/calando con la larghezza.
    fontSize: '0.8em',
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
  // em: i tastini +/- scalano col font della card (larghezza colonna centrale).
  width: '1.5em',
  height: '1.5em',
  borderRadius: '50%',
  border: '1px solid var(--line)',
  background: 'var(--tile-bg)',
  color: 'inherit',
  fontSize: '1em',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
}
