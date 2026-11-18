# La flotta: un codice, un progetto Firebase per locale, una regia che vende

Questo documento dice **cosa c'è in tana-drink perché l'app sappia essere
di qualsiasi locale**, e cosa invece sta altrove. Il *perché* delle scelte
e l'inventario di quello che era cablato stanno in
[piano-sbrandizzazione.md](piano-sbrandizzazione.md).

**La flotta sta nella regia: il repository
[drink-regia](https://github.com/redirect11/drink-regia)**, e lì il
documento `docs/flotta-nella-regia.md`. Ci stanno il sito del prodotto
(prezzi, registrazione, dashboard, backoffice, abbonamento), le Functions
di attivazione, il Terraform delle istanze (`infra/istanza/`), i workflow
di attivazione e di aggiornamento (`provisiona-istanza.yml`,
`aggiorna-istanza.yml`), lo script della licenza e gli altri script delle
istanze. Dal 22/10/2026 il sito, dal 29/10/2026 il resto: prima stavano
qui, sul ramo `feature/flotta`.

**In questo repository resta l'app, una per tutti**: il locale come dato
(`clienti/`), la licenza coi moduli e la sospensione, l'identità e il
marchio del locale, la migrazione delle chiavi, il nome del locale nelle
Functions. La build per cliente è entrata in `develop` il 30/10/2026,
lasciando sul ramo `feature/flotta` tutto quello che era della regia.

## Le tre cose che non si negoziano

1. **La Tana non si accorge di niente.** `CLIENTE` non detto vuol dire
   `tana`: la build della Tana è quella di sempre, stesso nome, stesso
   scontrino, stessa PWA, stessi dati.
2. **Ognuno pubblica il suo.** I workflow di tana-drink pubblicano solo i
   progetti della Tana (`tana-drink`, `tana-drink-test`) con
   `cliente: tana`. I progetti `drinkpos-*` li pubblica la regia, con le
   sue credenziali: nei segreti di tana-drink c'è solo l'account di deploy
   della Tana, e da qui un'istanza non si può pubblicare nemmeno per
   sbaglio. Il pacchetto per versione (REQ-FLOTTA-035) non cambia la
   regola: `pacchetto.yml` lo allega alla Release di GitHub del tag, in
   questo repository, e la regia lo scarica da lì. Un test legge i
   workflow (`tests/unit/flottaCi.test.js`).
3. **Niente fork dell'app.** Un solo codice per tutti i locali; il locale
   è configurazione (`clienti/<slug>/` e le impostazioni nel suo
   database), la licenza è un dato, il marchio è un dato. Una richiesta
   che vale solo per la Tana diventa un'impostazione o un modulo, mai un
   `if` sul nome del locale.

## Il contratto con la regia

La regia, per attivare o aggiornare un locale, scarica l'app a un `ref`
(`develop` per la regia di test, `main` o un tag `vX.Y.Z` per la
produzione) in una cartella `app/` e lancia:

```sh
npm ci && (cd functions && npm ci)
node scripts/genera-cliente.mjs --slug <slug> --nome "<nome>"   # REQ-VENUE-006
# .env con le VITE_FIREBASE_* del progetto del locale
BASE_PATH=/ CLIENTE=<slug> VITE_APP_ENV=production npm run build
# functions/.env.<progetto> con VENUE_NAME
firebase deploy --only firestore,storage,functions,hosting      # profilo completo
firebase deploy --only firestore,hosting                        # profilo leggero (Free)
```

e poi scrive la licenza nel Firestore dell'istanza, nel documento
`licenza/attuale` (piano, moduli, stato, `regia_url`; BUG-125). Questi comandi e questi nomi sono un
contratto: se cambiano qui, si dice là. Un tag `vX.Y.Z` ha `package.json`
a `X.Y.Z`: i rilasci a ondate della regia confrontano le due cose.

### Il sito uguale per tutti (REQ-FLOTTA-034, dal 18/11/2026)

La strada nuova, per l'interfaccia 16 del contratto della regia
(`docs/contratto-regia-app.md` in drink-regia). Il sito si compila **una
volta per versione**, senza nessun locale dentro, e la regia ci scrive i
dati di ogni locale al deploy, senza ricompilare. **A compilare siamo
noi, al tag** (REQ-FLOTTA-035), e il pacchetto va nella **Release di GitHub
del tag**: Daniele, 18/11/2026, «tana drink compila il pacchetto,
provisiona istanza e aggiorna istanza aggiornano con il pacchetto di
release di tana-drink». La regola 2 qui sopra resta: scriviamo solo nel
nostro repository, e la regia scarica. La Tana continua a pubblicarsi da
GitHub con la sua build, e la regia tiene la compilazione di oggi come
ripiego (interfaccia 12, `scripts/genera-cliente.mjs`).

```sh
# il pacchetto, una volta per versione, SENZA .env nella radice
npm ci
node scripts/crea-pacchetto.mjs --tipo locali    # oppure --tipo demo
#  -> pacchetti/pacchetto-locali-vX.Y.Z.tgz e pacchetti/pacchetto-locali-vX.Y.Z.tgz.sha256

# per ogni locale, dalla radice del pacchetto aperto, su una COPIA del dist/
node personalizza.mjs --dist dist --configurazione <locale.json> [--pubblica <cartella>]
```

- **`.github/workflows/pacchetto.yml`**, a ogni tag `v*`: lint e test,
  poi i due pacchetti, poi la Release del tag (in bozza finché non ha tutti
  i file, «pre-release» se è una beta). Un pacchetto **non beta** esce solo
  se il commit del tag sta in `main`; un tag che non è `v` + la versione
  di `package.json` non fa pacchetti (sul commit di `main` è un errore,
  non un avviso: sarebbe un rilascio senza pacchetto). **Un file allegato
  non si sostituisce**: una versione corretta è una versione nuova (la
  regia ricorda l'impronta del primo pacchetto di ogni versione e rifiuta
  un archivio diverso). Il workflow non sovrascrive mai; che non lo faccia
  nemmeno una persona a mano lo garantiscono solo le «release immutabili»
  di GitHub, un'impostazione del repository (spenta al 18/11/2026: la
  decide Daniele). Nessun segreto: solo il permesso di scrivere nella
  Release, nel job che allega.
