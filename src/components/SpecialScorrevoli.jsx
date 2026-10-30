import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../lib/orderStatus.js'
import { immagineVoce } from '../lib/speciali.js'
import { ingredientiInCarta } from '../lib/ingredientiCarta.js'
import { COLORI } from '../lib/illustrazioneDrink.js'
import { useDisegnoRaster } from '../lib/useDisegnoRaster.js'

// ── GLI SPECIAL A SCORRIMENTO, STILE «NOTTE» (REQ-MENU-021) ─────────────
//
// L'utente, 30/10/2026: «mi piacciono le animazioni di scroll di Mùn
// rooftop. Possiamo usarle per scrollare gli item special, nel menu
// special». Una scena a tutto schermo per drink: scendendo, il bicchiere
// sale e cresce, il nome arriva lettera per lettera, poi descrizione,
// ingredienti e prezzo; andando avanti il bicchiere vola via. Il fondo prende
// il colore del drink (quello scelto per il disegno) e passa il testimone
// alla scena dopo. In fondo, tutti gli Special in righe grandi.
//
// PERCHÉ SCORRA LISCIO — sul prototipo non lo faceva: si muovono solo
// trasformazioni e opacità; i disegni sono immagini già fatte
// (useDisegnoRaster), non SVG con filtri da rifare a ogni fotogramma; il
// colore sta su un fondale fisso grande quanto lo schermo; niente sfocature
// dietro. GSAP si carica solo qui, e solo se il telefono non chiede «riduci
// movimento»: senza, le scene sono ferme e si leggono lo stesso.
//
// I tasti per ordinare sono quelli del menù (`tastiOrdine`), in ogni scena.
const TINTE = Object.fromEntries(COLORI.map((c) => [c.id, c.hex]))
const tintaDi = (d) => TINTE[d.illustrazione?.colore] || null

