---
category: Cassa
---

La card di un prodotto nella griglia della cassa — lo stesso mattone usato dal
POS (nuovo ordine) e dal dettaglio del bartender (modifica comanda).

Bassa e larga, **altezza fissa** in em: due righe di nome, il prezzo, i tastini
della quantità. L'altezza è fissa e non minima perché nelle griglie scrollabili
Chrome dimensiona le righe ignorando le altezze da testo, e i tastini finivano
fuori dal bordo. Lo spazio dei tastini è sempre riservato anche a quantità
zero: così la card non cambia altezza al tocco.

Tre segni, che sono la sua grammatica:

- **Segnalibro** in alto a sinistra, col colore della categoria: è il primo
  segno che si vede su una griglia piena, non un dettaglio da cercare.
- **Pallino con la quantità** in alto a sinistra sotto il segnalibro, quando il
  prodotto è nel conto.
- **Stella** in alto a destra, solo se passi `onToggleFav`.

## Props

| prop | tipo | |
|---|---|---|
| `drink` | `{ id, name, price }` | `price` in euro |
| `qty` | `number` | `> 0` accende la card e mostra i tastini |
| `onAdd` | `() => void` | tocco sulla card e tastino `+` |
| `onSetQty` | `(qty: number) => void` | tastino `−` |
| `color` | `string \| null` | colore della categoria: segnalibro e bordo sinistro |
| `favorite` | `boolean` | stella piena o vuota |
| `onToggleFav` | `() => void \| null` | senza, la stella non c'è proprio |
| `acceso` | `boolean` | la card che la ricerca sta indicando |

## Esempio

```jsx
<div className="pos-griglia">
  {prodotti.map((d) => (
    <DrinkTile
      key={d.id}
      drink={d}
      qty={carrello[d.id] ?? 0}
      color={coloreCategoria(d.category)}
      favorite={preferiti.has(d.id)}
      onToggleFav={() => cambiaPreferito(d.id)}
      onAdd={() => aggiungi(d)}
      onSetQty={(q) => imposta(d.id, q)}
    />
  ))}
</div>
```

La misura segue il `font-size` del contenitore: tutte le distanze interne sono
in em, quindi si stringe e si allarga cambiando una sola proprietà sulla griglia.
