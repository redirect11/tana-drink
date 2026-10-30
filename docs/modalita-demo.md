# La modalità demo

Scritto il 30/10/2026 dalla sessione della regia (drink-regia), su
richiesta dell'utente, per chi lavora qui. È la specifica di
REQ-FLOTTA-019, che ha lo stesso numero nei due registri: qui l'app,
nella regia la pubblicazione della demo.

## Il problema

La prima pagina del prodotto ha «Prova la demo», che apre
`https://drinkpos-demo.web.app`: l'app compilata con `CLIENTE=demo` su un
progetto Firebase vero. Così chiunque arrivi dal sito legge e scrive nel
database di quel progetto come in un locale. Per un link pubblico non va.

Le parole dell'utente: «il sito demo che si apre dalla home dovrebbe
essere in sola lettura sul backend e la sessione vive solo in locale.
Bisogna aggiungere dei dati di test e bisogna renderlo in qualche modo
sicuro».

## La decisione (30/10/2026)

**La modalità demo la decide la build `CLIENTE=demo`, non un interruttore.**
Non c'è un'impostazione, un ruolo o un super admin che la accenda o la
spenga: un locale vero non può diventare una demo, e la demo non può
smettere di esserlo. L'utente l'ha approvata così («sì va bene»).

## Cosa serve qui

### 1. La demo si accende solo dalla build

- La cartella `clienti/demo/` dice che è una demo, per esempio con
  `"demo": true` in `venue.json`. `pluginCliente.js` lo trasforma in una
  costante di compilazione (`define`, o `import.meta.env.VITE_DEMO`).
- **Non** si legge da Firestore, dall'URL, da `localStorage` o da una
  variabile che si possa cambiare a runtime.
- Il codice della demo (dati, finti servizi) entra solo con un `import()`
  dentro un ramo della costante. Così la build di un locale vero non lo
  contiene: si verifica cercando nel `dist/` della Tana.

### 2. I dati di prova

- Un locale **inventato** completo: menù con ricette e foto neutre,
  magazzino, conti aperti, ordini chiusi, uno storico di qualche settimana,
  cassa, personale fittizio.
- **Nessun dato della Tana**, nemmeno da `tana-drink-test`: nomi, email e
  ordini veri non devono finire in una pagina pubblica.
- Si possono riusare `scripts/seed.js` e i `scripts/mock-*.js`. Meglio un
  generatore con un seme fisso, così le schermate restano uguali da una
  build all'altra.
- Le date sono relative al giorno in cui si apre la demo: lo storico
  sembra sempre recente.

### 3. Niente rete verso il database

- In demo l'app inizializza Firestore e **spegne la rete prima di qualsiasi
  lettura o scrittura** (`disableNetwork`). Poi carica i dati di prova
  nella cache locale.
- Ci sono due modi per caricarli. Il primo è un *bundle* Firestore
  pubblicato come file statico e caricato con `loadBundle`. Il secondo
  scrive i dati di prova nella cache all'avvio. Scegliete voi, dopo aver
  visto come risponde l'app.
- Da lì l'app lavora sulla sua copia: le query leggono la cache e le
  scritture restano in coda nel browser senza partire mai.
- **Da verificare.** Senza rete, le scritture non vengono mai confermate:
  ogni `await` su `setDoc`, `updateDoc`, `addDoc` e `batch.commit()`
  resta in attesa per sempre, e `runTransaction` fallisce. L'app lavora
  già senza rete, quindi molto dovrebbe essere già gestito, ma ogni punto
  che aspetta la conferma va controllato. Lì la demo resterebbe ferma.

### 4. La sessione vive solo nel browser

- Quello che fa chi prova (ordini, modifiche al menù, chiusure di cassa)
  resta nel suo browser.
- Va bene la cache persistente: chi ricarica la pagina ritrova il suo
  lavoro.
- Serve un pulsante **«Ricomincia da capo»**, che svuota la cache e torna
  ai dati di prova.
- La rete non si riaccende mai: altrimenti la coda delle scritture
  partirebbe verso il server.

### 5. Niente servizi veri

- **Accesso.** Niente Firebase Auth. Una schermata d'ingresso fa scegliere
  il ruolo con cui provare: titolare, bartender, staff, cliente. L'utente
  e il ruolo sono finti e restano nel browser.
- **Functions** (callable, SumUp, notifiche push, Storage, stampante):
  in demo rispondono dei finti servizi con esiti di prova, senza chiamate.
- **Analytics e App Check**: spenti.
- **La licenza**: in demo tutti i moduli, decisi in locale. Niente
  `settings/bar.licenza` dal server.

### 6. Si vede che è una demo

- Una fascia sempre visibile, per esempio: «Demo con dati di prova: quello
  che fai resta in questo browser», con «Ricomincia da capo».
- Tono professionale, come il resto del prodotto.

### 7. I test

- Con la costante della demo, l'app spegne la rete prima di leggere o
  scrivere, e non chiama né Functions né Auth.
- Senza la costante, il codice della demo non c'è.
- Se c'è un test di integrazione nel browser, nessuna richiesta deve
  andare a `firestore.googleapis.com`, `identitytoolkit` o
  `cloudfunctions`.
- La CI compila già `CLIENTE=demo` a ogni push.

## Com'è fatta (30/10/2026)

Stato: **fatta**, nel ramo `feature/modalita-demo`. I pezzi:

