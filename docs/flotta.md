# La flotta: un codice, un progetto Firebase per locale, una regia che vende

Questo documento dice **come si costruisce e si prova il prodotto** senza
toccare la Tana. Il *perché* delle scelte e l'inventario di quello che era
cablato stanno in [piano-sbrandizzazione.md](piano-sbrandizzazione.md): qui
c'è l'attuazione, decisa il 21/10/2026 («cominciamo a implementare la due,
senza downtime sulla Tana»).

**Dal 22/10/2026 il sito del prodotto ha il suo repository:
[drink-regia](https://github.com/redirect11/drink-regia)** (prezzi,
registrazione, dashboard, backoffice, abbonamento, Functions di
attivazione), nato staccando la cartella `regia/` da qui con la sua storia.
In questo repository restano l'app dei locali, il marchio come
configurazione (`clienti/`), Terraform (`infra/`), gli script e il workflow
di attivazione (`provisiona-istanza.yml`), che la regia lancia.

## Le tre cose che non si negoziano

1. **La Tana non si accorge di niente.** Ogni commit di questo lavoro
   lascia l'app della Tana identica: stesso nome, stesso scontrino, stessa
   PWA, stessi dati. Il modo è sempre lo stesso: prima nasce il posto dove
   la configurazione vivrà, con dentro i valori della Tana; poi il codice
   legge da lì; il valore cablato resta come riserva finché il posto nuovo
   non è provato.
2. **I progetti della Tana non si toccano da questo ramo.** `tana-drink` e
   `tana-drink-test` ricevono solo quello che passa da `develop` e `main`.
   Il ramo `feature/flotta` pubblica, se pubblica, su `drinkpos-demo`.
3. **Niente fork dell'app.** Un solo codice per tutti i locali; il locale è
   configurazione (`clienti/<slug>/`), la licenza è un documento, il
   marchio è un dato. Il sito del prodotto è un'altra cosa, e ha il suo
   repository.

## I progetti Firebase

| Progetto | Cosa fa | Chi lo crea |
|---|---|---|
| `tana-drink`, `tana-drink-test` | la Tana, come oggi | esistono |
| `drink-regia` | il sito del prodotto (repository drink-regia): prezzi, registrazione e accesso dei titolari, dashboard del cliente, backoffice; il database dei clienti e delle licenze; le Functions che lanciano l'attivazione | creato il 22/10/2026 |
| `drinkpos-demo` | la prima istanza, neutra: dove si prova `feature/flotta` e dove si fa vedere il prodotto | una tantum, come un cliente qualsiasi (`infra/istanza` con slug `demo`) |
| `drinkpos-<slug>` | un'istanza per ogni locale cliente | Terraform, lanciato dalla regia |

**Creati il 22/10/2026** `drink-regia` e `drinkpos-demo` (l'id `drink-demo`
era già di qualcun altro: gli id dei progetti Google sono globali, da qui
il prefisso `drinkpos-` per le istanze), con web app, API di base e
Firestore in europe-west1, da riga di comando (`scripts/abilita-api.mjs`).
**A mano, nella console**: Firebase Auth → «Inizia» e il provider Email e
password (l'API di configurazione risponde solo dopo quel primo clic), e il
piano Blaze su tutti e due.

Tutti sotto **lo stesso account di fatturazione Blaze**. La quota di progetti
per account di fatturazione è bassa di partenza: l'aumento si chiede a
Google dalla console prima del terzo cliente, non dopo.

Lo **slug tecnico del prodotto è `drink`** (prefisso dei progetti, delle
chiavi locali e della cache). Il **nome visibile** del prodotto sta in un
posto solo, `src/lib/prodotto.js` del repository drink-regia, e si cambia lì.

## Come si prova senza spaccare niente

- **In locale, con gli emulatori** (`npm run emulators` + `npm run dev`):
  nessun progetto vero. È dove si lavora.
- **Con un altro cliente in locale**: `CLIENTE=demo npm run dev` compila
  l'app con la cartella `clienti/demo/` (nome neutro, logo neutro). Se il
  risultato mostra ancora la Tana da qualche parte, è un difetto, e il
  test-guardia (`tests/unit/marchio.test.js`) lo trova prima.
- **Online, su `drinkpos-demo`**: «Deploy to Firebase» lanciato a mano sul
  ramo `feature/flotta`. Il workflow sa che il ramo non è della Tana e
  pubblica sul progetto scritto nella variabile di repository
  `PROGETTO_FLOTTA`; se la variabile non c'è, si ferma e lo dice. Un tag
  su un commit che non sta né in `main` né in `develop` né in un ramo
  `release/` o `hotfix/` fa lo stesso.
- **Mai** `tana-drink-test` da questo ramo: la regola sta nel job «Dove va»
  di `.github/workflows/firebase-hosting.yml`, e un test la controlla.

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
  della Tana fuori dai commenti e dalla whitelist del test-guardia, che si
  può solo accorciare.

## Come si attiva un cliente (REQ-FLOTTA)

```
sito (regia)            regia: Firestore + Functions          GitHub Actions
──────────────          ────────────────────────────          ───────────────
registrazione  ──▶  clienti/{uid}
scelta piano   ──▶  abbonamenti (Stripe, più avanti)
«attiva»       ──▶  richieste/{slug} {stato: 'in coda'}
                    Function onCreate ──(workflow_dispatch)──▶ provisiona-istanza.yml
                                                                 terraform apply (infra/istanza)
                                                                 build CLIENTE=<slug>
                                                                 deploy hosting+functions+regole
                                                                 scrive settings/licenza
                    richieste/{slug} {stato: 'attiva', url} ◀── callback (Function https)
dashboard cliente ◀─ istanze/{slug}
```

Cose che servono **una volta**, a mano, e vanno nei segreti/variabili del
repository (nomi esatti in `infra/README.md`):

- un service account di provisioning (ruoli: creare progetti, usare
  l'account di fatturazione, amministrare Firebase) e la sua chiave;
- l'id dell'account di fatturazione;
- un token GitHub con permesso `actions:write`, per la Function che lancia
  il workflow;
- la variabile `PROGETTO_FLOTTA` = `drinkpos-demo`.

## I comandi

```sh
npm run dev                      # l'app della Tana, come sempre
CLIENTE=demo npm run dev         # l'app compilata per il locale neutro
CLIENTE=demo npm run build       # la build per drinkpos-demo
# il sito del prodotto: repository drink-regia (npm install && npm run dev)
```

I segreti e le variabili di GitHub che servono alla flotta stanno in
`infra/README.md`.

## Stato del lavoro

Si legge dal registro: `node scripts/requisiti.mjs` e i gruppi
`REQ-VENUE-*` (il marchio come configurazione) e `REQ-FLOTTA-*` (regia,
istanze, provisioning). Il test-guardia dice quanto manca alla
sbrandizzazione: la sua whitelist può solo accorciarsi.
