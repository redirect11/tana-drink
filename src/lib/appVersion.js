/* global __BUILD_ID__ */
// Rilevamento nuova versione dell'app (PWA che resta aperta per giorni):
// confronta l'id di build compilato nell'app con version.json pubblicato
// dal deploy. Quando cambiano, l'app mostra il banner "Aggiorna".

// L'id di build viene iniettato da Vite (vite.config.js). In test/dev può
// non esserci: in quel caso il check è disattivato.
const CURRENT_BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : null

// C'è una build più recente di quella in esecuzione? (logica pura,
// testabile: la rete viene iniettata)
export async function checkForUpdate(fetchImpl, currentBuild = CURRENT_BUILD) {
  if (!currentBuild) return false
  try {
    const res = await fetchImpl(
      `${import.meta.env.BASE_URL || '/'}version.json?ts=${Date.now()}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return false
    const data = await res.json()
    return Boolean(data.build) && data.build !== currentBuild
  } catch {
    return false // offline o file assente: nessun falso allarme
  }
}

// Avvisa (una volta sola) quando una nuova versione è online: controlla
// subito, poi ogni 5 minuti e quando l'app torna in primo piano.
export function subscribeUpdateAvailable(cb) {
  let stopped = false
  let notified = false

  async function tick() {
    if (stopped || notified) return
    if (await checkForUpdate(fetch)) {
      notified = true
      cb()
    }
  }

  const interval = setInterval(tick, 5 * 60 * 1000)
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick()
  }
  document.addEventListener('visibilitychange', onVisible)
  tick()

  return () => {
    stopped = true
    clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
