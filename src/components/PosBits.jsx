import { formatPrice } from '../lib/orderStatus.js'
import { qtyBtnStyle } from '../lib/posStyles.js'

// Mattoni condivisi dell'interfaccia POS (griglia prodotti stile SumUp):
// usati sia dalla cassa (PosPage, nuovo ordine) sia dal dettaglio ordine
// del bartender (OrderPosDetail, modifica comanda).

// ── Tile prodotto ────────────────────────────────────────────────────────

export function DrinkTile({
  drink,
  qty,
  onAdd,
  onSetQty,
  color = null,
  favorite = false,
  onToggleFav = null,
  acceso = false, // acceso dalla ricerca: è la card che si sta cercando
}) {
  const inCart = qty > 0

  return (
    <div
      onClick={onAdd}
      // Serve alla ricerca per ritrovare la card e portarcisi sopra.
      data-drink-id={drink.id}
      className={`pos-tile-striscia${acceso ? ' prodotto-acceso' : ''}`}
      style={{
        background: inCart
          ? 'rgba(var(--accent-rgb, 180, 120, 60), 0.18)'
          : 'var(--tile-bg)',
        border: inCart
          ? '2px solid rgba(var(--accent-rgb, 180, 120, 60), 0.7)'
          : '1px solid var(--line)',
        // La striscia a sinistra col colore del prodotto: lo stesso segno
        // delle card della coda e del menù (il CSS la ispessisce).
        borderLeftColor: color || 'var(--line)',
        borderRadius: 12,
        padding: '0.5em 0.62em 0.38em',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25em',
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
        // In em: scala col font-size della griglia (larghezza colonna centrale).
        height: '6.5em',
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
            fontSize: '0.95em',
            lineHeight: 1,
            padding: 2,
            opacity: favorite ? 1 : 0.35,
            zIndex: 2,
          }}
        >
          {favorite ? '★' : '☆'}
        </button>
      )}

      {/* SEGNALIBRO colorato della categoria (come sulle tile di SumUp POS).
          Era una linguetta da 1em: a colpo d'occhio, su una griglia piena, non
          si distingueva. Ora è quasi il doppio — deve essere il primo segno
          che si vede, non un dettaglio da cercare. */}
      {color && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            // in em: il segnalibro scala con la dimensione della card
            borderTop: `1.9em solid ${color}`,
            borderRight: '1.9em solid transparent',
            borderTopLeftRadius: 14,
          }}
        />
      )}

      {/* Badge quantità: in ALTO A SINISTRA (non copre la stella dei
          preferiti). Sta sotto il segnalibro, che ora è più grande: se si
          sovrapponessero, il numero degli ordinati sarebbe illeggibile
          proprio sulle card che si stanno usando. */}
      {inCart && (
        <div style={{
          position: 'absolute',
          top: '1.5em',
          left: '0.55em',
          background: 'var(--accent, #b47a3c)',
          color: '#fff',
          borderRadius: '50%',
          width: '1.3em',
          height: '1.3em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '0.75em',
          lineHeight: 1,
        }}>
          {qty}
        </div>
      )}

      {/* Nome prodotto: area flessibile con clamp a 2 righe (i nomi molto
          lunghi finiscono in ellissi, come sulle tile del POS SumUp). */}
      <div style={{
        fontWeight: 700,
        fontSize: '0.88em',
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
      <div style={{ fontSize: '0.8em', opacity: 0.75, flexShrink: 0, lineHeight: 1.1 }}>
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
        <span style={{ fontWeight: 700, fontSize: '0.95em', minWidth: '1.1em', textAlign: 'center' }}>{qty}</span>
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
