import { useEffect, useMemo, useState } from 'react'
import { subscribeSettings, settingsIniziali } from './api.js'
import { venueDi } from './venue.js'

// Il locale in mano a una schermata (REQ-VENUE-002): dalle impostazioni
// già in cache, aggiornato da solo. Niente lettura in più e niente attesa:
// prima che le impostazioni arrivino vale la build, che per la Tana è già
// la Tana.
export function useVenue() {
  const [settings, setSettings] = useState(settingsIniziali)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  return useMemo(() => venueDi(settings), [settings])
}
