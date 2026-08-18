---
category: Dialoghi
---

Il menu delle azioni che sale dal basso. Sul telefono i tasti secondari di un
conto — unisci, gruppi, dati, annulla — occupavano più spazio delle righe
ordinate, che sono l'unica cosa che si guarda mentre si batte. Qui stanno
dietro a un tocco, con bersagli grossi: il pollice arriva in basso, non in cima
allo schermo.

Le voci disabilitate **restano visibili e spente**: farle sparire sposta tutte
le altre proprio mentre stai per premerle.

## Props

| prop | tipo | a cosa serve |
|---|---|---|
| `open` | `boolean` | chiuso non disegna niente |
| `onClose` | `() => void` | tocco fuori, tasto ✕, Esc |
| `titolo` | `string` | intestazione del pannello (`'Azioni'`) |
| `voci` | `Voce[]` | le azioni; i valori falsi nell'array vengono ignorati |

Una voce: `{ id, label, icon?, hint?, danger?, disabled?, tieniAperto?, onClick? }`.
Di norma il pannello **si chiude prima** di eseguire l'azione (quasi tutte
aprono un'altra schermata, e due pannelli sovrapposti confondono);
`tieniAperto` serve alle poche che restano lì.

## Esempio

```jsx
<ActionSheet
  open={azioniAperte}
  onClose={() => setAzioniAperte(false)}
  titolo="Conto #12 — Marta"
  voci={[
    { id: 'unisci', label: 'Unisci a un altro conto', icon: '🔗' },
    { id: 'gruppo', label: 'Metti in un gruppo', icon: '👥', hint: 'Tavolata di 6' },
    { id: 'storia', label: 'Storia del conto', icon: '🕘' },
    { id: 'annulla', label: 'Annulla il conto', icon: '✖️', danger: true },
  ]}
/>
```
