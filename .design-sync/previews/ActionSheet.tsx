import { ActionSheet } from 'karaoke-drink'

const niente = () => {}

// Il pannello sale dal basso: nella scheda l'overlay si ferma al riquadro
// della cella, quindi gli si dà l'altezza di uno schermo e il menu si appoggia
// al bordo di sotto, come sul telefono.
const Schermo = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: 560 }}>{children}</div>
)

// Il menu delle azioni di un conto, com'è al banco.
export const AzioniDelConto = () => (
  <Schermo>
    <ActionSheet
      open
      onClose={niente}
      titolo="Conto #12 — Marta"
      voci={[
        { id: 'unisci', label: 'Unisci a un altro conto', icon: '🔗' },
        { id: 'gruppo', label: 'Metti in un gruppo', icon: '👥', hint: 'Tavolata di 6' },
        { id: 'storia', label: 'Storia del conto', icon: '🕘' },
        { id: 'annulla', label: 'Annulla il conto', icon: '✖️', danger: true },
      ]}
    />
  </Schermo>
)

// Voci spente: restano visibili e al loro posto. Farle sparire sposterebbe
// tutte le altre proprio mentre stai per premerle.
export const VociSpente = () => (
  <Schermo>
    <ActionSheet
      open
      onClose={niente}
      titolo="Conto #7 — già pagato"
      voci={[
        { id: 'storia', label: 'Storia del conto', icon: '🕘' },
        { id: 'ristampa', label: 'Ristampa il conto', icon: '🧾' },
        { id: 'unisci', label: 'Unisci a un altro conto', icon: '🔗', disabled: true, hint: 'Il conto è chiuso' },
        { id: 'annulla', label: 'Annulla il conto', icon: '✖️', danger: true, disabled: true, hint: 'Rimetti prima in corso' },
      ]}
    />
  </Schermo>
)
