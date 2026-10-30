import { useEffect, useState } from 'react'

// IL DISEGNO DEL DRINK COME IMMAGINE GIÀ FATTA (REQ-MENU-021).
//
// I disegni (lib/illustrazioneDrink.js) sono SVG con filtri di rumore e
// sfocatura: l'acquerello. Fermi vanno benissimo; ma negli Special dello
// stile «Notte» il bicchiere cresce e ruota mentre si scorre, e il telefono
// rifaceva i filtri a ogni fotogramma. L'utente, 30/10/2026, sul prototipo:
// «lo scroll non è per niente fluido».
//
// Qui l'SVG si disegna UNA volta su una tela, e da lì in poi si usa la
// fotografia: spostarla e ingrandirla non costa niente. Finché la tela non è
// pronta, o dove non c'è (i test), si usa l'SVG com'è.
const cache = new Map()

export function useDisegnoRaster(url, lato = 640) {
  const [raster, setRaster] = useState(() => (url && cache.get(url)) || url)
  useEffect(() => {
    if (!url || !url.startsWith('data:image/svg')) {
      setRaster(url)
      return undefined
    }
    if (cache.has(url)) {
      setRaster(cache.get(url))
      return undefined
    }
    let vivo = true
    const img = new Image()
    img.onload = () => {
      try {
        const tela = document.createElement('canvas')
        tela.width = lato
        tela.height = lato
        const ctx = tela.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, lato, lato)
        tela.toBlob((b) => {
          if (!b) return
          const fatto = URL.createObjectURL(b)
          cache.set(url, fatto)
          if (vivo) setRaster(fatto)
        }, 'image/png')
      } catch {
        // Niente tela (o tela «sporca»): resta l'SVG.
      }
    }
    img.src = url
    return () => {
      vivo = false
    }
  }, [url, lato])
  return raster
}
