---
category: Icone
---

Banconota — incassi e cassa.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconSoldi />                       {/* 1.1em, segue il testo */}
<IconSoldi size="1.4em" />          {/* dentro un tasto grosso */}
<IconSoldi label="Banconota — incassi e cassa." />         {/* con etichetta: diventa role="img" */}
```
