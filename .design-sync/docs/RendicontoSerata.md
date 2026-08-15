---
category: Rendiconto
---

La lettura completa di una cassa chiusa, in due viste sugli stessi ordini:

- **📋 Conti** — una riga per ordine: lordo, sconto, netto, costo, guadagno.
  Si apre e mostra i prodotti di quel conto.
- **📊 Cumulativo** — il venduto per prodotto, con le categorie a sinistra
  ([`CategoryRail`](../CategoryRail/CategoryRail.prompt.md)) come nelle altre
  schermate.

Tutte le cifre sono il venduto reale: **lo sconto è già ripartito sulle righe**
in proporzione al prezzo, così la somma delle quote fa esattamente lo sconto del
conto. Dove il costo di un ingrediente non è noto la riga è marcata: il
guadagno lì è ottimistico, e dirlo vale più che mostrare un numero pulito e
sbagliato.

Un conto chiuso senza incasso non è un dato mancante: o è stato **offerto** (🎁)
o è **da incassare** (🟡). Senza questa distinzione in tabella si legge un
trattino e sembra un errore.

## Props

| prop | tipo | |
|---|---|---|
| `session` | `{ opened_at, closed_at }` | l'intestazione mostra data, ora di apertura e di chiusura (o «in corso») |
| `orders` | `Order[]` | gli ordini della serata; gli annullati restano fuori dai conti, non sono stati venduti |
| `drinksById` | `Record<string, Drink>` | serve per la categoria e la ricetta di ogni riga |
| `itemsById` | `Record<string, Item>` | il magazzino: da qui esce il costo (`package_size`, `cost`, `vat`) |
| `recap` | `{ byMethod }` | quanto è entrato per metodo di pagamento |
| `onClose` | `() => void` | |

Il calcolo sta tutto in `src/lib/rendiconto.js` — logica pura, senza Firebase.

## Esempio

```jsx
<RendicontoSerata
  session={{ opened_at: '2026-08-14T19:30:00Z', closed_at: '2026-08-15T02:10:00Z' }}
  orders={ordiniDellaSerata}
  drinksById={drinks}
  itemsById={magazzino}
  recap={{ byMethod: { contanti: 240, carta: 512.5 } }}
  onClose={() => setRendiconto(null)}
/>
```
