import { formatPrice } from '../lib/orderStatus.js'
import { qtyBtnStyle } from '../lib/posStyles.js'

// Mattoni condivisi dell'interfaccia POS (griglia prodotti stile SumUp):
// usati sia dalla cassa (PosPage, nuovo ordine) sia dal dettaglio ordine
// del bartender (OrderPosDetail, modifica comanda).

// ── Tile prodotto ────────────────────────────────────────────────────────

export function DrinkTile({ drink, qty, onAdd, onSetQty, color = null, favorite = false, onToggleFav = null }) {
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
        borderRadius: 12,
        padding: '8px 10px 6px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        position: 'relative',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        transition: 'border-color 0.12s, background 0.12s',
        // Altezza FISSA, non minHeight: nelle griglie scrollabili grandi
        // Chrome dimensiona le righe ignorando le altezze da testo (righe
        // inchiodate al min-height e tastini fuori dal bordo — misurato sul
        // deploy con DevTools Protocol). Con l'altezza fissa ogni riga è
        // esatta; il nome si adatta con il clamp a 2 righe qui sotto.
        // Bassa e larga (rettangolare): 2 righe di nome + prezzo + tastini.
        height: 104,
      }}
    >
      {/* Stella preferiti (angolo in alto a destra) */}
      {onToggleFav && (
        <button
          type="button"
          aria-label={favorite ? `Togli ${drink.name} dai preferiti` : `Aggiungi ${drink.name} ai preferiti`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFav()
          }}
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            lineHeight: 1,
            padding: 2,
            opacity: favorite ? 1 : 0.35,
            zIndex: 2,
          }}
        >
          {favorite ? '⭐' : '☆'}
        </button>
      )}

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
          top: 6,
          right: 6,
          background: 'var(--accent, #b47a3c)',
          color: '#fff',
          borderRadius: '50%',
          width: 21,
          height: 21,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '0.75rem',
          lineHeight: 1,
        }}>
          {qty}
        </div>
      )}

      {/* Nome prodotto: area flessibile con clamp a 2 righe (i nomi molto
          lunghi finiscono in ellissi, come sulle tile del POS SumUp). */}
      <div style={{
        fontWeight: 700,
        fontSize: '0.88rem',
        textAlign: 'center',
        lineHeight: 1.25,
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {drink.name}
        </span>
      </div>

      {/* Prezzo */}
      <div style={{ fontSize: '0.8rem', opacity: 0.75, flexShrink: 0, lineHeight: 1.1 }}>
        {formatPrice(drink.price)}
      </div>

      {/* Controllo quantità: lo spazio è SEMPRE riservato (nascosto se il
          prodotto non è nel carrello), così la tile non cambia altezza al
          tap e i tastini non escono mai dal bordo. */}
      <div
        onClick={(e) => e.stopPropagation()}
        aria-hidden={!inCart}
        style={{
          display: 'flex',
          gap: 5,
          alignItems: 'center',
          flexShrink: 0,
          visibility: inCart ? 'visible' : 'hidden',
        }}
      >
        <button
          aria-label="Riduci"
          onClick={() => onSetQty(qty - 1)}
          tabIndex={inCart ? 0 : -1}
          style={qtyBtnStyle}
        >
          −
        </button>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', minWidth: 18, textAlign: 'center' }}>{qty}</span>
        <button
          aria-label="Aumenta"
          onClick={onAdd}
          tabIndex={inCart ? 0 : -1}
          style={qtyBtnStyle}
        >
          +
        </button>
      </div>
    </div>
  )
}
