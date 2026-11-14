import { useEffect, useState } from 'react'
import { subscribeSettings, settingsIniziali } from './api.js'
import { menuVisibile, mieiOrdiniVisibili } from './licenza.js'

// IL MENÙ E «I MIEI ORDINI», PER LE PAGINE DEI CLIENTI (REQ-LIC-002). Le
// stesse due domande in ogni pagina che porta al menù o ai propri ordini:
// dalle impostazioni in cache, aggiornate da sole, senza attese.
export function useMenuCliente() {
  const [settings, setSettings] = useState(settingsIniziali)
  useEffect(() => subscribeSettings(setSettings, () => {}), [])
  return { menu: menuVisibile(settings), mieiOrdini: mieiOrdiniVisibili(settings) }
}
