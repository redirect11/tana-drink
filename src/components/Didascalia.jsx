// ── LE DIDASCALIE NON SONO UN ABBELLIMENTO ───────────────────────────
// Una tabella di conti è piena di parole che a chi non fa il contabile non
// dicono niente — utile, rapporto, incidenza, prime cost, costo del
// venduto. Sotto ogni tabella e ogni riga di sintesi va una frase corta che
// dice CHE NUMERO È e DA DOVE VIENE, in parole da banco.
//
// E DOVE UN NUMERO HA UN'AVVERTENZA che cambia come si legge, l'avvertenza
// sta LÌ, sotto il numero a cui si riferisce: chi guarda un totale che non
// torna deve trovare il perché nel punto in cui se lo chiede, non in un
// manuale e non in una nota a fondo pagina.
//
// Sta in un file suo e non dentro la pagina Bilancio perché la usano anche
// le tabelle che ci abitano dentro, e una di quelle importa la pagina che
// la importa: un giro chiuso che prima o poi si paga.
export default function Didascalia({ children }) {
  return (
    <p className="muted small" style={{ margin: '8px 0 0' }}>
      {children}
    </p>
  )
}
