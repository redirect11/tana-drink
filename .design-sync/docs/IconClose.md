---
category: Icone
---

Croce di chiusura — chiudere un pannello o un dialogo.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconClose />                       {/* 1.1em, segue il testo */}
<IconClose size="1.4em" />          {/* dentro un tasto grosso */}
<IconClose label="Croce di chiusura — chiudere un pannello o un dialogo." />         {/* con etichetta: diventa role="img" */}
```
