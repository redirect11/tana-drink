---
category: Stato
---

La pila delle notifiche in app: in basso a destra, sopra qualsiasi schermata
(POS a tutto schermo compreso), si tocca per chiudere. Piccole e poco invasive:
non fermano quello che si sta facendo.

Non prende props. Si monta **una volta sola**, in alto nell'albero, e si iscrive
allo store di `src/lib/toast.js`. I messaggi si mandano da qualunque punto del
codice, anche fuori da React:

```js
import { showToast, toastSync, toastSuccess, toastError } from './lib/toast.js'

const id = toastSync('Sincronizzo gli ordini…')   // spinner, resta finché non lo aggiorni
toastSuccess('Fatto', { id })                     // stesso id: lo trasforma
toastError('Il banco non risponde')               // 8 secondi
showToast('Nuovo ordine al tavolo 4')             // info, 4 secondi
```

Quattro tipi, ognuno col suo segno: `info` 🔔, `sync` (girella), `success` ✅,
`error` ⚠️. Con `duration: 0` il messaggio resta finché non viene aggiornato o
chiuso — è quello che serve alle cose in corso e agli errori seri.

Lo store vive a livello di modulo, quindi **sopravvive al cambio pagina**: una
sincronizzazione lanciata dal POS resta visibile in coda.

## Esempio

```jsx
export default function App() {
  return (
    <>
      <Rotte />
      <Toasts />
    </>
  )
}
```
