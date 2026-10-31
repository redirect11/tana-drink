# Le porte e gli adattatori: l'app che non sa dove gira

REQ-FLOTTA-021. Richiesta della regia (drink-regia, stesso id), 31/10/2026.
Qui c'è il lavoro **in tana-drink**. L'installazione on premise (immagine,
backend locale, backup, attivazione) la fa la regia ed è raccontata solo
per capire.

**A che punto è** (aggiornato a ogni pezzo):

| Pezzo | Stato |
|---|---|
| La configurazione letta all'avvio | **fatto** (31/10/2026): `src/porte/configurazione.js`, contratto qui sotto |
| Il test-guardia | **fatto** (31/10/2026): `tests/unit/confineFirebase.test.js`; i file da passare alle porte erano 22, ora 16 |
| La porta dei dati | **fatta** (31/10/2026): `src/porte/dati.js`, adattatore in `src/adattatori/firebase/`; contratto qui sotto |
| Test di contratto e permessi per ruolo | **fatti** (31/10/2026): `tests/contratto/`, sull'emulatore con `npm run test:regole` |
| Accesso, file, server, notifiche | da fare: il prossimo è l'accesso, che tiene ancora dentro 9 dei 16 file |
| L'ospite Firebase delle Functions, i trigger come dati | da fare |

## Cosa ha deciso l'utente

> «on premise viene ospitato tutto il gestionale con backup su cloud»
>
> «tana-drink è sempre lo stesso ma dove si installa e come si configura è
> roba di regia»
>
> «possiamo prevedere delle interfacce che implementano le logiche di
> firebase o altre logiche con altri db e una interfaccia che parla con
> node o con le functions. Così possiamo riutilizzare tutto anche su cloud
> puro»

I livelli di installazione sono tre (docs/stampanti-e-livelli.md): cloud,
app, on premise. Nell'on premise **gira nel locale tutto il gestionale**, e
il cloud fa backup e consultazione da fuori. Firestore non si installa in
un server nostro. Gli emulatori di Firebase non vanno in produzione: i
token dell'emulatore di Auth non sono firmati, i comandi di
amministrazione non sono protetti, e i dati stanno in memoria. Quindi
nell'on premise ci sarà un altro backend, scelto dalla regia con un
prototipo (oggi la candidata è PocketBase con Litestream).

Perché questo non diventi un secondo prodotto, **l'app parla con delle
interfacce nostre (le porte)** e non più con Firebase. Dietro ogni porta
c'è un adattatore: oggi solo quello di Firebase, domani anche un altro.

## Cosa si chiede adesso (e cosa no)

**Sì**, due passi che non cambiano niente per chi usa l'app:

1. **Le porte, con il solo adattatore Firebase.** L'app passa alle porte
   un pezzo alla volta. La Tana, la demo e le istanze della regia devono
   lavorare **esattamente come oggi**.
2. **La logica del server come funzioni normali, con l'ospite Firebase.**
   Le Functions di oggi restano le stesse, viste da fuori.

**No, per ora**: il secondo adattatore, l'ospite Node e la scelta del
backend. Si fanno dopo il prototipo della regia, su porte già pronte.

## Da dove si parte (inventario del 31/10/2026, `develop` f310f64)

- **22 file di `src/` importano Firebase.** Fra i file in `src/lib/`:
  `api.js` (6.044 righe), `firebaseClient.js`, `scritture.js`, `letture.js`,
  `storage.js`, `push.js`, `customerAuth.js`, `staffApi.js`,
  `paymentsApi.js`, `progressivi.js`, `backup.js`, `analytics.js`,
  `logout.js`. Fuori da `src/lib/`: `App.jsx`, alcune pagine
  (`BartenderPage`, `ComandaPage`, `MenuPage`, `OrderStatusPage`,
  `StaffProfilePage`), `OrderPosDetail`, `demo/avvio.js` e
  `dev/devActions.js`.
