import { RipristinaOrdineDialog } from 'karaoke-drink'

const niente = () => {}

// L'overlay si ferma al riquadro della cella: senza l'altezza di uno schermo
// il dialogo esce dal bordo di sopra e ci si perde il titolo.
const Schermo = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: 560 }}>{children}</div>
)

// Conto chiuso: gli incassi già registrati restano dove sono.
export const ContoChiuso = () => (
  <Schermo>
    <RipristinaOrdineDialog
      order={{ daily_number: 12, customer_name: 'Marta', status: 'pagato' }}
      onConferma={niente}
      onClose={niente}
    />
  </Schermo>
)

// Conto annullato: le comande tornano da fare, e il magazzino si scala quando
// le si prepara. L'avvertenza cambia apposta.
export const ContoAnnullato = () => (
  <Schermo>
    <RipristinaOrdineDialog
      order={{ daily_number: 7, customer_name: 'Tavolo 4', status: 'annullato' }}
      onConferma={niente}
      onClose={niente}
    />
  </Schermo>
)
