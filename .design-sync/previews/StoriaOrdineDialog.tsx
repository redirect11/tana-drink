import { StoriaOrdineDialog } from 'karaoke-drink'

const niente = () => {}

// Un conto vissuto: aperto, chiuso con l'incasso, annullato per errore e
// rimesso in corso. Gli eventi non sono un campo a parte: si ricostruiscono
// da quello che il conto ha già addosso.
const CONTO_MOSSO = {
  id: 'o12',
  daily_number: 12,
  customer_name: 'Marta',
  status: 'aperto',
  tempi_conto: {
    aperto: '2026-08-14T21:04:00.000Z',
    pagato: '2026-08-14T23:12:00.000Z',
    annullato: '2026-08-14T23:20:00.000Z',
  },
  placed_by: { name: 'Ciro' },
  payment_method: 'contanti',
  cancelled_by: 'Ciro',
  cancel_message: 'chiuso sul tavolo sbagliato',
  riaperture: [
    { at: '2026-08-14T23:25:00.000Z', chi: 'Ciro', motivo: 'era il tavolo 6, non il 4' },
  ],
}

// L'overlay si ferma al riquadro della cella: senza l'altezza di uno schermo
// il dialogo esce dal bordo di sopra e ci si perde il titolo.
const Schermo = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: 560 }}>{children}</div>
)

export const ContoRiaperto = () => (
  <Schermo>
    <StoriaOrdineDialog order={CONTO_MOSSO} onClose={niente} />
  </Schermo>
)

// Un conto appena aperto: un evento solo, ed è giusto così.
export const AppenaAperto = () => (
  <Schermo>
    <StoriaOrdineDialog
      order={{
        id: 'o18',
        daily_number: 18,
        status: 'aperto',
        created_at: '2026-08-14T22:40:00.000Z',
      }}
      onClose={niente}
    />
  </Schermo>
)
