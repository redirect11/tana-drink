import { Link } from 'react-router-dom'
import { useMenuCliente } from '../lib/useMenuCliente.js'

// «TORNA AL MENÙ», O ALLA PAGINA INIZIALE (REQ-LIC-002). Daniele,
// 14/11/2026: col menù dei clienti spento «non ci si può arrivare in alcun
// modo». Le pagine dei clienti (accesso, profilo, i propri ordini, lo
// stato di un ordine) avevano un «Torna al menù» fisso, che col menù spento
// portava alla pagina che dice che non c'è: allora si torna all'inizio.
export default function TornaAlMenu({ className = 'btn ghost block', style, children = '← Torna al menù' }) {
  const { menu } = useMenuCliente()
  return menu ? (
    <Link className={className} style={style} to="/menu">
      {children}
    </Link>
  ) : (
    <Link className={className} style={style} to="/">
      ← Torna alla pagina iniziale
    </Link>
  )
}
