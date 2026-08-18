---
category: Dialoghi
---

«Cosa è cambiato», una volta sola dopo un aggiornamento. Si tocca «Nuova
versione disponibile», la pagina si ricarica e ci si ritrova qualcosa spostato
di posto senza sapere perché: le note ci sono sempre state (Impostazioni →
Informazioni) ma nessuno va a cercarle, quindi si portano davanti da sole.

Legge da sé `changelog.md` pubblicato insieme all'app e ne mostra **la sezione
più in alto** — non quella del numero di versione che l'app si porta dietro, che
sull'ambiente di test è vecchio. Se il file non arriva, lo dice e rimanda alle
Informazioni invece di restare vuoto.

## Props

| prop | tipo | |
|---|---|---|
| `onClose` | `() => void` | tocco fuori, ✕, oppure «Ho capito» |

## Esempio

```jsx
{daMostrare && <NovitaDialog onClose={() => segnaVista()} />}
```

Il corpo delle note è disegnato da [`Changelog`](../Changelog/Changelog.prompt.md).
