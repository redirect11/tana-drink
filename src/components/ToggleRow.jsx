// L'INTERRUTTORE CON LA SUA SPIEGAZIONE: una riga, il nome sopra e il
// perché sotto. È la forma di ogni acceso/spento del pannello impostazioni
// e degli avvisi — stava scritta uguale in due file, e da quando la usa
// anche «Stampa automatica» sarebbero stati tre.
export default function ToggleRow({ label, desc, checked, onChange, disabled }) {
  return (
    <div className="toggle-row">
      <div>
        <div>{label}</div>
        {desc && <div className="desc">{desc}</div>}
      </div>
      <input
        type="checkbox"
        className="toggle"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  )
}
