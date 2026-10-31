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
   sbaglio. Un test legge i workflow (`tests/unit/flottaCi.test.js`).
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

e poi scrive `settings/bar.licenza` nel Firestore dell'istanza (piano,
moduli, stato, `regia_url`). Questi comandi e questi nomi sono un
contratto: se cambiano qui, si dice là. Un tag `vX.Y.Z` ha `package.json`
a `X.Y.Z`: i rilasci a ondate della regia confrontano le due cose.

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

`settings/bar.licenza` la scrive la regia; la Tana non ce l'ha e lavora
come sempre (tutti i moduli inclusi, nessuna sospensione). Con la licenza:
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

## Come si prova senza spaccare niente

- **In locale, con gli emulatori** (`npm run emulators` + `npm run dev`):
  nessun progetto vero. È dove si lavora.
- **Con un altro cliente in locale**: `CLIENTE=demo npm run dev` compila
  l'app con la cartella `clienti/demo/` (nome neutro, logo neutro). Se il
  risultato mostra ancora la Tana da qualche parte, è un difetto, e il
  test-guardia lo trova prima.
- **La CI compila anche `CLIENTE=demo`** a ogni push: una modifica
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
