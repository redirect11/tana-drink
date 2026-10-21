// UNA SCELTA FRA POCHE VOCI, TUTTE IN VISTA (`.chip-gruppo`, come i
// raggruppamenti delle chiusure): il periodo di una tabella, lordo o netto.
// Non una tendina — con tre o quattro voci bisognerebbe aprirla per sapere
// cosa c'è dentro (docs/navigazione.md).
//   opzioni: [{ id, label }]   valore: l'id scelto   scegli(id)
export default function GruppoChip({ etichetta, opzioni, valore, scegli, style }) {
  return (
    <div className="chip-gruppo" role="group" aria-label={etichetta} style={style}>
      {opzioni.map((o) => (
        <button
          key={o.label}
          type="button"
          className={`chip${valore === o.id ? ' active' : ''}`}
          aria-pressed={valore === o.id}
          onClick={() => scegli(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
