---
category: Dialoghi
---

La storia di un conto: cos'è successo, quando e per mano di chi. Un conto «in
corso» con dentro un incasso, guardato un'ora dopo, è solo un mistero — e i
misteri, a fine serata, diventano una cassa che non torna.

Non è un campo nuovo da riempire: gli eventi si ricostruiscono da quello che il
conto ha già addosso (tempi di stato, incassi, dati dell'annullo), quindi vale
anche per i conti di ieri. Ogni riga ha il suo segno: 🟢 aperto, 💶 chiuso,
✖️ annullato, ♻️ riaperto. Senza eventi il dialogo lo dice a parole, non resta
vuoto.

## Props

| prop | tipo | |
|---|---|---|
| `order` | l'ordine intero | gli eventi si ricavano da qui (`src/lib/storiaOrdine.js`) |
| `onClose` | `() => void` | tocco fuori o ✕ |

## Esempio

```jsx
{storiaAperta && <StoriaOrdineDialog order={ordine} onClose={() => setStoriaAperta(false)} />}
```

Va insieme a [`RipristinaOrdineDialog`](../RipristinaOrdineDialog/RipristinaOrdineDialog.prompt.md):
uno racconta, l'altro riapre.
