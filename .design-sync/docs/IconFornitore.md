---
category: Icone
---

Capannone — i fornitori.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconFornitore />                       {/* 1.1em, segue il testo */}
<IconFornitore size="1.4em" />          {/* dentro un tasto grosso */}
<IconFornitore label="Capannone — i fornitori." />         {/* con etichetta: diventa role="img" */}
```
