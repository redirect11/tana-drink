import { CancelOrderDialog } from 'karaoke-drink'

const niente = () => {}
const ORDINE = { daily_number: 12, service_mode: 'bancone' as const }

// L'overlay si ferma al riquadro della cella: senza l'altezza di uno schermo
// il dialogo esce dal bordo di sopra e ci si perde il titolo.
const Schermo = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: 640 }}>{children}</div>
)

// Salta il conto intero: le scorte usate tornano in magazzino.
export const Ordine = () => (
  <Schermo>
    <CancelOrderDialog order={ORDINE} kind="ordine" onConfirm={niente} onCancel={niente} />
  </Schermo>
)

// Salta la preparazione di una comanda.
export const Preparazione = () => (
  <Schermo>
    <CancelOrderDialog order={ORDINE} kind="preparazione" onConfirm={niente} onCancel={niente} />
  </Schermo>
)

// Il drink è stato fatto e nessuno l'ha ritirato: le scorte restano scalate.
export const NonRitirato = () => (
  <Schermo>
    <CancelOrderDialog order={ORDINE} kind="non_ritirato" onConfirm={niente} onCancel={niente} />
  </Schermo>
)

// Al tavolo la stessa cosa si chiama «non servito».
export const NonServitoAlTavolo = () => (
  <Schermo>
    <CancelOrderDialog
      order={{ daily_number: 4, service_mode: 'tavolo' }}
      kind="non_ritirato"
      defaultPhrase="staff"
      onConfirm={niente}
      onCancel={niente}
    />
  </Schermo>
)
