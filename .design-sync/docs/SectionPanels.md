---
category: Navigazione
---

Le sottosezioni di una pagina, con una convenzione sola per tutto il
gestionale. Le cose che si fanno ogni tanto — le paghe orarie, un turno nuovo,
le categorie — finivano in fondo alla pagina come tasti «mostra/nascondi» tutti
diversi: per trovarle bisognava scorrere fino in basso sperando di
riconoscerle.

Qui stanno **sempre nello stesso posto**, subito sotto il titolo: una fila di
tasti; quello premuto apre il suo pannello lì sotto e si richiude premendolo di
nuovo o con la ✕. Uno alla volta — aprirne un altro chiude il precedente, così
la pagina non cresce a fisarmonica.

## Props

| prop | tipo | |
|---|---|---|
| `panels` | `{ id, label, title?, desc?, render }[]` | `label` e `title` sono nodi React, non solo testo: nei tasti ci va un'icona disegnata (`<IconSoldi />`), non un'emoji. I valori falsi si possono lasciare nell'array (voci condizionate al ruolo): vengono ignorati. Con l'array vuoto non disegna niente |
| `attivo` | `string \| null` | quale pannello è aperto, se lo comanda il genitore |
| `onChange` | `(id \| null) => void` | passandolo il componente diventa controllato; senza, si ricorda da sé |

`render` è chiamata **solo quando il pannello è aperto**: il contenuto pesante
non si monta finché non serve.

## Esempio

```jsx
<SectionPanels
  panels={[
    { id: 'paghe', label: <><IconSoldi /> Paghe orarie</>, title: 'Paghe orarie', render: () => <PagheManager /> },
    { id: 'turno', label: <><IconPiu /> Nuovo turno</>, title: 'Nuovo turno', desc: 'Aggiunge un turno a mano.', render: () => <ShiftForm /> },
    isAdmin(ruolo) && { id: 'cat', label: <><IconTag /> Categorie</>, title: 'Categorie', render: () => <Categorie /> },
  ]}
/>
```
