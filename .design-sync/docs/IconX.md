---
category: Icone
---

Croce — togliere una riga.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconX />                       {/* 1.1em, segue il testo */}
<IconX size="1.4em" />          {/* dentro un tasto grosso */}
<IconX label="Croce — togliere una riga." />         {/* con etichetta: diventa role="img" */}
```
