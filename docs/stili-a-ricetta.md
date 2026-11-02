# Gli stili a ricetta (REQ-MENU-024)

Richiesta della regia (drink-regia REQ-FLOTTA-034), 02/11/2026. La parte
della regia è pronta: [drink-regia PR #53](https://github.com/redirect11/drink-regia/pull/53).

## Le decisioni dell'utente

> «Anche gli stili, non limitarti a quelli che abbiamo integrato. Creane di
> nuovi. In qualche modo dobbiamo poter caricare anche gli stili.»

Delle due strade (uno stile a ricetta, o un CSS caricato dalla regia)
l'utente ha scelto **lo stile a ricetta**, e **una scelta ampia di caratteri
dentro l'app**. Resta valida la regola del marketplace: un tema, e ora uno
stile, è una ricetta, non codice. Non può rompere il menù e funziona senza
rete.

## Cos'è

Oggi ogni stile del menù è CSS scritto nell'app (`.stile-deco`,
`.stile-riviera`… in `src/index.css`). Ma i quattro gratis variano tutti
lungo le stesse dimensioni: i tre caratteri (`--stile-titolo`,
`--stile-voce`, `--stile-testo`), la voce a card o in riga «nome … prezzo»,
i separatori, le immagini, le intestazioni, lo sfondo. Uno **stile a
ricetta** è una scelta fra valori fissi su ognuna di queste dimensioni, e
l'app lo disegna con **un motore unico**: un insieme di regole CSS dentro
l'app che legge la ricetta (per esempio da attributi `data-*` sul contenitore
del menù, o da variabili CSS). Ogni valore del vocabolario ha la sua regola
nell'app: la regia sceglie, l'app disegna.

## La ricetta, versione 1

```json
{
  "id": "osteria",
  "nome": "Osteria",
  "descrizione": "La carta dell’osteria: …",
  "prezzo": 0,
  "ricetta": {
    "versione": 1,
    "caratteri": { "titolo": "libre-baskerville", "voce": "libre-baskerville", "testo": "georgia" },
    "titoli": { "maiuscolo": false, "corsivo": true, "allineamento": "centro", "dimensione": "grande", "spaziatura": "normale" },
    "intestazione": "fregio",
    "voce": { "forma": "riga", "prezzo": "puntini", "separatore": "nessuno", "immagine": "nascosta" },
    "cornice": "doppia",
    "angoli": "vivi",
    "sfondo": "carta",
    "colori": { "--bg": "#…" }
  }
}
```

La regia manda **sempre la ricetta completa**, con ogni campo, e l'ha già
controllata. L'app la ricontrolla comunque (`leggiStile`, come `leggiTema`):
uno stile con un valore che non conosce non si mostra.

| Campo | Valori (il primo è quello di partenza) | Cosa vuol dire |
|---|---|---|
| `caratteri.titolo`, `.voce`, `.testo` | vedi sotto | I tre caratteri: titoli e intestazioni, nome della voce, il resto |
| `titoli.maiuscolo` | `false`, `true` | Titoli e intestazioni in maiuscolo |
| `titoli.corsivo` | `false`, `true` | In corsivo |
| `titoli.allineamento` | `sinistra`, `centro` | |
| `titoli.dimensione` | `normale`, `grande`, `enorme` | Come oggi Classico, Riviera, Lavagna |
| `titoli.spaziatura` | `normale`, `stretta`, `larga` | Spazio fra le lettere |
| `intestazione` | `nessuna`, `filetto`, `doppio-filetto`, `tratteggio`, `punti`, `fregio` | Sotto il nome della categoria |
| `voce.forma` | `card`, `riga`, `colonna` | La card di oggi; la riga «nome … prezzo» di Lavagna, Déco, Giornale; il nome sopra e la descrizione sotto, a tutta larghezza |
| `voce.prezzo` | `accanto`, `sotto`, `puntini` | Accanto al nome, sotto, o con i puntini fino al prezzo |
| `voce.separatore` | `nessuno`, `filetto`, `tratteggio`, `punti` | Fra una voce e l'altra |
| `voce.immagine` | `tonda`, `quadrata`, `nascosta` | La foto del prodotto |
| `cornice` | `nessuna`, `sottile`, `doppia`, `angoli` | Attorno al menù |
| `angoli` | `morbidi`, `vivi`, `tondi` | Delle card e dei bottoni |
| `sfondo` | `tinta`, `grana`, `carta`, `gesso`, `righe`, `quadretti` | Tinta unita del tema, o una trama disegnata in CSS sopra il colore del tema |
| `colori` | facoltativo, le sette chiavi `#rrggbb` | Colori propri dello stile, sopra quelli del tema (come la Lavagna) |

