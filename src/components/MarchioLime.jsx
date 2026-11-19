import { NOME_CORTO_PRODOTTO, QUALIFICA_PRODOTTO } from '../lib/prodotto.js'

// ── IL MARCHIO DEL PRODOTTO (REQ-UI-035) ─────────────────────────────────
// Daniele, 17/11/2026: il marchio LIME - SmartOrders sta in cima al menu
// laterale del gestionale, al posto di «Gestionale». In alto nelle pagine
// c'è il locale, col suo logo e il suo nome; solo la demo e i locali Free
// hanno lì il marchio (limiti.js, marchioDelProdottoInAlto).
//
// IL LOGO È QUELLO DELLA REGIA, copiato com'è da drink-regia
// `src/components/Logo.jsx` (e `public/favicon.svg`): una fetta di lime che
// sembra un grafico a torta, decisione del 09/11/2026. È una copia tenuta
// allineata a mano (REQ-DEV-025): se la regia lo cambia, si cambia qui.
// Il nome e la qualifica come nella barra della regia: «Lime» e, piccolo in
// maiuscolo, «SmartOrders». Il logo è decorativo: il nome lo dice il testo.
// La misura la dà il CSS (`:is(.brand, .brand-mini) .marchio-lime-logo`). La stessa fetta è il
// logo della demo (clienti/demo/public/favicon.svg): una prova le confronta.
function LogoLime() {
  return (
    <svg
      className="marchio-lime-logo"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="15" fill="#5aa21f" />
      <circle cx="16" cy="16" r="12.6" fill="#dff0a5" />
      <g stroke="#fbfdf2" strokeWidth="1.3" strokeLinecap="round">
        <line x1="16" y1="16" x2="16" y2="3.6" />
        <line x1="16" y1="16" x2="24.77" y2="7.23" />
        <line x1="16" y1="16" x2="28.4" y2="16" />
        <line x1="16" y1="16" x2="24.77" y2="24.77" />
        <line x1="16" y1="16" x2="16" y2="28.4" />
        <line x1="16" y1="16" x2="7.23" y2="24.77" />
        <line x1="16" y1="16" x2="3.6" y2="16" />
        <line x1="16" y1="16" x2="7.23" y2="7.23" />
      </g>
      <path
        d="M17.2 14.8 L17.2 2.2 A13.8 13.8 0 0 1 29.8 14.8 Z"
        fill="#8cc63f"
        stroke="#fbfdf2"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function MarchioLime() {
  return (
    <span className="marchio-lime">
      <LogoLime />
      <span className="brand-nome marchio-lime-nome">
        {NOME_CORTO_PRODOTTO} <span className="marchio-lime-qualifica">{QUALIFICA_PRODOTTO}</span>
      </span>
    </span>
  )
}
