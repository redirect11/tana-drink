# Note per chi rifà il sync su claude.ai/design

## Il punto di partenza: qui non c'è una libreria

Tana Drink è un'**applicazione**, non un design system pubblicato:
`package.json` è `private` e non esporta niente, e `npm run build` produce il
sito. Il convertitore riceve quindi un ingresso scritto a mano,
`.design-sync/entry.jsx`, che ri-esporta per nome i componenti da pubblicare.
**Ogni componente nuovo va aggiunto lì e in `componentSrcMap`**, altrimenti o
non finisce nel bundle o finisce nella lista senza esistere.

Il comando è quello solito, con `--entry` che punta a quel file:

```sh
node .ds-sync/resync.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --entry ./.design-sync/entry.jsx --out ./ds-bundle
```

## Cosa resta fuori, e perché (non riprovarci senza leggere)

- **Tutto ciò che arriva a `src/lib/firebaseClient.js`** — BackupPanel,
  DrinkForm (via PriceSuggestion → api.js), PasswordChanger, PaymentPanel.
  Firebase si inizializza al caricamento del modulo: dentro un'anteprima senza
  configurazione l'inizializzazione salta e porta giù **l'intero bundle**, non
  solo la scheda di quel componente. Per controllare cosa tira dentro cosa
  basta seguire gli import: nessuno dei componenti sincronizzati arriva a
  `firebaseClient.js`.
- **VersionBadge e InfoTab** — leggono `__APP_VERSION__`, `__GIT_*`,
  `__BUILD_ID__`, che esistono solo nella build Vite. Fuori di lì VersionBadge
  ritorna `null` (scheda vuota per costruzione) e InfoTab disegna una tabella
  di trattini. Non è un difetto da aggiustare nell'anteprima: quei valori non
  esistono nemmeno nell'ambiente di disegno.

## Le tre trappole delle schede di anteprima (già pagate)

1. **La scheda nasce bianca.** Il modello della scheda scrive
   `body{background:#fff}` *dopo* il foglio di stile, quindi vince; ma
   `index.css` mette `color: var(--text)` (quasi bianco) sul body → testo
   invisibile. `AnteprimaProvider` (in `entry.jsx`) ridipinge il body con lo
   stesso fondo dell'app. Nei disegni veri non serve: là `styles.css` porta
   dentro tutto `index.css`, regola del body compresa.
2. **`position: fixed` è imprigionato nella cella.** Il modello mette
   `transform: translateZ(0)` su `.ds-single`/`.ds-cell` apposta (così un
   overlay non dilaga sulle schede vicine): l'overlay dei dialoghi si dimensiona
   sulla cella, e se la cella è bassa il dialogo esce dal bordo di sopra e
   **perde il titolo**. Per questo le anteprime dei dialoghi avvolgono il
   componente in un `<div style={{minHeight: 560}}>` (640 per
   CancelOrderDialog, che è più alto). Se si aggiunge un dialogo, si copia
   quello schema.
3. **`StatusBell floating` è nascosto di default.** Il CSS dice
   `body.fullbleed .status-bell-float { display: flex }`: senza quella classe
   l'anteprima resta vuota e sembra rotta. La preview aggiunge `fullbleed` al
   body in `useLayoutEffect`.

## Altre cose imparate

- **`showToast` va importato dal bundle** (`from 'karaoke-drink'`), non da
  `../../src/lib/toast.js`: importato dal sorgente nascerebbe una **seconda
  copia** dello store, e la pila non vedrebbe i messaggi. Per questo
  `entry.jsx` ri-esporta `showToast`/`toastSync`/`toastSuccess`/`toastError`/
  `dismissToast`.
- **Le props sono scritte a mano.** Il repo è JavaScript puro: senza `.d.ts` il
  convertitore emette `[key: string]: unknown`. I contratti veri stanno in
  `dtsPropsFor` nel config — vanno aggiornati insieme al componente, o l'agente
  di design userà l'API sbagliata ovunque.
- **I gruppi vengono dalle note.** Tutti i componenti stanno in
  `src/components/`, che il convertitore considera una cartella generica: il
  gruppo arriva dal `category:` in testa a `.design-sync/docs/<Nome>.md`.
- **Playwright: solo il pacchetto npm, non i browser.** Il controllo del render
  usa il Chrome già installato:
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright` dentro `.ds-sync/`, poi
  `DS_CHROMIUM_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"` e
  `NODE_PATH="$PWD/.ds-sync/node_modules"` davanti a validate e capture.
- **Emoji no, icone sì.** Nelle anteprime le etichette usano le `Icon*` del
  bundle: su Windows le emoji dell'interfaccia vengono disegnate come
  rettangolini storti (è la stessa ragione per cui `Icons.jsx` esiste).

## Avvisi noti (se ne compare uno non in questa lista, guardarlo)

Nessuno: l'ultima validazione è uscita pulita, 33/33 schede disegnate.

## Due cose viste nell'app, non nell'anteprima

Non riguardano il sync, ma sono emerse guardando i render e vale la pena
saperle:

- **`.toast` è definito due volte in `index.css`** (riga ~950 e riga ~4057). La
  prima definizione mette ogni toast in `position: fixed; left: 50%; bottom:
  90px`, e vince sul layout a pila di `.toast-stack`: **due messaggi insieme si
  sovrappongono** invece di impilarsi. Per questo l'anteprima ne mostra uno per
  scheda.
- **Nomi lunghi sbordano dalla tile del POS.** In `DrinkTile` il nome sta in un
  contenitore flex centrato senza `min-width: 0`: sotto i ~150px di colonna il
  testo esce dal bordo (a sinistra viene tagliato) invece di andare a capo o
  troncare.

## Rischi per il prossimo sync

- **`entry.jsx` e `componentSrcMap` si sfasano in silenzio.** Un componente
  rinominato o spostato in `src/components/` non rompe niente in modo rumoroso:
  sparisce dal bundle. Dopo un giro di rinomini, ricontrollare i due elenchi.
- **Le props in `dtsPropsFor` sono una copia a mano.** Se cambia la firma di un
  componente e nessuno tocca il config, il contratto pubblicato resta quello
  vecchio e nessun controllo se ne accorge.
- **Le anteprime sono legate al codice a monte.** I fixture di
  `RendicontoSerata` e `StoriaOrdineDialog` usano nomi di campo veri
  (`tempi_conto`, `cancel_message`, `payments[]`, `recipe_items`…): se cambia lo
  schema dei dati, quelle schede disegnano meno di quello che dicono, senza
  errori.
- **`NovitaDialog` mostra la strada di riserva.** Va a leggere `changelog.md`
  pubblicato con l'app; nell'ambiente di disegno quel file non c'è, quindi la
  scheda dice «le note non sono arrivate». È uno stato vero, ma non è quello
  normale.
- **`_ds_bundle.css` è tutto `src/index.css`** (144 KB) copiato: cresce insieme
  all'app. Non ci sono file di token separati — le variabili stanno nel `:root`
  dentro quel file, raggiungibile da `styles.css`.
