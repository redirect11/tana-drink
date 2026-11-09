# L'ambiente dei test end-to-end

I casi d'uso ([specifica-prodotto.md](specifica-prodotto.md)) si provano
con i test di `tests/e2e/`, nel browser, coi soli gesti di chi lavora
(REQ-DEV-019). Girano in due posti, con gli stessi test:

| Dove | Quando | Come |
|---|---|---|
| **In locale**, sugli emulatori completi (Auth, Firestore, Storage, Functions) | quando si scrive un test | `npm run test:e2e` |
| **Sull'ambiente generato**, un progetto Firebase vero | a ogni tag, e a mano dalla pagina Actions | [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) |

`tana-drink-test` **non** si usa per questi test: resta al cliente, per la
validazione.

## Come funziona un giro sull'ambiente generato

Il progetto di prova `drinkpos-prova-e2e` esiste sempre, **vuoto**. A ogni
giro il workflow:

1. compila l'app con la configurazione web letta dal progetto stesso;
2. ci pubblica regole, indici, regole di Storage, Functions, e l'app su un
   **canale d'anteprima** che scade in un giorno;
3. fa girare i test: ognuno semina il database da zero (menù, magazzino,
   impostazioni, un'utenza per ruolo, la licenza della Tana);
4. **smonta tutto, sempre**, anche se i test falliscono: dati, utenze,
   canale, Functions.

Un giro alla volta (`concurrency: e2e`): due giri svuoterebbero lo stesso
database uno sotto l'altro.

### Perché un progetto fisso e non uno nuovo a ogni giro

L'utente, 09/11/2026, ha scelto questa strada. Un progetto nuovo per
giro si scontra con tre limiti di Google:

- senza un'Organizzazione Google un service account non crea progetti;
- l'account di fatturazione regge cinque progetti;
- un progetto eliminato resta trenta giorni in cancellazione, e il suo
  nome non torna libero.

### Le guardie

Qui si cancella un database intero, quindi ci sono tre controlli in fila:

- il workflow accetta solo progetti `drinkpos-prova-…`;
- la chiave deve essere **di quel** progetto;
- [`scripts/lib-ambiente-e2e.mjs`](../scripts/lib-ambiente-e2e.mjs)
  rifà gli stessi due controlli prima di svuotare. Rifiuta per nome anche
  `tana-drink`, `tana-drink-test` e le due regie.

Le utenze di prova sul progetto vero **non** hanno la password del seme
(`src/dev/seedData.js`, versionata): prendono quella del segreto
`E2E_PASSWORD`.

## Da preparare una volta, a mano

Va fatto da una persona: un service account, senza Organizzazione, non
crea progetti.

1. **Creare il progetto** e dare il ruolo di proprietario al service
   account di provisioning della regia, come per ogni istanza di prova
   (drink-regia, `infra/README.md`, punto 4):

   ```sh
   npx firebase-tools projects:create drinkpos-prova-e2e
   # collegarlo all'account di fatturazione 2, quello delle prove
   node scripts/ruoli-provisioning.mjs --sa provisioning@drink-regia.iam.gserviceaccount.com \
     --progetto drinkpos-prova-e2e          # dal repo drink-regia
   ```

   L'account 2 ha la quota di partenza di Google, 5 progetti: il
   09/11/2026 era pieno e il collegamento è stato rifiutato («Cloud billing
   quota exceeded»). Si è liberato un posto spostando `forme-demo-065381`
   sull'account 1, quello con la quota portata a 20. Il progetto e2e deve
   stare sull'account 2: il Terraform della regia di test lo riporta lì a
   ogni apply.

2. **Generarlo col Terraform**: in drink-regia, Actions → «Provisiona
   istanza» sull'environment della regia di test, con questi valori:
   - slug `prova-e2e`;
   - nome «Collaudo e2e»;
   - piano `completo`;
   - profilo `completo`;
   - `uid` ed `email` vuoti.

   Il Terraform accende le API e crea Firestore, Hosting, la web app,
   Auth e il service account `deploy@drinkpos-prova-e2e` coi suoi ruoli.
   Il workflow crea anche il bucket di Storage e i segreti che le
   Functions dichiarano.

   Pubblica anche un'app e una licenza: il primo giro e2e le spazza via,
   ed è giusto così.

3. **I ruoli del service account di deploy, e la chiave.** Il Terraform
   gli dà i sei ruoli che bastano a pubblicare un'istanza. Il giro e2e
   chiede in più solo di leggere i segreti delle Functions (il primo giro
   si è fermato su `secretmanager.secrets.get`): `secretmanager.viewer`,
   non `admin`, perché l'accesso del runtime al segreto lo ha già dato il
   provisioning. **Mai proprietario**: l'audit di sicurezza del 09/11/2026
   (drink-regia, punto 1) boccia proprio «un elenco più stretto si rompe a
   ogni risorsa nuova». Un proprietario, anche su un progetto vuoto, accende
   servizi a spese dell'account 2, crea chiavi e cambia l'IAM. Se un giro
   chiede un permesso nuovo, si dà quel ruolo e si scrive qui.

   Dopo il provisioning anche `provisioning@drink-regia` perde il ruolo di
   proprietario su questo progetto: il giro e2e non lo usa, e gli restano
   i sette ruoli che il Terraform gli dichiara.

   Poi la chiave:

   ```sh
   gcloud iam service-accounts keys create e2e-sa.json \
     --iam-account deploy@drinkpos-prova-e2e.iam.gserviceaccount.com --project drinkpos-prova-e2e
   ```

4. **L'environment GitHub `e2e`** su tana-drink (Settings → Environments):
   - variabile `E2E_PROGETTO` = `drinkpos-prova-e2e`;
   - segreto `E2E_SERVICE_ACCOUNT` = il contenuto di `e2e-sa.json` (il
     file poi si cancella);
   - segreto `E2E_PASSWORD` = una password di almeno 12 caratteri, solo
     per le utenze di prova.
   - **rami e tag di deploy** limitati: tag `v*` (solo l'admin li crea,
     ruleset) e ramo `main`. Senza limiti la chiave la legge qualunque
     workflow su qualunque ramo che dichiari `environment: e2e`, compresi
     i rami che `claude.yml` committa dai commenti (audit, punto 23).

5. **Il primo giro**: Actions → «End-to-end (ambiente generato)» → Run
   workflow. GitHub lancia a mano solo i workflow che stanno già sul ramo
   principale: finché `e2e.yml` non è su `main` il giro parte da un tag, o
   da un ramo usa e getta che aggiunge `branches:` al trigger `push`
   (così è stato fatto il primo, su `prova/e2e`: aperto nell'environment
   per quel giro, poi tolto insieme al ramo).

## In locale

```sh
npm run test:e2e
```

Accende Auth, Firestore, Storage e Functions emulati
(`firebase.collaudo.json`), compila l'app con `.env.sistema` e la serve
sulla 4811.

Le Functions vogliono le loro dipendenze: `npm ci --prefix functions`. In
un worktree nuovo basta anche una giunzione verso il `functions/node_modules`
di un altro worktree con lo stesso `package-lock.json`.
