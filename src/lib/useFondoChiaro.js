import { useEffect, useState } from 'react'

// IL FONDO DEL TEMA È CHIARO? (REQ-MENU-018). Lo dice `data-luma` su
// <html>, che applyTheme (lib/themes.js) scrive a ogni cambio di tema. Le
// illustrazioni degli special hanno due versioni — tratto bianco sui temi
// scuri, tratto scuro sui chiari — e un'immagine non può leggere il colore
// del foglio di stile: lo legge questo, e si aggiorna se il tema cambia
// mentre la pagina è aperta.
const leggi = () => typeof document !== 'undefined' && document.documentElement.dataset.luma === 'light'

export function useFondoChiaro() {
  const [chiaro, setChiaro] = useState(leggi)
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined
    const o = new MutationObserver(() => setChiaro(leggi()))
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-luma'] })
    return () => o.disconnect()
  }, [])
  return chiaro
}
