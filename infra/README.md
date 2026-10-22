# infra: i progetti Firebase della flotta, con Terraform

Due radici (docs/flotta.md, REQ-FLOTTA-006):

| Cartella | Cosa crea | Quando |
|---|---|---|
| (il progetto `drink-regia` è stato creato a mano il 22/10; il sito sta nel repository drink-regia) | | |
| `istanza/` | un progetto `drinkpos-<slug>` per un locale, completo di Firebase, Firestore, Hosting, web app e Auth | a ogni attivazione, dal workflow `provisiona-istanza.yml` |

Lo stato di Terraform sta in un bucket GCS del progetto regia
(`drink-regia-tfstate`), una cartella per istanza (`istanze/<slug>`).

## Prerequisiti, una volta, a mano

1. **Account di fatturazione Blaze** e il suo id (`ABCDEF-123456-ABCDEF`):
   console Google Cloud → Fatturazione.
2. **Quota di progetti**: di partenza un account personale ne può creare
   pochi. Si chiede l'aumento da console → IAM e amministrazione → Quote →
   «Projects» prima del terzo cliente.
3. **Service account di provisioning**, nel progetto regia
   (`provisioning@drink-regia.iam.gserviceaccount.com`), con:
   - `roles/resourcemanager.projectCreator` sull'organizzazione o, senza
     organizzazione, i progetti si creano con l'utente e il SA li
     amministra dopo (vedi nota sotto);
   - `roles/billing.user` sull'account di fatturazione;
   - `roles/firebase.admin`, `roles/serviceusage.serviceUsageAdmin`,
     `roles/iam.serviceAccountUser` sui progetti creati (li dà il modulo).
   La sua chiave JSON va nel segreto GitHub `PROVISIONING_SA_JSON`.
4. **Token GitHub** (fine-grained, permesso `actions: write` su questo
   repository) nel segreto `GITHUB_DISPATCH_TOKEN` delle Functions della
   regia: è quello con cui la regia lancia il workflow.
5. Variabili e segreti del repository:

| Nome | Dove | Valore |
|---|---|---|
| `PROGETTO_FLOTTA` | variabile | `drinkpos-demo` |
| `BILLING_ACCOUNT_ID` | segreto | l'id dell'account di fatturazione |
| `PROVISIONING_SA_JSON` | segreto | la chiave del service account |
| environment `flotta` | segreti `VITE_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT` | del progetto `drinkpos-demo` |
| environment `regia` | segreti `VITE_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT` | del progetto `drink-regia` |
| `TFSTATE_BUCKET` | variabile | il bucket GCS dello stato Terraform (es. `drink-regia-tfstate`, da creare nel progetto regia) |
| `ORG_ID` | variabile (facoltativa) | l'Organizzazione Google Cloud; senza, i progetti si creano a mano |
| `REGIA_CALLBACK_URL` | variabile | l'url della Function `esitoProvisioning` della regia |
| `PROVISIONING_CALLBACK_SECRET` | segreto (repo E Functions della regia) | una stringa lunga e casuale |
| `GITHUB_DISPATCH_TOKEN` | segreto delle Functions della regia | token fine-grained con `actions: write` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | segreti delle Functions della regia | prima quelle di prova |

**Senza Organizzazione Google Cloud** (account Gmail personale) un service
account non può creare progetti: li crea l'utente (`firebase projects:create
drinkpos-<slug>`), e Terraform li *importa* e li completa. Il workflow lo sa:
se `ORG_ID` manca, si aspetta che il progetto esista già e lo dice.

## I ruoli del service account di provisioning (a mano, in console)

Il service account `provisioning@drink-regia.iam.gserviceaccount.com`
esiste e la sua chiave è nel segreto `PROVISIONING_SA_JSON`; i tre ruoli
che gli servono vanno dati dalla console (lo strumento automatico è stato
fermato: dare permessi è un gesto che vuole una persona):

1. **Account di fatturazione** → console Google Cloud → Fatturazione →
   l'account `01FD7B-…` → Gestione account → Aggiungi entità →
   `provisioning@drink-regia.iam.gserviceaccount.com`, ruolo «Utente account
   di fatturazione».
2. **Bucket dello stato** → Cloud Storage → `drink-regia-tfstate` →
   Autorizzazioni → Concedi accesso → stesso account, ruolo «Amministratore
   oggetti Storage».
3. **Ogni progetto di istanza creato a mano** (oggi `drinkpos-demo`) → IAM →
   Concedi accesso → stesso account, ruolo «Proprietario» (il provisioning
   amministra l'istanza per intero; Terraform da solo poi dà alla regia il
   ruolo per scrivere la licenza).

## Cosa è già stato fatto (22/10/2026)

- `drink-regia` e `drinkpos-demo` creati, web app create, API di base
  abilitate (`scripts/abilita-api.mjs`), Firestore in europe-west1.
- Variabile `PROGETTO_FLOTTA=drinkpos-demo`; environment `flotta` (tana-drink)
  e `production` (drink-regia) coi `VITE_FIREBASE_*` di ciascun progetto.
- Blaze (fatturazione) su `drink-regia` e `drinkpos-demo`; le API a
  pagamento abilitate su tutti e due.
- Bucket `drink-regia-tfstate` (EU, versioni attive); variabili
  `TFSTATE_BUCKET`, `REGIA_CALLBACK_URL`; segreti `BILLING_ACCOUNT_ID`,
  `PROVISIONING_SA_JSON`, `PROVISIONING_CALLBACK_SECRET` (anche nelle
  Functions della regia); `SUMUP_API_KEY` segnaposto su `drinkpos-demo`.
- **Mancano**: i tre ruoli qui sopra; in console Firebase Auth → «Inizia»
  e provider Email/password sui due progetti; il segreto
  `FIREBASE_SERVICE_ACCOUNT` nei due environment (chiave JSON di un
  service account con `roles/firebase.admin` del progetto); il token
  GitHub `GITHUB_DISPATCH_TOKEN` e le chiavi Stripe nelle Functions della
  regia.

## Come si prova senza toccare niente

```sh
cd infra/istanza
terraform init -backend=false
terraform validate
terraform plan -var slug=demo -var billing_account=XXX   # solo piano, niente apply
```

## Stato

Scheletro: `istanza/main.tf` dichiara le risorse e le variabili;
`provisiona-istanza.yml` e le Functions della regia sono il prossimo
passo (REQ-FLOTTA-006, `todo`). Niente di questo è mai stato applicato.