- **Le chiamate a Firestore che l'app usa davvero**: `updateDoc` 74,
  `getDoc` 64, `where` 56, `query` 52, `serverTimestamp` 50, `setDoc` 45,
  `getDocs` 43, `onSnapshot` 33, `addDoc` 31, `increment` 27, `deleteDoc` 24,
  `orderBy` 13, `writeBatch` 9, `arrayUnion` 1, `documentId` 1. **Nessuna
  transazione.** È l'elenco da cui nasce la porta dei dati: quello che non
  c'è qui, nella porta non entra. *Rifatto il conto sugli import, al
  momento di fare la porta: ci sono anche `getDocFromCache`,
  `getDocsFromCache`, `limit`, `startAfter`, `deleteField`, `Timestamp` e
  il client diretto (BUG-117); `documentId` invece non si usa più.*
- **La demo ha già aperto la strada**: le scritture passano da
  `scritture.js` e la lettura di un documento da `letture.js`, e un test
  vieta di scavalcarle.
- **Le Functions sono 16**:
  - 9 `onCall`: `staffAdmin`, i pagamenti, il lettore SumUp;
  - 6 trigger di Firestore: le notifiche, `risolviNumeroDuplicato`,
    `autoAdvancePaid`;
  - 1 `onRequest`: il webhook di SumUp.

  In `functions/lib/` una parte è già separata (`payment-core`,
  `push-core`, `numerazione`).

## Le porte dell'app

Piccole: solo quello che serve all'app, con l'insieme qui sopra come
confine. Ogni porta ha un adattatore Firebase che fa quello che si fa oggi.

| Porta | Cosa offre | Adattatore Firebase |
|---|---|---|
| **configurazione** | i dati del backend e del locale, letti all'avvio | vedi sotto |
| **dati** | leggere un documento o una ricerca (`where`, `orderBy`, `limit`), ascoltarli in tempo reale, scrivere (`set`, `update`, `add`, `delete`), più scritture insieme, e tre valori speciali: l'ora del server, l'incremento, l'aggiunta a un elenco | Firestore, con la cache offline di oggi |
| **accesso** | entrare, uscire, chi sono, il mio ruolo, la password dimenticata | Firebase Auth, coi ruoli nei claim come oggi |
| **file** | caricare, leggere l'indirizzo, cancellare | Firebase Storage |
| **server** | `chiama(nome, dati)`: la logica del server per nome | `httpsCallable` |
| **notifiche** | iscriversi alle notifiche push, riceverle | FCM |

Analytics e App Check restano dentro l'adattatore Firebase: un altro
backend può non averli, e l'app non deve dipenderne.

**La cache offline per dispositivo** è un comportamento di Firestore su
cui l'app conta: le scritture in attesa, la conferma locale
(`confermaLocale.js`). La porta lo deve dire: «la scrittura è presa in
carico» e «la scrittura è arrivata al server» sono due cose distinte, e
l'app le usa già. Un altro adattatore dovrà fare lo stesso. Nell'on
premise è più facile, perché il server sta nella rete del locale.

### La porta dei dati, com'è fatta (31/10/2026)

Il contratto per esteso sta in testa a `src/porte/dati.js`; le prove in
`tests/contratto/dati.js`. In breve:

- **I nomi sono quelli di Firestore**, apposta. Le chiamate in `api.js`
  sono centinaia, e rinominarle non porterebbe niente. Conta il confine:
  la porta offre questo elenco e niente di più (`tests/unit/portaDati.test.js`
  lo tiene fermo), e un altro adattatore deve fare solo questo.
  - Riferimenti e ricerche: `collection`, `doc`, `query`, `where`,
    `orderBy`, `limit`, `startAfter`.
  - Letture: `getDoc`, `getDocs`, `getDocFromCache`, `getDocsFromCache`,
    `onSnapshot`.
  - Scritture: `setDoc` (anche con `merge`), `updateDoc`, `addDoc`,
    `deleteDoc`, `writeBatch`.
  - Valori speciali: `serverTimestamp`, `increment`, `arrayUnion`,
    `deleteField`.
  - Date: `Timestamp.fromDate`, `fromMillis`, `now`.
  - Fuori dal giro della serata: `cercaDalServer`.
  - Il database: `db`.
