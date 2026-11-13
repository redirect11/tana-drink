# La sicurezza della demo pubblica (REQ-SIC-005)

Richiesta della regia (drink-regia), 02/11/2026. Per chi lavora qui.

## Da dove viene

L'utente ha chiesto alla sessione della regia di «verificare la sicurezza
della demo», poi, letti i risultati: «dobbiamo risolvere anche tutte queste
cose». Un agente ha letto questo repository a `origin/release/1.10.x`
(51b0370, 1.10.8-beta). Ha compilato la Tana e la demo, e ha aperto la demo
in un Chrome isolato che bloccava e registrava ogni richiesta verso altri
indirizzi.

**Il disegno regge** (REQ-FLOTTA-019, `docs/modalita-demo.md`):
- nel pacchetto della Tana non c'è traccia della demo, e la demo non si
  accende a runtime;
- nella demo non è partita nessuna richiesta verso Firestore, Auth,
  Functions o Storage, nemmeno ricaricando con cinque scritture in coda;
- nei dati di prova non c'è niente di personale.

Restano i punti qui sotto.

## Già fatto nella regia

drink-regia [PR #69](https://github.com/redirect11/drink-regia/pull/69):
- il workflow non chiama `genera-cliente.mjs` se la cartella c'è già;
- la demo si riconosce dal segno `"demo": true` del `venue.json`;
- la build della demo ha una configurazione finta (`demo-drinkpos`) e
  nessun `VITE_REGIA_PROGETTO`;
- dopo la build si controlla il pacchetto: la demo dev'esserlo, e quello di
  un locale passa da `scripts/controlla-build-senza-demo.mjs dist`;
- Storage chiuso come il database;
- intestazioni di sicurezza su drinkpos-demo, compresa una CSP con
  `connect-src 'self'`;
- la regia non scrive alla demo licenza né dati del titolare.

Le correzioni qui sotto servono lo stesso: la regia mette una seconda
difesa, ma l'app non deve dipendere da lei.

## Da fare qui

### 1. `scripts/genera-cliente.mjs`: la cartella prima dello slug (alta)

Alla riga 20 la regex `^[a-z][a-z0-9-]{4,28}[a-z0-9]$` sullo slug viene
controllata **prima** di «la cartella esiste già». Con `--slug demo` o
`--slug tana` lo script esce con codice 1, e il workflow della regia si
fermava prima della build: per questo su drinkpos-demo è rimasta la
1.10.0-beta, un'app vera con la registrazione aperta.

- Va controllato prima se `clienti/<slug>/venue.json` esiste: in quel caso
  si accettano anche le cartelle curate a mano (`^[a-z][a-z0-9-]{1,29}$`).
- Un test con `--slug demo` e `--slug tana`.

### 2. Nella demo, la regia non si chiama (media)

Con un ruolo di staff la demo fa una
`POST https://europe-west1-drink-regia.cloudfunctions.net/presentazione`
con `Authorization: Bearer demo`. Il token è `'demo'` perché `getIdToken()`
dell'accesso finto restituisce quello. La chiamata riparte a ogni apertura:
la regia risponde 401 e la presentazione non si segna mai. Il marketplace fa
lo stesso con una `GET …/catalogoTemi`, e d'ora in poi anche coi moduli. Ogni
visitatore manda così l'IP e il browser alla regia di produzione, in una
pagina che promette che tutto resta nel browser.

- Le chiamate passano da `App.jsx:317-324` (`presentaSeServe`),
  `src/lib/presentazione.js`, `src/lib/api.js` (`chiamaRegia`) e
  `src/lib/marketplaceTemi.js`. Ora gli indirizzi stanno tutti in
  `funzioniRegia.js`.
- Con `__DEMO__`, ogni indirizzo della regia vale `null`, e
  `presentaSeServe` esce subito.
- Il marketplace nella demo mostra i suoi contenuti senza la regia, oppure
  dice che nella demo non si scarica niente.
- Un test sul pacchetto della demo: nessun `cloudfunctions.net`.

### 3. La configurazione finta e la rete che non si spegne (media)

- Nella demo, `src/porte/configurazione.js` (riga ~111) usa la
  configurazione della build, e fino a ieri la regia ci metteva quella vera
  di drinkpos-demo. Con `__DEMO__` deve valere una configurazione fissa e
  finta, qualunque cosa ci sia nel `.env`. Per esempio
  `projectId: 'demo-drinkpos'`: gli id `demo-*` non sono mai progetti veri.
- `src/lib/firebaseClient.js:122-124` fa `disableNetwork(db).catch(console.error)`.
  Se fallisce, l'app parte con la rete accesa. Nella demo, un errore deve
  fermare: `terminate(db)` e un messaggio, cioè il guasto chiude invece di
  aprire.

### 4. L'informativa privacy della Tana su ogni build (media)

`public/privacy-policy.html` e `public/cookie-policy.html` finiscono in ogni
build: `pluginCliente.js` sovrascrive solo i file di
`clienti/<slug>/public/`. Così sulla demo, e con ogni probabilità su ogni
locale della flotta, il titolare del trattamento risulta «EFFEVI S.R.L.S.
(«La Tana del Coniglio»), Corso Tommaso Vitale 87/89, Nola», con
`info@latanadelconiglio.it`.

- Servono pagine per cliente, generate dai dati del locale (nome,
  intestazione, email), con quelle della Tana solo in `clienti/tana`.
- Per la demo serve una pagina neutra: nessun dato raccolto, tutto resta
  nel browser.
- Un controllo in CI: le build che non sono della Tana non contengono
  `EFFEVI` né `latanadelconiglio`.

### 5. Le tracce della Tana nel pacchetto della demo (bassa)

Nella build della demo ci sono:
- nel chunk `avvio-*.js`, i nomi originali del seme («Il Coniglio», «White
  Rabbit», «Tana Sour», «Tana Detox»), anche se `dati.js` li rinomina prima
  di mostrarli;
- la tavolozza «🌑 Tana scura» in Aspetto;
- `drinks/coniglio.jpg` e le altre foto;
- il segnaposto con l'email di un fornitore vero,
  `ENOFEL;ordini@enofel.it` (`src/components/InventoryManager.jsx:1520`);
- `changelog.md`, che nomina la Tana.

Correzione: un catalogo solo della demo, un segnaposto neutro, e un
controllo sul `dist/` della demo (`Coniglio`, `Tana`, `enofel`, `EFFEVI`).

### 6. I link dei social (bassa nella demo, più seria nei locali)

`src/lib/venue.js:88-98` (`socialDaTesto`) accetta qualunque testo come
`href`, e `App.jsx:713` lo disegna in `<a href>` nel piede del cliente. Un
`javascript:` passa. Nella demo colpisce solo chi lo scrive. In un locale
vero `settings` è scrivibile dal bartender, quindi la vede chi apre il menù.
Vanno accettati solo `https:`, `http:`, `mailto:` e `tel:`, sia al
salvataggio sia nel disegno.

### 7. La stampante finta (bassa)

`src/lib/stampanteFinta.js:143-166` mette l'URL del logo in
`<img src="${logo}">` senza scapare le virgolette, in una finestra con
l'origine dell'app. Va scapato anche `"`, o il DOM va costruito con
`createElement`.

### 8. Il segno, non il nome (bassa)

- Un test: solo `clienti/demo` ha `"demo": true`.
- `index.html`: l'`onerror` in linea su `epos-2.27.0.js` è l'unico
  JavaScript in linea. Con la CSP della demo non gira: per la demo non
  serve, ma se un giorno la CSP va anche sui locali, conviene spostarlo in
  un file.

### 9. I browser di chi ha provato la demo vecchia (facoltativo)

Chi ha aperto la 1.10.0-beta ha ancora `firebaseLocalStorageDb`, con i
refresh token, e la cache `firestore/[DEFAULT]/drinkpos-demo/main`.
`butta()` di `src/demo/sessione.js:64-66` cancella solo le cache `demo-*`.
Nella demo si possono cancellare anche quelle due al primo avvio.

## Una nota sull'SDK di Firestore

Al riavvio, con scritture in coda, l'SDK prepara lo stream delle scritture
dentro la prima operazione, prima che `disableNetwork` abbia effetto. Nella
prova non è uscito niente: WebChannel apre la connessione solo al primo
messaggio. Ma regge su un dettaglio interno dell'SDK, non su un contratto.
La configurazione finta (punto 3) e la CSP della regia lo rendono
irrilevante.
