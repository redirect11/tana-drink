---
category: Icone
---

Etichetta — la categoria di un prodotto.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconTag />                       {/* 1.1em, segue il testo */}
<IconTag size="1.4em" />          {/* dentro un tasto grosso */}
<IconTag label="Etichetta — la categoria di un prodotto." />         {/* con etichetta: diventa role="img" */}
```
