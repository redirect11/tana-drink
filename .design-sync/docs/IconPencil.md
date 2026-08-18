---
category: Icone
---

Matita — modificare una riga, un prodotto, una scheda.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconPencil />                       {/* 1.1em, segue il testo */}
<IconPencil size="1.4em" />          {/* dentro un tasto grosso */}
<IconPencil label="Matita — modificare una riga, un prodotto, una scheda." />         {/* con etichetta: diventa role="img" */}
```
