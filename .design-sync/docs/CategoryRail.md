---
category: Navigazione
---

Categorie a sinistra, contenuto a destra: lo schema del POS riusato nel
gestionale (Inventario, Menù, Impostazioni), così girare per sezioni si fa
sempre allo stesso modo. Su schermo stretto la barra passa sopra il contenuto,
orizzontale e scorrevole.

**La barra non sparisce, si stringe.** C'è stato un tasto per farla sparire del
tutto: si perdeva l'unico modo di girare fra le sezioni. Stretta resta solo
l'icona, il nome torna sfiorandola col mouse — e sta nel `title`, per chi usa le
dita. La scelta stretta/larga si ricorda per pagina, nella chiave passata in
`chiave`.

## Props

| prop | tipo | |
|---|---|---|
| `items` | `{ key, label, count?, color?, icon? }[]` | col `color` la voce porta il pallino della categoria, lo stesso del POS |
| `selected` | `string` | la `key` attiva |
| `onSelect` | `(key) => void` | |
| `children` | `ReactNode` | il pannello di destra |
| `pieno` | `boolean` | barra e contenuto stanno **tutti** nello schermo e scorrono per conto loro: serve dove le voci sono tante, altrimenti per arrivare all'ultima si scorre la pagina intera e la barra sparisce proprio mentre la si usa |
| `chiave` | `string` | dove ricordare stretta/larga (`'cat'`) |
| `scorre` | `boolean` | `false` quando il contenuto ha già il suo scorrimento: due barre una dentro l'altra sono un modo per non trovare più niente |

## Esempio

```jsx
<CategoryRail
  items={[
    { key: 'cocktail', label: 'Cocktail', count: 24, color: '#e52e71' },
    { key: 'birre', label: 'Birre', count: 9, color: '#f5b94a' },
    { key: 'analcolici', label: 'Analcolici', count: 6, color: '#2ecc71' },
  ]}
  selected={cat}
  onSelect={setCat}
  chiave="inventario"
  pieno
>
  <ListaProdotti categoria={cat} />
</CategoryRail>
```
