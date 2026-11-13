import { useEffect, useState } from 'react'

// DICE SE UNA BARRA `position: sticky` SI È APPICCICATA IN CIMA. Serve alla
// fila delle categorie del menù (BUG-120): ferma nella pagina deve stare sul
// fondo della pagina, senza un colore suo, ma appena si appiccica sotto la
// barra in alto le card le scorrono sotto e le serve un fondo pieno. Il CSS
// da solo non sa distinguere le due cose.
//
// Si osserva un segnaposto alto zero messo subito prima della barra: quando
// esce dallo schermo sopra la linea a cui la barra si ferma, la barra è
// appiccicata. Uscire dal basso (la pagina non ci è ancora arrivata) non
// conta. Senza IntersectionObserver la barra resta come ferma.
//
// La linea a cui la barra si ferma è il fondo della barra in alto, misurato
// quando si comincia a osservare (BUG-130): a 64 px fissi la barra era già
// sotto la testata e risultava ancora «ferma». Senza barra in alto, 64.
//
// Il segnaposto si riceve con un ref a funzione, non con useRef: nel menù
// compare solo quando le categorie sono arrivate, dopo il primo disegno, e
// un effetto legato a un useRef lo avrebbe cercato una volta sola, quando
// ancora non c'era — la barra restava trasparente anche appiccicata.
const fondoDellaBarra = () => {
  const fondo = document.querySelector('.topbar')?.getBoundingClientRect().bottom
  return fondo > 0 ? Math.round(fondo) : 64
}

export function useIncollata(linea = null) {
  const [segnaposto, setSegnaposto] = useState(null)
  const [incollata, setIncollata] = useState(false)
  useEffect(() => {
    if (!segnaposto || typeof IntersectionObserver === 'undefined') return undefined
    const alto = linea ?? fondoDellaBarra()
    const oss = new IntersectionObserver(
      ([voce]) => setIncollata(!voce.isIntersecting && voce.boundingClientRect.top < alto + 1),
      { rootMargin: `-${alto + 1}px 0px 0px 0px`, threshold: 0 }
    )
    oss.observe(segnaposto)
    return () => oss.disconnect()
  }, [segnaposto, linea])
  return [setSegnaposto, incollata]
}
