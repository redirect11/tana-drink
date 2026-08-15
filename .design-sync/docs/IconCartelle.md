---
category: Icone
---

Cartelle — sezioni e sottosezioni di una pagina.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconCartelle />                       {/* 1.1em, segue il testo */}
<IconCartelle size="1.4em" />          {/* dentro un tasto grosso */}
<IconCartelle label="Cartelle — sezioni e sottosezioni di una pagina." />         {/* con etichetta: diventa role="img" */}
```