- **Se «Allega alla Release» si ferma a metà**, la Release resta in bozza
  (la regia non la vede) con una parte dei file, e rilanciarlo si ferma sul
  primo file già presente. Si cancella la bozza a mano (*Releases → la
  bozza → Delete*: il tag resta) e si rilancia il workflow intero.
- **`scripts/crea-pacchetto.mjs`** compila (i locali con `PACCHETTO=1`,
  la demo con `CLIENTE=demo` e il progetto finto, come la compilava la
  regia), controlla la build (nei locali niente demo, nella demo niente
  progetto vero) e mette insieme `dist/`, `firebase.json`, le regole e
  gli indici; per i locali anche `functions/` con le sole dipendenze di
  produzione (senza i `.env.<progetto>` della Tana) e `personalizza.mjs`
  in un file solo, che gira senza il repository. Scrive `pacchetto.json`
  nel formato 1 (versione, `tag`, `beta`, commit, `strumenti` con
  firebase-tools 15.36.0 e Node 22, `personalizzabili`, `campiVenue`
  sempre presente e l'impronta di ogni file) e si ferma se la regia lo
  rifiuterebbe: `problemiDelManifesto` è una copia dei controlli di
  `scripts/lib-pacchetto.js` della regia, da tenere allineata a mano. Rifiuta anche un `.env` nella radice e i file tracciati
  modificati (`--anche-modificato` per una prova in locale).
- **Quando il repository diventerà privato** la regia non potrà più
  scaricare senza un accesso: se ne parla allora (la regia propone una
  GitHub App in sola lettura).

- **`PACCHETTO=1`** (clienti/pluginCliente.js): nessun cliente nella build,
  i segnaposto `%VENUE_*%` restano in `index.html`, nel manifest e
  nell'informativa, e il set neutro di `clienti/demo/public` prende il
  posto dei file della Tana. Si ferma se trova `VITE_FIREBASE_*`,
  `VITE_RECAPTCHA_SITE_KEY`, `VITE_PROFILO`, `VITE_REGIA_PROGETTO` o gli
  emulatori: un sito per tutti col backend di un locale manderebbe gli
  ordini di tutti a quel locale. Non va insieme a `CLIENTE`.
- **`personalizza.mjs`** riempie index.html, il manifest e l'informativa
  privacy e cookie, scrive `configurazione.json` e lo stesso contenuto come
  blocco in `index.html`, e con `--pubblica` mette sopra i file del locale
  (solo `logo.png`, `favicon.svg`, le icone, `apple-touch-icon.png`,
  `cocktail-hero.jpg`). Rifiuta una configurazione che l'app non
  seguirebbe, un `dist/` già personalizzato e un file del locale con un
  altro nome, ed esce con errore se resta un segnaposto: in quei casi non
  scrive niente.
- **La configurazione del locale**: la forma è in
  [porte-e-adattatori.md](porte-e-adattatori.md#il-sito-uguale-per-tutti-i-locali-req-flotta-034-18112026).
  Per pubblicare un locale servono `locale` (lo slug), `firebase` con
  `apiKey`, `authDomain`, `projectId` e `appId`, e `venue` con almeno
  `venue_name`. Per l'informativa servono anche `venue_legal_name`,
  `venue_legal_address` (o `venue_address` e `venue_postal_city`),
  `venue_vat_number` e `venue_email`: quelli che mancano si leggono «da
  inserire» nella pagina.
- **L'informativa si scrive al deploy, ed è voluto.** Se il titolare cambia
  i suoi dati in Impostazioni (`settings/bar`), le due pagine restano
  quelle di prima finché la regia non lancia un aggiornamento, anche alla
  stessa versione. Le pagine sono statiche apposta: si aprono anche quando
  l'app non parte, e non chiamano nessun servizio, Firebase compreso.
  Leggere `settings/bar` da lì vorrebbe dire caricare l'SDK in una pagina
  che parla proprio di quali dati partono verso chi.
- **La demo** non si personalizza: il suo pacchetto (`--tipo demo`) è
  la demo intera, sempre col profilo leggero, senza Functions.

## Il titolare (REQ-FLOTTA-029)

Quando la regia attiva o aggiorna un locale della flotta, nel progetto del
locale crea (se manca) l'account del titolare **con lo stesso uid e la
stessa email che ha nella regia**, già verificato e **senza password**,
col ruolo `admin` nei custom claims; finché non ha una password Firebase
gli manda l'email per impostarla. Lo fa `scripts/titolare-istanza.mjs`
della regia, con le credenziali del suo service account, dopo il deploy.
Il contratto, da qui: **il ruolo del titolare è il claim `role: 'admin'`**
(`src/lib/ruoli.js`); se un giorno cambia, si dice alla regia.

L'uid di Firebase Auth non si cambia. Un segnaposto mai usato con un altro
uid (i locali attivati prima del 02/11/2026) si cancella e si ricrea con
l'uid giusto; un account già usato resta com'è, con un avviso nel log.

I locali esistenti, come la Tana, i workflow della regia li saltano: hanno
i loro admin. Per loro c'è `scripts/titolare-locale.mjs`, a mano, con la
stessa regola (`scripts/lib-titolare.js`, copia di quella della regia):

```sh
node scripts/titolare-locale.mjs --project tana-drink-test --uid <uid nella regia> --email <email>   # dice cosa farebbe
node scripts/titolare-locale.mjs --project tana-drink-test --uid <uid> --email <email> --applica
```

## Da dove viene il marchio (REQ-VENUE)

```
clienti/<slug>/venue.json  ──(build: Vite, CLIENTE=<slug>)──▶  __CLIENTE__
                                                                   │
settings/bar (venue_*)  ──────────────────────────────────▶  venueDi(settings)
                                                                   │
            nomeApp · barra · landing · menù · scontrino · social · manifest
```

- `clienti/tana/venue.json` porta i valori della Tana: con `CLIENTE` non
  detto la build è quella di sempre.
- Le impostazioni del locale (`settings/bar`, chiavi `venue_*`) vincono
  sulla build: un cliente cambia nome, indirizzo, social e intestazione
  dello scontrino da Impostazioni, senza rebuild.
- La riserva nel codice è **neutra**: a `src/` non resta nessuna parola
  della Tana fuori dai commenti e dalla whitelist del test-guardia
  (`tests/unit/marchio.test.js`), che si può solo accorciare.
- In questo repository le cartelle dei clienti sono due, `tana` e `demo`
  (il locale neutro). Quelle degli altri locali le crea la regia sul suo
  checkout, con `genera-cliente.mjs`.

## La licenza (REQ-LIC, REQ-FLOTTA-008)

`licenza/attuale` la scrive la regia, e dall'app non la scrive nessuno
(BUG-125). Ce l'ha ogni installazione, la Tana compresa (REQ-LIC-009,
docs/licenza-valida.md): senza, l'app mostra «Installazione non attivata»
e le regole non fanno scrivere niente; scaduta, si ferma o lavora col Free
(`alla_scadenza`). Con la licenza:
i moduli che non ci sono spengono le voci e le pagine relative
(`FunzioneNonInclusa`), e `stato: sospesa | chiusa` ferma l'app con una
schermata che lo dice (`InstallazioneSospesa`); i dati restano.

**Il piano Free** (REQ-LIC-003, REQ-LIC-004). La regia scrive anche
`licenza.limiti` (`prodotti_max`, `conti_aperti_max`, `sconti`,
`storico_giorni`, `utenti_max`, `marchio`) per il Free e `null` per i piani
a pagamento; la logica sta in `src/lib/limiti.js`. Senza `limiti` nessun
limite: è il caso della Tana. Con `licenza.piano === 'free'` (o
`VITE_PROFILO=leggero` nella build) l'app lavora col profilo leggero, senza
Functions né Storage: niente SumUp, niente foto dei prodotti, niente
account dello staff. Con un solo terminale `risolviNumeroDuplicato` non
serve; con due dispositivi del titolare aperti insieme un numero doppio,
raro, resta (il dettaglio è in REQ-LIC-004).

**Gli aggiornamenti** (REQ-FLOTTA-020). La regia può scrivere anche
`licenza.aggiornamenti`: in modalità «a scelta» l'app mostra al titolare
le novità prima di aggiornare, con «Aggiorna» e «Salta», e scrive la
scelta in `aggiornamenti/scelta`. Senza la voce, tutto come oggi. Il
contratto è in [aggiornamenti-dalla-regia.md](aggiornamenti-dalla-regia.md).

## Le porte e gli adattatori (REQ-FLOTTA-021)

Dal 31/10/2026 i livelli di installazione sono tre: cloud, app e on
premise, cioè il gestionale intero nel locale col backup sul cloud. Perché
l'app resti una, parla con delle porte nostre (dati, accesso, file,
server, notifiche, configurazione), e Firebase diventa un adattatore. Dove
si installa e come si configura lo decide la regia. La specifica è in
[porte-e-adattatori.md](porte-e-adattatori.md).

