import { formatPrice } from '../lib/orderStatus.js'
import { qtyBtnStyle } from '../lib/posStyles.js'

// Mattoni condivisi dell'interfaccia POS (griglia prodotti stile SumUp):
// usati sia dalla cassa (PosPage, nuovo ordine) sia dal dettaglio ordine
// del bartender (OrderPosDetail, modifica comanda).

// ── Tile prodotto ────────────────────────────────────────────────────────

export function DrinkTile({ drink, qty, onAdd, onSetQty, color = null }) {
  const inCart = qty > 0

  return (
    <div
      onClick={onAdd}
      style={{
        background: inCart
          ? 'rgba(var(--accent-rgb, 180, 120, 60), 0.18)'
          : 'var(--tile-bg)',
        border: inCart
          ? '2px solid rgba(var(--accent-rgb, 180, 120, 60), 0.7)'
          : '1px solid var(--line)',
        borderRadius: 14,
        padding: '14px 10px 10px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        transition: 'border-color 0.12s, background 0.12s',
        minHeight: 100,
      }}
    >
      {/* Angolo colorato per categoria (come le tile di SumUp POS) */}
      {color && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            borderTop: `16px solid ${color}`,
            borderRight: '16px solid transparent',
            borderTopLeftRadius: 14,
          }}
        />
      )}

      {/* Badge quantità */}
      {inCart && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'var(--accent, #b47a3c)',
          color: '#fff',
          borderRadius: '50%',
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '0.85rem',
          lineHeight: 1,
        }}>
          {qty}
        </div>
      )}

      {/* Nome prodotto */}
      <div style={{
        fontWeight: 700,
        fontSize: '0.9rem',
        textAlign: 'center',
        lineHeight: 1.3,
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {drink.name}
      </div>

      {/* Prezzo */}
      <div style={{ fontSize: '0.85rem', opacity: 0.75 }}>
        {formatPrice(drink.price)}
      </div>

      {/* Controllo quantità (visibile solo se nel carrello) */}
      {inCart && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}
        >
          <button
            aria-label="Riduci"
            onClick={() => onSetQty(qty - 1)}
            style={qtyBtnStyle}
          >
            −
          </button>
          <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>{qty}</span>
          <button
            aria-label="Aumenta"
            onClick={onAdd}
            style={qtyBtnStyle}
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}
