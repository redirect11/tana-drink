---
category: Stato
---

Lo zoom della pagina: due tasti, `−` e `+`, con in mezzo il livello — che è
anche il tasto per tornare al 100%, altrimenti per rimettere le cose a posto
bisognerebbe contare i tocchi. Da 70% a 160%, a passi di 10.

Serve perché l'app gira su schermi molto diversi (iPad al banco, telefono in
sala, monitor in ufficio) e nella PWA a tutto schermo **il browser il suo zoom
non lo offre**: senza questo non c'è modo di cambiarlo.

Come, e perché così: scala `#root` con la proprietà `zoom` e non con
`transform`, perché `zoom` rifà il layout invece di deformare un'immagine —
testo e tasti restano nitidi e le aree toccabili seguono. Il livello finisce
anche in `--zoom` sul documento, così le schermate a tutta altezza possono
dividere i loro `100dvh` e non sbordare da ingrandite. Il valore si ricorda in
`localStorage`.

## Props

| prop | tipo | |
|---|---|---|
| `inline` | `boolean` | `false` (predefinito): i tasti stanno **fuori da `#root`**, in un portale sul `body`, altrimenti si rimpicciolirebbero insieme alla pagina proprio mentre servono a chi non ci vede bene. `true`: gli stessi tasti dentro la pagina, per il telefono, dove l'angolo in basso a sinistra è già occupato dai tasti del conto |

## Esempio

```jsx
<ZoomControl />                 {/* flottante, in basso a sinistra */}
<ZoomControl inline />          {/* in testata, di fianco allo stato del conto */}
```
