import { ThemeSettings } from 'karaoke-drink'

const niente = () => {}

// Le due impostazioni come arrivano da Firestore (settings/bar): un preset per
// il gestionale, uno per la vista cliente.
export const DueTemi = () => (
  <ThemeSettings
    settings={{
      theme_staff: { preset: 'tana-scuro', custom: null },
      theme_client: { preset: 'tana-scuro', custom: null },
    }}
    onSave={niente}
  />
)

// Con degli scostamenti di colore salvati: l'etichetta dice «personalizzato» e
// nessun preset risulta più quello attivo.
export const ConColoriPersonalizzati = () => (
  <ThemeSettings
    settings={{
      theme_staff: { preset: 'tana-scuro', custom: { '--accent': '#7b6cff' } },
      theme_client: { preset: 'tana-scuro', custom: null },
    }}
    onSave={niente}
  />
)
