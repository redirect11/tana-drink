---
category: Navigazione
---

Un tasto che apre un pannello. Serve dove le scelte sono tante e stanno ferme
quasi sempre: i filtri del magazzino erano sette pastiglie sempre aperte, una
riga di schermo occupata tutto il giorno per una scelta che si cambia due volte
a sera.

Si chiude toccando fuori o con Esc. **Il tasto dice cosa è scelto adesso**: una
tendina che non lo dice costringe ad aprirla per ricordarselo — è questo il
senso di `riassunto`.

## Props

| prop | tipo | |
|---|---|---|
| `etichetta` | `string` | nome della tendina; finisce nel `title` e nell'etichetta accessibile |
| `riassunto` | `string` | cosa è scelto ora; se manca si mostra `etichetta` |
| `attivo` | `boolean` | accende il tasto: c'è un filtro in corso |
| `largo` | `number` | larghezza del pannello in px (`260`) |
| `classe` | `string` | classe in più sul contenitore |
| `children` | `ReactNode \| (chiudi) => ReactNode` | passando una funzione si riceve `chiudi` per richiudere dopo una scelta |

## Esempio

```jsx
<Tendina etichetta="Categoria" riassunto={cat ?? 'Tutte'} attivo={!!cat} largo={280}>
  {(chiudi) => (
    <div className="chips-row">
      {categorie.map((c) => (
        <button key={c} className="chip" onClick={() => { setCat(c); chiudi() }}>
          {c}
        </button>
      ))}
    </div>
  )}
</Tendina>
```
