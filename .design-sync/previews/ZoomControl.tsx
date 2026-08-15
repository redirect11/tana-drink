import { ZoomControl } from 'karaoke-drink'

// In linea: sta dov'è scritto, dentro una testata che non scala col contenuto.
export const InLinea = () => (
  <div
    className="row between"
    style={{
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      background: 'var(--card)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 'var(--radius)',
    }}
  >
    <strong>Conto #12 — Marta</strong>
    <ZoomControl inline />
  </div>
)

// Flottante (predefinito): i tasti stanno FUORI da #root, in un portale sul
// body, altrimenti si rimpicciolirebbero insieme alla pagina che stanno
// scalando. Nell'anteprima compaiono nell'angolo in basso a sinistra.
export const Flottante = () => (
  <div style={{ minHeight: 160 }}>
    <p className="muted small" style={{ margin: 0 }}>
      I due tasti galleggiano in basso a sinistra: sono fuori dalla pagina che
      scalano, quindi non si rimpiccioliscono con lei.
    </p>
    <ZoomControl />
  </div>
)
