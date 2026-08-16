---
category: Icone
---

Stampante — mandare la comanda alla stampante del banco.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconPrinter />                       {/* 1.1em, segue il testo */}
<IconPrinter size="1.4em" />          {/* dentro un tasto grosso */}
<IconPrinter label="Stampante — mandare la comanda alla stampante del banco." />         {/* con etichetta: diventa role="img" */}
```
