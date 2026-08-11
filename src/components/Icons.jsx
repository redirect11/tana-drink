// Icone SVG flat e monocromatiche (usano currentColor): sostituiscono gli
// emoji colorati nell'interfaccia POS. Le icone/pallini della LISTA CATEGORIE
// restano invece colorati (là servono a distinguere a colpo d'occhio).
// Dimensione in em, così seguono la scala del testo attorno.

function Svg({ children, size = '1.1em', label }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      style={{ flexShrink: 0, verticalAlign: '-0.15em' }}
    >
      {children}
    </svg>
  )
}

export const IconPencil = (p) => (
  <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>
)
export const IconPrinter = (p) => (
  <Svg {...p}><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" rx="1" /></Svg>
)
export const IconReceipt = (p) => (
  <Svg {...p}><path d="M5 3v18l2-1.2L9 21l2-1.2L13 21l2-1.2L17 21l2-1.2V3l-2 1.2L15 3l-2 1.2L11 3 9 4.2 7 3Z" /><path d="M8 8h8M8 12h8M8 16h5" /></Svg>
)
export const IconCard = (p) => (
  <Svg {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></Svg>
)
export const IconRefresh = (p) => (
  <Svg {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v5h-5" /></Svg>
)
export const IconX = (p) => (
  <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
)
export const IconCheck = (p) => (
  <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>
)
export const IconClose = (p) => (
  <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
)
// Gruppo di ordini: un tavolo di persone. (L'emoji 🏷 che c'era prima su
// Windows viene disegnato come un rettangolino storto e non diceva niente.)
export const IconGruppo = (p) => (
  <Svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
)
// Una persona sola: il gruppo intestato a un cliente registrato.
export const IconPersona = (p) => (
  <Svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Svg>
)

// ── Sottosezioni delle pagine (SectionPanels) ────────────────────────
// Emoji come 🏷 e 🗂 su Windows vengono disegnati come rettangolini storti:
// nella fila dei tasti sembravano immagini non caricate. Questi sono
// disegni veri, uguali su ogni sistema, e seguono il colore del testo.
export const IconTag = (p) => (
  <Svg {...p}><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" /></Svg>
)
export const IconCartelle = (p) => (
  <Svg {...p}><path d="M3 8V6a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v1" /><path d="M2 11a1 1 0 0 1 1-1h17a1 1 0 0 1 1 1.15l-1.1 7A1 1 0 0 1 18.9 19H4.1a1 1 0 0 1-1-.85L2 11Z" /></Svg>
)
export const IconFornitore = (p) => (
  <Svg {...p}><path d="M2 20h20" /><path d="M4 20V9l5 3V9l5 3V4h6v16" /><path d="M17 12h.01M17 16h.01" /></Svg>
)
export const IconGrafico = (p) => (
  <Svg {...p}><path d="M3 3v18h18" /><path d="M7 15l3-4 3 3 5-7" /></Svg>
)
export const IconPiu = (p) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
)
export const IconSoldi = (p) => (
  <Svg {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></Svg>
)
export const IconBuono = (p) => (
  <Svg {...p}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" /><path d="M14 6v12" /></Svg>
)
