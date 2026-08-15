---
category: Impostazioni
---

La sezione «Aspetto» delle impostazioni: due temi, scelti da preset o
personalizzati colore per colore.

I due temi **non si applicano per indirizzo, seguono chi guarda**: chi è dello
staff vede il tema del gestionale su ogni schermata — il proprio profilo, la
lista ordini, il menù per gli ordini manuali; chi ordina vede il suo. Per
questo le etichette dicono a chi tocca cosa: da soli, «Gestionale» e «Vista
cliente» sembravano due pagine.

Il tema del gestionale ha l'anteprima immediata (si applica mentre lo scegli):
è la vista in cui ci si trova. Quello cliente no — per provarlo si passa da
menu ▸ Vista cliente.

## Props

| prop | tipo | |
|---|---|---|
| `settings` | `{ theme_staff, theme_client }` | ognuno `{ preset, custom }`; `custom` sono gli scostamenti di colore sul preset, `null` se non ce ne sono |
| `onSave` | `(patch) => void` | riceve `{ theme_staff }` o `{ theme_client }`, mai tutti e due |

I preset, i campi colore e la risoluzione in variabili CSS stanno in
`src/lib/themes.js`.

## Esempio

```jsx
<ThemeSettings
  settings={settings}
  onSave={(patch) => salvaImpostazioni(patch)}   // parte in sottofondo, non si aspetta
/>
```
