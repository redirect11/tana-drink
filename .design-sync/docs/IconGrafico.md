---
category: Icone
---

Grafico — statistiche e andamento.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconGrafico />                       {/* 1.1em, segue il testo */}
<IconGrafico size="1.4em" />          {/* dentro un tasto grosso */}
<IconGrafico label="Grafico — statistiche e andamento." />         {/* con etichetta: diventa role="img" */}
```