## Come si prova senza spaccare niente

- **In locale, con gli emulatori** (`npm run emulators` + `npm run dev`):
  nessun progetto vero. È dove si lavora.
- **Con un altro cliente in locale**: `CLIENTE=demo npm run dev` compila
  l'app con la cartella `clienti/demo/` (nome neutro, logo neutro). Se il
  risultato mostra ancora la Tana da qualche parte, è un difetto, e il
  test-guardia lo trova prima.
- **La CI compila anche `CLIENTE=demo`** quando fa girare i test (non sui push ai rami di rilascio): una modifica
  pensata per la Tana che rompe gli altri si vede prima del rilascio.
- **Online**, l'istanza dimostrativa `drinkpos-demo` è un'istanza come le
  altre: la aggiorna la regia, non i workflow di qui. È pubblica (la apre
  la prima pagina del prodotto), quindi non usa il database: la modalità
  demo è in [modalita-demo.md](modalita-demo.md) (REQ-FLOTTA-019).

## I comandi

```sh
npm run dev                      # l'app della Tana, come sempre
CLIENTE=demo npm run dev         # l'app compilata per il locale neutro
CLIENTE=demo npm run build       # la build del locale neutro
node scripts/genera-cliente.mjs --slug bar-mario --nome "Bar Mario"
# il sito del prodotto e la flotta: repository drink-regia
```

## Stato del lavoro

Si legge dal registro: `node scripts/requisiti.mjs` e i gruppi
`REQ-VENUE-*` (il marchio come configurazione), `REQ-LIC-*` (licenza e
moduli) e `REQ-FLOTTA-*` (la parte della flotta che vive nell'app). Il
resto della flotta ha il suo registro, in drink-regia.