function Scena({ d, k, totale, chiaro, tasti }) {
  const img = useDisegnoRaster(immagineVoce(d, import.meta.env.BASE_URL, { chiaro }))
  const ingredienti = ingredientiInCarta(d)
  const tinta = tintaDi(d)
  return (
    <section
      className="notte-scena"
      id={`speciale-${d.id}`}
      data-k={k}
      aria-label={d.name}
      style={tinta ? { '--tinta': tinta } : undefined}
    >
      <div className="notte-palco">
        <div className="notte-disegno">
          <div className="notte-alone" aria-hidden="true" />
          {img && <img src={img} alt="" />}
        </div>
        <div className="notte-testo">
          <div className="notte-numero">
            {String(k + 1).padStart(2, '0')} / {String(totale).padStart(2, '0')}
          </div>
          <h2 className="notte-nome" aria-label={d.name}>
            {/* Lettere raggruppate per parola: la riga va a capo solo fra
                le parole, e le lettere arrivano una per volta. */}
            {d.name.split(' ').map((parola, j) => (
              <span key={j} aria-hidden="true">
                {j > 0 && ' '}
                <span className="notte-parola">
                  {[...parola].map((c, i) => (
                    <span key={i} className="notte-lettera">
                      {c}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </h2>
          {d.description && <p className="notte-descrizione">{d.description}</p>}
          {ingredienti && (
            <p className="notte-ingredienti">
              {ingredienti.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </p>
          )}
          <div className="notte-prezzo">{formatPrice(d.price)}</div>
          {tasti && <div className="notte-tasti">{tasti}</div>}
        </div>
      </div>
    </section>
  )
}

export default function SpecialScorrevoli({ voci, titolo, sottotitolo, linkMenu, chiaro = false, tastiOrdine }) {
  const radice = useRef(null)
  const [attiva, setAttiva] = useState(-1)

  // La scena al centro dello schermo dà il colore al fondale.
  useEffect(() => {
    const el = radice.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const oss = new IntersectionObserver(
      (righe) =>
        righe.forEach((r) => {
          if (!r.isIntersecting) return
          const k = r.target.dataset.k
          setAttiva(k == null ? -1 : Number(k))
        }),
      { rootMargin: '-45% 0px -45% 0px' }
    )
    el.querySelectorAll('.notte-scena, .notte-apertura, .notte-indice').forEach((x) => oss.observe(x))
    return () => oss.disconnect()
  }, [voci.length])

  // Il movimento legato allo scorrimento, con GSAP caricato a parte.
  useEffect(() => {
    const el = radice.current
    const ridotto = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!el || !ridotto || ridotto.matches) return undefined
    let contesto = null
    let vivo = true
    Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (!vivo) return
        gsap.registerPlugin(ScrollTrigger)
        // La barra del browser che compare e sparisce non ricalcola tutto.
        ScrollTrigger.config({ ignoreMobileResize: true })
        contesto = gsap.context(() => {
          gsap.to('.notte-apertura h2', {
            scale: 1.18,
            opacity: 0.15,
            ease: 'none',
            scrollTrigger: { trigger: '.notte-apertura', start: 'top top', end: 'bottom top', scrub: true },
          })
          gsap.fromTo(
            '.notte-nastro-riga',
            { xPercent: 0 },
            { xPercent: -40, ease: 'none', scrollTrigger: { trigger: '.notte-nastro', start: 'top bottom', end: 'bottom top', scrub: true } }
          )
          el.querySelectorAll('.notte-scena').forEach((s) => {
            const disegno = s.querySelector('.notte-disegno')
            const testo = s.querySelector('.notte-testo')
            gsap
              .timeline({ scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: 0.4 } })
              .fromTo(disegno, { yPercent: 40, scale: 0.72, rotate: -4, force3D: true }, { yPercent: 0, scale: 1, rotate: 0, ease: 'power2.out', duration: 0.35, force3D: true }, 0)
              .fromTo(s.querySelectorAll('.notte-lettera'), { yPercent: 70 }, { yPercent: 0, stagger: 0.012, ease: 'power3.out', duration: 0.2 }, 0.08)
              .fromTo(s.querySelector('.notte-nome'), { opacity: 0.25 }, { opacity: 1, duration: 0.2 }, 0.08)
              .fromTo(
                s.querySelectorAll('.notte-numero, .notte-descrizione, .notte-ingredienti, .notte-prezzo, .notte-tasti'),
                { y: 30, opacity: 0.25 },
                { y: 0, opacity: 1, stagger: 0.03, duration: 0.18 },
                0.14
              )
              .to(disegno, { yPercent: -55, scale: 0.62, rotate: 5, ease: 'power2.in', duration: 0.3, force3D: true }, 0.7)
              .to(testo, { y: -60, opacity: 0.1, duration: 0.25 }, 0.72)
          })
        }, el)
      })
      .catch(() => {
        // Senza GSAP le scene restano ferme: si leggono lo stesso.
      })
    return () => {
      vivo = false
      contesto?.revert()
    }
  }, [voci.length])

  const d = attiva >= 0 ? voci[attiva] : null
  const tinta = d ? tintaDi(d) : null
  const frase = `${titolo} ✦ ${sottotitolo || 'Special della casa'} ✦ `
  return (
    <div className="notte-special" ref={radice}>
      <div
        className="notte-fondale"
        aria-hidden="true"
        data-tinta={tinta || undefined}
        style={tinta ? { background: `color-mix(in srgb, ${tinta} 16%, var(--bg))` } : undefined}
      />
      <div className="notte-apertura">
        <div>
          <span className="notte-stella" aria-hidden="true">✦</span>
          <h2>{titolo}</h2>
          {sottotitolo && <p className="notte-tema">{sottotitolo}</p>}
          <Link className="notte-torna" to={linkMenu}>
            ← Tutto il menù
          </Link>
        </div>
      </div>
      <div className="notte-nastro" aria-hidden="true">
        <div className="notte-nastro-riga">{frase.repeat(4)}</div>
      </div>
      {voci.map((v, k) => (
        <Scena key={v.id} d={v} k={k} totale={voci.length} chiaro={chiaro} tasti={tastiOrdine?.(v)} />
      ))}
      <nav className="notte-indice" aria-label={`Tutti gli ${titolo}`}>
        <h2>Tutti gli {titolo}</h2>
        <ol>
          {voci.map((v, k) => (
            <li key={v.id}>
              <a href={`#speciale-${v.id}`} style={tintaDi(v) ? { '--tinta': tintaDi(v) } : undefined}>
                <span className="n">{String(k + 1).padStart(2, '0')}</span>
                <span className="t">{v.name}</span>
                <span className="p">{formatPrice(v.price)}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  )
}