- **Cosa restituisce.**
  - Un documento letto ha `id`, `ref`, `exists()` e `data()`. Una ricerca
    ha `docs`, `empty`, `size` e `forEach`.
  - Una data letta ha `toDate()` e `toMillis()`, e l'app la riconosce da
    quelli, non dalla classe.
  - L'ascolto risponde subito con quello che il dispositivo sa, poi a ogni
    cambio, e restituisce la funzione per smettere.
- **Presa in carico e arrivata.** Una scrittura è presa in carico
  nell'istante della chiamata: letture e ascolti successivi, su quel
  dispositivo, la vedono già, anche senza rete. Finché il server non
  conferma, l'ora del server vale `null`. La promessa dice quando la
  scrittura è arrivata. Se il server la rifiuta, la promessa fallisce e il
  dispositivo torna a quello che c'era. Il lotto è tutto o niente.
- **`cercaDalServer(collezione, { dove, ordina })`.** È il client diretto
  di BUG-117, descritto con dati semplici invece che coi vincoli di
  Firestore. Senza rete fallisce, e chi chiama ripiega su `getDocs`.
- **Dove sta Firebase.**
  - In `src/adattatori/firebase/`: `dati.js` (con i due rami della demo
    che prima stavano in `scritture.js` e `letture.js`), `diretto.js` e
    `confermaLocale.js`.
  - `api.js`, il backup, i progressivi e gli attrezzi di sviluppo non
    importano più Firebase.
  - `customerAuth.js` passa dalla porta per i dati, ma resta nell'elenco
    per l'accesso.
  - `demo/avvio.js` resta nell'elenco: carica i dati di prova nella cache
    di Firestore, ed è un pezzo della demo, non della porta.
- **Le prove sull'emulatore** (`npm run test:regole`, insieme a quelle
  delle regole):
  - `tests/regole/contrattoDati.test.js` fa girare la serie della porta
    sull'adattatore Firebase. Le regole sono le più semplici possibili,
    perché si prova la porta e non i permessi;
  - `tests/regole/permessi.test.js` fa girare la tabella
    `tests/contratto/permessi.js` contro `firestore.rules`: 30 collezioni
    (fra cui `aggiornamenti`, chiusa a tutti da quando la scelta è una
    chiamata alla regia), più i documenti propri di `customers` e
    `presenze`, per i cinque ruoli e le quattro operazioni. I casi con
    condizioni sui campi (ordini, gruppi, chiamate, contatori) restano nei
    loro test.
  - La CI non le fa girare: vogliono l'emulatore.

## La configurazione letta all'avvio

Oggi il backend sta nelle `VITE_FIREBASE_*`, fissate nella build di ogni
locale. Per l'on premise serve **un'immagine sola per tutti i locali**,
dove la regia scrive i dati del locale al momento dell'installazione.
Quindi:

- l'app legge all'avvio un file servito accanto a lei (es.
  `/configurazione.json`): il tipo di backend, i suoi indirizzi, lo slug
  del locale;
- **senza il file**, l'app usa le `VITE_*` della build, come oggi. La Tana
  e le istanze della regia non cambiano finché la regia non lo pubblica;
- il file non entra nella cache della PWA in modo da restare vecchio: un
  cambio della regia si vede al riavvio;
- la demo resta decisa dalla build (`__DEMO__`), mai dal file.

### Il contratto, com'è fatto (31/10/2026)

Il file, servito accanto all'app (`<base>/configurazione.json`):

```json
{
  "backend": "firebase",
  "locale": "bar-mario",
  "firebase": {
    "apiKey": "…", "authDomain": "…", "projectId": "…",
    "storageBucket": "…", "messagingSenderId": "…", "appId": "…",
    "measurementId": "…", "recaptchaSiteKey": "…", "vapidKey": "…"
  }
}
```

- **Obbligatori** `backend`, `firebase.apiKey` e `firebase.projectId`. Il
  `backend` deve essere uno di quelli che l'app ha: oggi solo `firebase`.
  Un file con un altro backend, o senza i due campi, **si ignora** (e lo
  si dice in console). Vale la build. Gli altri campi sono facoltativi;
  quelli che l'app non conosce non entrano. Il campo `locale` vuoto prende
  lo slug della build.
