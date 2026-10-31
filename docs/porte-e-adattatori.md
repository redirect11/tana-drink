# Le porte e gli adattatori: l'app che non sa dove gira

REQ-FLOTTA-021. Richiesta della regia (drink-regia, stesso id), 31/10/2026.
Qui c'è il lavoro **in tana-drink**. L'installazione on premise (immagine,
backend locale, backup, attivazione) la fa la regia ed è raccontata solo
per capire.

**A che punto è** (aggiornato a ogni pezzo):

| Pezzo | Stato |
|---|---|
| La configurazione letta all'avvio | **fatto** (31/10/2026): `src/porte/configurazione.js`, contratto qui sotto |
| Il test-guardia | **fatto** (31/10/2026): `tests/unit/confineFirebase.test.js`, 22 file ancora da passare alle porte |
| La porta dei dati | da fare: è il prossimo pezzo |
| Accesso, file, server, notifiche | da fare |
| L'ospite Firebase delle Functions, i trigger come dati | da fare |
| Test di contratto e permessi per ruolo | da fare, insieme alla porta dei dati |

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
  c'è qui, nella porta non entra.
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
