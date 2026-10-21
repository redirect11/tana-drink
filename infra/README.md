# infra: i progetti Firebase della flotta, con Terraform

Due radici (docs/flotta.md, REQ-FLOTTA-006):

| Cartella | Cosa crea | Quando |
|---|---|---|
| `regia/` | il progetto `drink-regia` | una volta |
| `istanza/` | un progetto `drink-<slug>` per un locale, completo di Firebase, Firestore, Hosting, web app e Auth | a ogni attivazione, dal workflow `provisiona-istanza.yml` |

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
| `PROGETTO_FLOTTA` | variabile | `drink-demo` |
| `BILLING_ACCOUNT_ID` | segreto | l'id dell'account di fatturazione |
| `PROVISIONING_SA_JSON` | segreto | la chiave del service account |
| environment `flotta` | segreti `VITE_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT` | del progetto `drink-demo` |
| environment `regia` | segreti `VITE_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT` | del progetto `drink-regia` |

**Senza Organizzazione Google Cloud** (account Gmail personale) un service
account non può creare progetti: li crea l'utente (`firebase projects:create
drink-<slug>`), e Terraform li *importa* e li completa. Il workflow lo sa:
se `ORG_ID` manca, si aspetta che il progetto esista già e lo dice.

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
