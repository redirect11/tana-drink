---
category: Impostazioni
---

Disegna le note di rilascio. È in comune fra la scheda Informazioni e il box
che compare dopo un aggiornamento, così le stesse note si leggono allo stesso
modo nei due posti.

Il changelog è scritto in Markdown, ma qui non serve una libreria: sono titoli,
elenchi e qualche grassetto — meglio venti righe che un pacchetto. Riconosce:

- `## …` → il numero di versione (titolo in serif)
- `### …` → la sezione dentro la versione
- `- …` → voce di elenco; le righe rientrate sotto continuano la voce precedente
- `**grassetto**` e `` `codice` `` dentro qualunque riga
- `# …`, `---` e `>` vengono saltati: sono l'intestazione del file, non note

## Props

| prop | tipo | |
|---|---|---|
| `testo` | `string` | il Markdown, già ritagliato sulla sezione da mostrare |

## Esempio

```jsx
import { sezioneChangelog } from './lib/novita.js'

<Changelog testo={sezioneChangelog(markdown)} />   {/* solo la sezione più recente */}
```
