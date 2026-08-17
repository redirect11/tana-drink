import { useState } from 'react'

// ── LA PASSWORD, CON L'OCCHIO PER GUARDARLA ──────────────────────────
//
// Al banco si entra da un tablet, spesso con le mani bagnate e una
// tastiera a schermo che sbaglia da sola. Una password scritta a pallini,
// se il tasto «entra» dice solo «credenziali errate», non si sa mai se è
// sbagliata la password o una lettera partita male.
//
// L'occhio la mostra finché serve. Parte sempre coperta: se qualcuno guarda
// da sopra la spalla — e al bancone c'è sempre qualcuno — deve essere una
// scelta, non la condizione di partenza.
export default function CampoPassword({ id, value, onChange, autoComplete, ...rest }) {
  const [visibile, setVisibile] = useState(false)
  return (
    <div className="campo-password">
      <input
        id={id}
        type={visibile ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        {...rest}
      />
      <button
        type="button"
        className="campo-password-occhio"
        onClick={() => setVisibile((v) => !v)}
        aria-label={visibile ? 'Nascondi la password' : 'Mostra la password'}
        title={visibile ? 'Nascondi la password' : 'Mostra la password'}
        // Fuori dal giro del tabulatore: chi compila con la tastiera passa
        // da password a «entra», non da un interruttore in mezzo.
        tabIndex={-1}
      >
        {visibile ? '🙈' : '👁'}
      </button>
    </div>
  )
}
