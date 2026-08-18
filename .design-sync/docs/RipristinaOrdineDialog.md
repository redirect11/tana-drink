---
category: Dialoghi
---

Rimette in corso un conto chiuso o annullato. Dice **prima** cosa comporta,
perché le due strade sono diverse: un conto annullato torna con le comande da
fare (e il magazzino si scala quando le si prepara); un conto chiuso torna
aperto ma gli incassi già registrati restano dove sono, e il dovuto si
ricalcola da sé.

La motivazione è **facoltativa apposta**: obbligatoria, si scriverebbe «x» per
passare oltre, e in cambio si perderebbero i secondi che al banco non ci sono.
Ma la si chiede, perché è quello che fra un'ora spiegherà un conto riaperto a
chi non c'era.

## Props

| prop | tipo | |
|---|---|---|
| `order` | `{ daily_number, customer_name?, status }` | `status: 'annullato'` cambia l'avvertenza |
| `onConferma` | `(motivo: string \| null) => void` | `null` se il campo è vuoto |
| `onClose` | `() => void` | |

Dopo la conferma i due tasti si spengono: il ripristino parte in sottofondo e
non si deve poter premere due volte.

## Esempio

```jsx
<RipristinaOrdineDialog
  order={{ daily_number: 12, customer_name: 'Marta', status: 'pagato' }}
  onConferma={(motivo) => riapri(ordine.id, motivo)}
  onClose={() => setRipristino(null)}
/>
```