| Dove | Cosa |
|---|---|
| `clienti/demo/venue.json` | `"demo": true`: l'unico posto che accende la demo |
| `clienti/pluginCliente.js` | lo trasforma nella costante `__DEMO__`, un letterale (`eDemo`) |
| `src/lib/firebaseClient.js` | nella demo: app col nome della sessione, rete spenta come prima operazione su Firestore, niente Auth, App Check ed emulatori, niente client diretto |
| `src/lib/scritture.js`, `confermaLocale.js` | nella demo le scritture si confermano dalla cache |
| `src/lib/letture.js` | nella demo `getDoc` risponde dalla cache, senza errori finti |
| `src/demo/sessione.js` | una cache per giornata; «Ricomincia da capo» passa alla successiva |
| `src/demo/accesso.js` | l'accesso finto: si sceglie il ruolo, i claim sono quelli veri |
| `src/demo/dati.js`, `bundle.js`, `avvio.js` | i dati di prova, generati nel browser e caricati come bundle prima della prima schermata |
| `src/demo/PortaDemo.jsx`, `demo.css` | la scelta del ruolo e la fascia |
| `scripts/controlla-build-senza-demo.mjs` | la CI controlla che il pacchetto della Tana non contenga la demo |

### Le scelte, e perché

- **Il bundle, generato nel browser.** Dei due modi proposti sopra si è
  scelto il bundle, ma non come file pubblicato: il bundle lo scrive
  l'app stessa all'avvio (`creaBundle`), con le date relative a oggi. Nella
  cache i dati arrivano come documenti «del server», non come migliaia di
  scritture in coda che non partiranno mai. Provato col vero SDK in un
  test (`tests/unit/bundleDemo.test.js`).
- **Una cache per sessione, invece di svuotarla.** `clearIndexedDbPersistence`
  funziona solo prima che Firestore parta, e qui parte appena caricato il
  modulo. La cache di Firestore prende il nome dell'app Firebase: la demo
  la apre con `demo-<giornata>-<n>`, e ricominciare vuol dire passare al
  numero dopo e ricaricare. Le cache vecchie si cancellano dopo.
- **Le scritture confermate dalla cache, e solo nella demo.** Il punto «da
  verificare» qui sopra era giusto: con la rete spenta l'app restava
  ferma in 68 punti, quasi tutti nel gestionale. Invece di toccarli uno per
  uno, le scritture passano da un modulo solo, che nella demo si risolve
  appena la scrittura è nella cache. Nei locali veri resta Firestore: la
  conferma del server serve a vedere un rifiuto vero. I punti dove questo
  pesa anche nei locali veri, al banco, stanno in BUG-123.
- **`getDoc` dalla cache.** A rete spenta `getDoc` su un documento che non
  esiste va in errore («the client is offline») anche quando la cache sa
  che non c'è; un ascolto invece risponde subito. Nella demo `getDoc` apre
  un ascolto e prende la prima risposta.
- **Il profilo leggero, sempre.** La demo non chiama Functions, Storage,
  SumUp, notifiche, Analytics: le schermate nascondono già quei tasti per i
  locali Free. La stampante è quella finta, che mostra lo scontrino.

### Come provarla

```sh
CLIENTE=demo VITE_PROFILO=leggero npm run build && npx vite preview
```

Non servono emulatori né variabili di Firebase. Provata così in Chrome il
30/10/2026: l'ordine di un cliente, la coda del titolare, il menù del
gestionale e «Ricomincia da capo», con zero richieste verso l'esterno.

## Cosa fa la regia (REQ-FLOTTA-019 di drink-regia)

In `.github/workflows/aggiorna-istanza.yml` della regia:

- **La build della demo va solo su `drinkpos-demo`, e `drinkpos-demo`
  riceve solo quella.** In tutti gli altri casi il workflow si ferma.
- **`drinkpos-demo` è sempre leggera**: niente Functions, Storage, segreti
  né Terraform. La build riceve `VITE_PROFILO=leggero`, quindi la demo deve
  funzionare col profilo leggero.
- **Il database di `drinkpos-demo` è chiuso a tutti**, in lettura e in
  scrittura (`infra/demo/firestore.rules`). Queste regole si pubblicano al
  posto di quelle dell'app. La demo quindi **non può contare su niente che
  stia nel database**.
- `drinkpos-demo` non si elimina dalla regia (REQ-FLOTTA-014).

## Il contratto

| Cosa | Valore |
|---|---|
| Cartella del cliente | `clienti/demo` |
| Progetto | `drinkpos-demo` |
| Profilo | `leggero` (`VITE_PROFILO`) |
| Database | chiuso a tutti: l'app non lo usa |
| Come si accende | solo dalla build (`clienti/demo`), mai a runtime |

## Come si pubblica una correzione

- **Il codice** segue il gitflow di questo repository, come sempre.
- **Per provarla** in locale bastano `CLIENTE=demo npm run dev` o
  `npm run build` con `preview`: la demo non usa il database, quindi
  non servono né emulatori né progetti.
- **Online** la pubblica la regia. La demo è registrata nella regia di
  produzione come locale esistente: progetto `drinkpos-demo`, cartella
  `demo`, aggiornamenti affidati alla regia. Quando una versione arriva su
  `main`, la demo la riceve con i rilasci o con «Aggiorna
  subito» dal backoffice.

**Attenzione all'ordine.** Finché la modalità demo non è su `main`, la
regia non deve aggiornare `drinkpos-demo`. Con il database chiuso, l'app di
oggi, che lo usa, non funzionerebbe.

## Cosa non fare

- Nessun interruttore della demo: niente impostazione, niente ruolo,
  niente parametro nell'URL.
- Nessun accesso per l'assistenza o super admin in questo lavoro. È un
  tema a parte, che si farà dopo la demo e insieme al contratto per il
  trattamento dei dati.
