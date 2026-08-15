---
category: Icone
---

Più persone — un gruppo di conti, la tavolata.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconGruppo />                       {/* 1.1em, segue il testo */}
<IconGruppo size="1.4em" />          {/* dentro un tasto grosso */}
<IconGruppo label="Più persone — un gruppo di conti, la tavolata." />         {/* con etichetta: diventa role="img" */}
```
