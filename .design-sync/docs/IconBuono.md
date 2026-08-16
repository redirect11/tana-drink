---
category: Icone
---

Biglietto — un buono o un omaggio.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconBuono />                       {/* 1.1em, segue il testo */}
<IconBuono size="1.4em" />          {/* dentro un tasto grosso */}
<IconBuono label="Biglietto — un buono o un omaggio." />         {/* con etichetta: diventa role="img" */}
```
