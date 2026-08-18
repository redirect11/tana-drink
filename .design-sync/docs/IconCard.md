---
category: Icone
---

Carta — il pagamento con carta.

Disegno SVG monocromatico: segue `currentColor`, quindi prende il colore del
testo attorno, e `size` è in em, quindi scala con la riga in cui sta. Sostituisce
un'emoji: su Windows le emoji dell'interfaccia venivano disegnate come
rettangolini storti e sembravano immagini non caricate.

```jsx
<IconCard />                       {/* 1.1em, segue il testo */}
<IconCard size="1.4em" />          {/* dentro un tasto grosso */}
<IconCard label="Carta — il pagamento con carta." />         {/* con etichetta: diventa role="img" */}
```
