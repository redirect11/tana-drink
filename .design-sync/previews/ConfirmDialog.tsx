import { ConfirmDialog } from 'karaoke-drink'

const niente = () => {}

// I dialoghi vivono in un overlay a tutta pagina. Nella scheda l'overlay si
// ferma al riquadro della cella (che lo contiene apposta, per non dilagare
// sulle schede vicine), quindi bisogna dargli l'altezza di uno schermo: senza,
// il dialogo esce dal bordo di sopra e ci si perde il titolo.
const Schermo = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: 560 }}>{children}</div>
)

// Il caso normale: si dice cosa succede, non «sei sicuro?».
export const Conferma = () => (
  <Schermo>
    <ConfirmDialog
      title="Svuotare il conto?"
      message={
        'Tolgo tutte le righe non ancora confermate.\nQuelle già mandate al banco restano dove sono.'
      }
      confirmLabel="Svuota"
      onConfirm={niente}
      onCancel={niente}
    />
  </Schermo>
)

// `danger`: il tasto di conferma diventa rosso. Per le cose da cui non si torna indietro.
export const Pericolo = () => (
  <Schermo>
    <ConfirmDialog
      title="Annullare il conto #12?"
      message="Le scorte usate tornano in magazzino. Il cliente riceve un avviso."
      confirmLabel="Annulla il conto"
      cancelLabel="Lascia com'è"
      danger
      onConfirm={niente}
      onCancel={niente}
    />
  </Schermo>
)

// Solo il messaggio, senza titolo: per le conferme brevi in mezzo a un'altra cosa.
export const SoloMessaggio = () => (
  <Schermo>
    <ConfirmDialog
      message="Stampo di nuovo la comanda al banco?"
      confirmLabel="Ristampa"
      onConfirm={niente}
      onCancel={niente}
    />
  </Schermo>
)
