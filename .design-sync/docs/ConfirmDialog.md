---
category: Dialoghi
---

La conferma dell'app, al posto di `window.confirm` — che nella PWA a tutto
schermo e in certi browser incorporati viene bloccato in silenzio, e chi sta al
banco non capisce perché il tasto non fa niente.

Overlay scuro a tutta schermata, riquadro al centro, due tasti: annulla a
sinistra (fantasma), conferma a destra. Toccare fuori dal riquadro annulla.

## Props

| prop | tipo | a cosa serve |
|---|---|---|
| `title` | `string` | il titolo, in serif |
| `message` | `string` | il testo; gli a capo si vedono (`white-space: pre-line`) |
| `confirmLabel` | `string` | scritta del tasto di conferma (`'Conferma'`) |
| `cancelLabel` | `string` | scritta del tasto di annullamento (`'Annulla'`) |
| `danger` | `boolean` | tinge di rosso il tasto di conferma: per le cose che non si tornano indietro |
| `onConfirm` | `() => void` | |
| `onCancel` | `() => void` | chiamata anche toccando fuori |

## Esempio

```jsx
<ConfirmDialog
  title="Svuotare il conto?"
  message={'Tolgo tutte le righe non ancora confermate.\nQuelle già mandate al banco restano.'}
  confirmLabel="Svuota"
  danger
  onConfirm={svuota}
  onCancel={() => setChiedi(false)}
/>
```

Il testo deve dire **cosa succede**, non "sei sicuro?": chi legge ha un vassoio
in mano e mezzo secondo per decidere.
