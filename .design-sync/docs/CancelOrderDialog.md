---
category: Dialoghi
---

L'annullamento di un ordine visto dal banco: si sceglie la frase che leggerà il
cliente, si può aggiungere una motivazione e si decide se avvisarlo.

Tre casi, che cambiano titolo e avvertenza perché **il magazzino si comporta in
modo diverso**:

| `kind` | quando | scorte |
|---|---|---|
| `'ordine'` | il conto intero salta | le eventuali scorte usate tornano |
| `'preparazione'` | la comanda salta | le scorte usate tornano |
| `'non_ritirato'` | il drink è stato fatto e nessuno l'ha preso | le scorte **restano scalate** |

Con `service_mode: 'tavolo'` il terzo caso dice «non servito» invece di «non
ritirato».

## Props

| prop | tipo | |
|---|---|---|
| `order` | `{ daily_number, service_mode }` | serve il numero del giorno per il titolo |
| `kind` | `'ordine' \| 'preparazione' \| 'non_ritirato'` | |
| `defaultPhrase` | `'bancone' \| 'staff'` | frase preselezionata (`'bancone'`) |
| `onConfirm` | `({ phrase, message, notify }) => void` | `message` è `null` se lasciato vuoto |
| `onCancel` | `() => void` | |

## Esempio

```jsx
<CancelOrderDialog
  order={{ daily_number: 12, service_mode: 'bancone' }}
  kind="ordine"
  onConfirm={({ phrase, message, notify }) => annulla(phrase, message, notify)}
  onCancel={() => setAnnullo(null)}
/>
```
