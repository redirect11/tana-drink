---
category: Icone
---

Una persona — il conto intestato a un cliente.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconPersona />                       {/* 1.1em, segue il testo */}
<IconPersona size="1.4em" />          {/* dentro un tasto grosso */}
<IconPersona label="Una persona — il conto intestato a un cliente." />         {/* con etichetta: diventa role="img" */}
```
