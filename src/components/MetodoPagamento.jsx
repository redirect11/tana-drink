import Icona from './Icona.jsx'
import { PAYMENT_METHOD_ICONA, paymentMethodNome } from '../lib/orderStatus.js'

// UN METODO DI PAGAMENTO NEI RIEPILOGHI DI CASSA (REQ-UI-031): l'icona nel
// tema «Tasti e stati», poi il nome. Un metodo sconosciuto (battuto da una
// versione più nuova, o a mano) ha il punto di domanda dei segnali, e il suo
// nome com'è scritto: contato lo è comunque.
export default function MetodoPagamento({ metodo }) {
  const icona = PAYMENT_METHOD_ICONA[metodo]
  return (
    <>
      {icona ? <Icona nome={icona} gruppo="tasti" /> : <Icona nome="domanda" gruppo="segnali" />}{' '}
      {paymentMethodNome(metodo)}
    </>
  )
}