Sul telefono valgono le stesse eccezioni di oggi: il prezzo sotto il nome
nella forma `riga`, sotto i 520 px.

## I caratteri

I sei di oggi più dodici nuovi, tutti a licenza libera, **dentro la build**
come quelli di oggi (REQ-SIC-004, niente richieste a servizi esterni):

| id | Carattere | Per cosa |
|---|---|---|
| `caveat` | Caveat | c'è già |
| `poiret-one` | Poiret One | c'è già |
| `jost` | Jost | c'è già |
| `dancing-script` | Dancing Script | c'è già |
| `playfair-display` | Playfair Display | c'è già |
| `georgia` | Georgia (di sistema) | c'è già |
| `cormorant-garamond` | Cormorant Garamond | serif leggero ed elegante |
| `libre-baskerville` | Libre Baskerville | serif classico da carta |
| `dm-serif-display` | DM Serif Display | serif da titolo |
| `abril-fatface` | Abril Fatface | titoli molto marcati |
| `bebas-neue` | Bebas Neue | maiuscole condensate |
| `oswald` | Oswald | sans condensato |
| `inter` | Inter | sans da testo |
| `space-grotesk` | Space Grotesk | sans geometrico |
| `josefin-sans` | Josefin Sans | sans geometrico d'epoca |
| `pacifico` | Pacifico | corsivo rotondo |
| `amatic-sc` | Amatic SC | stampatello a mano |
| `special-elite` | Special Elite | macchina da scrivere |

Un carattere in più arriva con una versione dell'app, e allora si aggiunge
anche in `CARATTERI` di `functions/lib/stili.js` della regia.

## Dal catalogo

La risposta di `catalogoTemi` diventa:

```
200 { "temi": [ … ], "stili": [ { id, nome, descrizione, prezzo: 0, ricetta } ] }
```

- Gli **stili** si uniscono a `STILI_MENU`: si provano, si installano e si
  usano come quelli gratis di oggi (`gratis: true`), con l'assaggio nelle
  Impostazioni disegnato dal motore.
- Un **tema** può avere come `stile` l'id di uno stile a ricetta:
  `leggiTema` lo accetta se quello stile è nel catalogo letto (o già
  installato). Un'app che non ha ancora il motore lo scarta, come oggi uno
  stile sconosciuto: si può pubblicare prima.
- **Installato**, uno stile se ne porta una copia nelle impostazioni del
  locale (come `temi_installati`): se la regia lo ritira, resta a chi l'ha.
- Gli id non coprono mai quelli scritti nell'app (`classico`, `notte`,
  `lavagna`, `deco`, `riviera`, `giornale`): la regia li rifiuta.

## Gli stili e i temi che la regia ha già pronti

Sette stili (Osteria, Bauhaus, Tiki, Quaderno, Dattilo, Insegna, Giardino)
e sette temi che li usano (Trattoria, Laguna, Appunti, Prima visione,
Telegramma, Officina, Glicine), in `functions/temi/stili.json` e
`functions/temi/catalogo.json` della regia. Sono una buona prova del motore:
insieme usano quasi tutti i valori del vocabolario.

## Da fare qui

- `leggiStile`, gemella di `leggiTema`, con il vocabolario qui sopra.
- Il motore: le regole CSS per ogni valore, sopra il menù classico, come
  oggi gli stili gratis.
- I dodici caratteri nuovi nella build.
- Gli stili del catalogo uniti a `STILI_MENU`, con la copia all'installazione.
- `leggiTema` che accetta uno stile a ricetta conosciuto.
- I test: ogni valore del vocabolario ha la sua regola; una ricetta con un
  valore sconosciuto si scarta; i sette stili della regia si disegnano.
