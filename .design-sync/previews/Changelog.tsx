import { Changelog } from 'karaoke-drink'

// Un pezzo vero di CHANGELOG.md: titolo di versione, sezione, elenco con
// grassetti, righe di continuazione rientrate e un po' di `codice`.
const NOTE = `## 1.4.1 — 14 agosto 2026

### Al banco

- **Le Impostazioni entrano tutte nella finestra**, senza scorrere la
  pagina: l'elenco delle sezioni e il contenuto **scorrono ognuno per
  conto suo**.
- **Anche le tile del POS hanno la striscia a sinistra**, come le card
  della coda e del menù: lo stesso oggetto si riconosce allo stesso modo
  in ogni schermata.
- **«Separa» ora separa davvero tutte le righe.** Nascevano tutte con lo
  stesso identificativo, e a schermo le righe si distinguono per quello.

### Sotto il cofano

- Il riordino della griglia lo fa \`dnd-kit\`, non più codice nostro.
`

export const NoteDiUnaVersione = () => <Changelog testo={NOTE} />

// Solo un elenco, senza intestazioni: è la forma che arriva dal box «Cosa è
// cambiato» quando la sezione è corta.
export const SoloElenco = () => (
  <Changelog
    testo={`- **Il conto non si perde più** uscendo dalla schermata.
- La campanella dice quante modifiche non sono ancora arrivate al server.`}
  />
)
