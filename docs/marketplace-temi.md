# Il marketplace dei temi (REQ-MENU-023)

Per la regia (drink-regia) e per chi lavora qui. 02/11/2026.

## La decisione dell'utente

> «Dobbiamo fare una sezione marketplace per i temi in aspetto. È una
> pagina che carica tutti i temi disponibili. Serve un posto dove
> pubblicarne di nuovi e trovare un modo per pubblicarne.»
>
> «Il tema quindi è composto da tavolozze e stile. Si possono
> vendere/uppare/scaricare/acquistare temi che miscelano tavolozze e stili.
> Per ora tutto gratis tra quelli che già abbiamo.»

Pubblica **solo il fornitore, dalla regia**. Un tema è **descrittivo**: una
ricetta, non codice.

**Dal 04/11/2026 a schermo il tema si chiama «veste»** (decisione
dell'utente) e può portare anche la **composizione del menù**: «il tema
diventa un mix di tavolozza colori, stile e stile carta». Nel contratto,
nel codice e nelle impostazioni dei locali i nomi restano quelli di prima
(`temi`, `temi_installati`, `tema_menu`): rinominarli vorrebbe dire
travasare quello che i locali hanno già scritto.

## Che cos'è un tema

```json
{
  "id": "grand-hotel",
  "nome": "Grand Hotel",
  "descrizione": "Anni Venti sul blu di mezzanotte: maiuscole sottili, cornici e oro.",
  "prezzo": 0,
  "tavolozza": {
    "base": "notte-blu",
    "colori": { "--accent-2": "#d4af37" }
  },
  "stile": "deco",
  "composizione": "sala"
}
```

- **`id`**: minuscole, cifre e trattini, da 2 a 41 caratteri. È la chiave:
  un tema della regia con lo stesso id di uno del catalogo iniziale lo
  sostituisce.
- **`nome`** (fino a 40 caratteri) e **`descrizione`** (fino a 240): si
  leggono nella scheda del marketplace. Il registro è quello del gestionale:
  impersonale e professionale.
- **`tavolozza.base`**: una delle tavolozze dell'app (`src/lib/themes.js`,
  `THEME_PRESETS`): `tana-scuro`, `notte-blu`, `catppuccin`,
  `catppuccin-chiaro`, `pico-scuro`, `pico-chiaro`, `chiaro`, `crema`.
  Porta anche le forme (angoli, bottoni, ombre).
- **`tavolozza.colori`**: facoltativo. Ridefinisce alcuni dei sette colori
  della base, come esadecimali `#rrggbb`: `--bg`, `--bg-2`, `--card`,
  `--accent`, `--accent-2`, `--text`, `--muted`. Gli altri si scartano.
- **`stile`**: uno degli stili del menù che l'app sa disegnare
  (`src/lib/stileMenu.js`): `classico`, `lavagna`, `deco`, `riviera`,
  `giornale`, e `notte`, che però è esclusivo della Tana (va solo in un tema
  per lei). Uno stile nuovo è un lavoro di disegno e arriva con una versione
  dell'app. Un'app più vecchia ignora i temi con uno stile che non conosce.
- **`composizione`**: facoltativa. Una delle composizioni del menù che
  l'app conosce (`src/lib/composizioneMenu.js`): `classica` (il catalogo del
  gestionale per categorie) o `sala` (la carta di sala, REQ-MENU-025). Senza,
  la veste lascia la composizione che il locale ha scelto. Un'app più
  vecchia, o una composizione che l'app non conosce, scartano la veste.
- **`prezzo`**: per ora sempre `0`. L'app non mostra i temi a pagamento
  finché non c'è «Compra» (REQ-LIC-011).

La fonte della verità è `leggiTema` in `src/lib/marketplaceTemi.js`: un tema
che quella funzione scarta, l'app non lo mostra.

## Il catalogo della regia

L'app lo legge all'apertura della pagina del marketplace, mai a tempo:

```
GET https://europe-west1-<VITE_REGIA_PROGETTO>.cloudfunctions.net/catalogoTemi
→ 200 { "temi": [ …temi pubblicati… ] }
```

- **Pubblico:** niente token. Lo legge anche la Tana, che alla regia non è
  collegata per la licenza.
- **CORS** aperto in GET, perché l'app lo legge dal dominio del locale.
- **Solo i temi pubblicati.** Un tema ritirato sparisce dal catalogo, ma
  resta nei locali che l'hanno installato: l'app ne tiene una copia.
- **`VITE_REGIA_PROGETTO`** è già nella build (REQ-FLOTTA-026):
  `drink-regia` in produzione, `drink-regia-test` sul test.
- **Senza risposta** l'app mostra l'ultimo catalogo che ha ricordato, più il
  suo catalogo iniziale.

## Da fare nella regia

1. **Il catalogo:** i temi, con lo stato *bozza*, *pubblicato* o *ritirato*,
   e la Function `catalogoTemi` qui sopra.
2. **Una pagina nel backoffice per pubblicare.** Si sceglie la base e lo
   stile, si ritoccano i colori, si scrivono nome e descrizione. L'anteprima
   è la tavolozza con un assaggio. Poi si pubblica o si ritira. Per vedere il
   tema sul menù vero si pubblica sul catalogo di test e lo si prova da un
   locale di test, con «Prova sul menù».
3. **La stessa validazione dell'app** prima di pubblicare: id, base, colori
   e stile come sopra. Un tema che l'app scarterebbe non va pubblicato.

## Nell'app (fatto)

- **Una pagina sua: «🛍️ Marketplace»** nel menu laterale, prima di
  Impostazioni, con le sezioni **Vesti**, **Stili del menù** (gli stili da
  soli, sui colori del locale), **Composizioni del menù**, **Installati** e
  **Moduli**. Ogni scheda ha una vetrina
  (un pezzo del menù vero coi colori e lo stile del tema), «Prova sul menù»,
  «Installa» e «Usa»; negli Installati, «Disinstalla».
- **Installare** salva una copia del tema nelle impostazioni del locale
  (`temi_installati`).
- **«Usa»** scrive la tavolozza nei colori del menù dei clienti
  (`theme_client`) e lo stile in `stile_menu`, installando lo stile se è uno
  di quelli gratis; se la veste ha una composizione, la mette in
  `composizione_menu` e la installa. I colori del gestionale non cambiano.
- **«Prova sul menù»** apre il menù del cliente con il tema
  (`?vista=cliente&tema=…`), solo per chi la apre.
- **Il catalogo iniziale**, tutto gratis: Classico, Lavagna, Grand Hotel,
  Riviera, Pastello, Gazzetta, Inchiostro, e Notte per la Tana.
- In Impostazioni restano la scelta fra gli stili installati e il
  collegamento «Apri il marketplace».