- **Nessuno aspetta il file.** Il client di Firebase nasce sincrono, e un
  avvio che aspetta la rete al banco è un'app ferma. All'avvio vale
  l'ultima configurazione letta, salvata nel dispositivo; la prima volta
  vale la build. Il file si chiede in sottofondo:
  - se dice una cosa diversa da quella in uso **nei primi 10 secondi**
    dall'apertura, l'app si ricarica una volta. È la prima accensione di
    un dispositivo nell'on premise, dove la build non ha backend;
  - se la risposta arriva più tardi, l'app non si ricarica sotto le mani
    di chi lavora: la configurazione nuova vale dall'apertura dopo.
- **Le risposte**:
  - un 404, o una risposta che non è JSON, vuol dire che il file **non
    c'è**. L'hosting, per un indirizzo che non esiste, risponde con la
    pagina dell'app. In quel caso si torna alla build;
  - un errore del server, o la rete che manca, non dice niente: si tiene
    quello che si sa;
  - una build **senza** backend, cioè l'immagine on premise, non
    dimentica l'ultimo file buono per una risposta storta.
- **Le cache.** L'hosting lo serve `no-cache`. Il service worker non lo
  tocca: senza rete la richiesta fallisce invece di rispondere con una
  copia vecchia.
- **Chi lo legge**: il client di Firebase (progetto e App Check), le
  notifiche push (`vapidKey`), Analytics (`measurementId`), il backup
  (il progetto scritto nel file) e Impostazioni → Informazioni. Gli
  emulatori restano decisi dalla build.

## Il server: funzioni normali e due ospiti

Ogni Function diventa una funzione normale che riceve quello che le serve:
la porta dei dati lato server, i segreti, chi chiama e con che ruolo.
Restituisce il risultato. Non importa `firebase-functions`.

- **L'ospite Firebase** (`functions/index.js`) resta il solo per ora: per
  ogni funzione, l'`onCall`, il trigger o l'`onRequest` che la esegue, come
  oggi. Anche la regia è fatta così: la logica sta in `functions/lib/` e
  `index.js` collega soltanto.
- **I trigger si dichiarano come dati**, per esempio «alla creazione di
  `orders/{id}`, `notifyNewOrder`». L'ospite Firebase li traduce in
  `onDocumentCreated`; un domani l'ospite Node li legherà ai ganci del suo
  database.

## Le difese

- **Un test-guardia**: fuori dagli adattatori nessun file importa
  `firebase/*` o `firebase-functions`. Come quello della demo, l'elenco
  delle eccezioni si può solo accorciare.
- **Test di contratto**: una serie di test scritta sulle porte, non su
  Firebase. Gira sull'adattatore Firebase con gli emulatori. Il giorno del
  secondo adattatore, la stessa serie gira anche su quello.
- **I permessi per ruolo** (titolare, bartender, sala, cliente, anonimo)
  scritti come casi uguali per ogni backend. Oggi provano `firestore.rules`;
  domani le regole dell'altro backend, così le due non divergono.

## Quando è fatto

- **Niente di diverso per chi usa l'app.** La Tana, la demo e le istanze
  della regia lavorano come prima: stesse build, stessi deploy, stesse
  Functions viste da fuori.
- **Le porte e l'ospite Firebase coi loro test.** Il test-guardia passa
  senza eccezioni nuove; i test di contratto e quelli dei permessi girano
  sugli emulatori.
- **La configurazione letta all'avvio, con la riserva sulle `VITE_*`.**
- **Il contratto scritto qui**: l'elenco delle porte e delle loro
  operazioni, perché la regia e il secondo adattatore lo leggano.

Il lavoro è grosso: conviene a pezzi, una porta alla volta, ognuno col suo
rilascio. Si comincia dalla configurazione e dai dati, che sono quasi
tutto.

## Lato regia (per capire, non da fare qui)

REQ-FLOTTA-021 della regia: l'immagine on premise preparata e aggiornata
dalla regia, il backend locale scelto col prototipo, il backup continuo
sul progetto cloud del locale, l'attivazione col codice del locale, il nome
nella rete del locale col certificato, licenza e aggiornamenti dalla regia
(REQ-FLOTTA-020). La stessa immagine potrà girare anche su una macchina
virtuale di un altro fornitore (il «cloud puro»).
