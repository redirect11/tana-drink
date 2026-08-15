---
category: Icone
---

Scontrino — il conto, la ricevuta.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconReceipt />                       {/* 1.1em, segue il testo */}
<IconReceipt size="1.4em" />          {/* dentro un tasto grosso */}
<IconReceipt label="Scontrino — il conto, la ricevuta." />         {/* con etichetta: diventa role="img" */}
```
