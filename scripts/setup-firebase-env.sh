#!/usr/bin/env bash
# =====================================================================
#  Setup automatico di un ambiente Firebase per Tana Drink.
# =====================================================================
#  Esegui in Google Cloud Shell (sei autenticato come owner, con tutti i
#  permessi: lo script configura tutto senza i blocchi IAM/API che si
#  incontrano facendo i deploy "a freddo").
#
#  Uso:
#    bash scripts/setup-firebase-env.sh <PROJECT_ID> <BILLING_ACCOUNT_ID> [REGION]
#
#  Esempio:
#    # trova il billing account: gcloud billing accounts list
#    bash scripts/setup-firebase-env.sh tana-drink-test 01ABCD-234567-89ABCD europe-west1
#
#  Al termine stampa i valori da mettere nei GitHub Secrets dell'ambiente.
#  Restano DUE passi manuali in console (Storage init + Auth Email/Password):
#  sono segnalati alla fine.
# =====================================================================
set -euo pipefail

PROJECT_ID="${1:?Uso: setup-firebase-env.sh <PROJECT_ID> <BILLING_ACCOUNT_ID> [REGION]}"
BILLING_ACCOUNT="${2:?Manca BILLING_ACCOUNT_ID — vedi: gcloud billing accounts list}"
REGION="${3:-europe-west1}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

say "Progetto: $PROJECT_ID | Billing: $BILLING_ACCOUNT | Region: $REGION"

# 1) Crea il progetto GCP (se non esiste)
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Progetto già esistente, proseguo."
else
  gcloud projects create "$PROJECT_ID"
fi

# 2) Collega il billing (necessario per Functions/Storage Gen2)
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"

# 3) Abilita tutte le API necessarie (idempotente)
say "Abilito le API"
gcloud services enable \
  firebase.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  eventarc.googleapis.com \
  pubsub.googleapis.com \
  serviceusage.googleapis.com \
  firestore.googleapis.com \
  firebasestorage.googleapis.com \
  storage.googleapis.com \
  identitytoolkit.googleapis.com \
  firebaserules.googleapis.com \
  firebaseextensions.googleapis.com \
  --project "$PROJECT_ID"

# 4) Aggiungi Firebase al progetto GCP (crea anche il SA firebase-adminsdk)
say "Aggiungo Firebase al progetto"
firebase projects:addfirebase "$PROJECT_ID" >/dev/null 2>&1 || echo "Firebase già attivo sul progetto."

# 5) Database Firestore in modalità nativa
say "Creo il database Firestore"
gcloud firestore databases create --location="$REGION" --project "$PROJECT_ID" \
  >/dev/null 2>&1 || echo "Firestore già esistente."

# 6) Identifica i service account
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SA_EMAIL="$(gcloud iam service-accounts list --project "$PROJECT_ID" \
  --format='value(email)' --filter='email:firebase-adminsdk*' | head -1)"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "Deploy SA:  $SA_EMAIL"
echo "Runtime SA: $COMPUTE_SA"

# 7) Ruoli al deploy SA (deploy Functions Gen2 + Hosting + Storage rules)
say "Assegno i ruoli al service account di deploy"
for ROLE in \
  roles/firebase.admin \
  roles/cloudfunctions.admin \
  roles/run.admin \
  roles/artifactregistry.admin \
  roles/cloudbuild.builds.editor \
  roles/serviceusage.serviceUsageAdmin \
  roles/iam.serviceAccountUser \
  roles/firebasestorage.admin \
  roles/firebaserules.admin ; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" --role="$ROLE" --condition=None >/dev/null
done

# 8) actAs sul runtime SA (compute default) — il permesso che bloccava il deploy
say "Concedo actAs sul runtime SA"
gcloud iam service-accounts add-iam-policy-binding "$COMPUTE_SA" \
  --member="serviceAccount:$SA_EMAIL" --role="roles/iam.serviceAccountUser" \
  --project "$PROJECT_ID" >/dev/null

# 9) Web app + config (valori VITE_FIREBASE_*)
say "Creo la web app e leggo la config"
firebase apps:create WEB "tana-drink ($PROJECT_ID)" --project "$PROJECT_ID" >/dev/null 2>&1 \
  || echo "Web app già esistente."
echo "------ CONFIG WEB APP (per i GitHub Secrets) ------"
firebase apps:sdkconfig WEB --project "$PROJECT_ID" || true
echo "---------------------------------------------------"

# 10) Chiave del service account (per il secret FIREBASE_SERVICE_ACCOUNT)
KEY_FILE="$HOME/${PROJECT_ID}-sa.json"
say "Genero la chiave del service account"
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL" --project "$PROJECT_ID"
echo "Chiave salvata in: $KEY_FILE"

# ── Riepilogo ─────────────────────────────────────────────────────────
cat <<EOF

============================================================
 FATTO (parte automatica). Ancora 2 passi manuali in console:
------------------------------------------------------------
 1) Storage: Firebase Console ($PROJECT_ID) -> Storage -> "Inizia"
    (scegli una location europea). Poi pubblica storage.rules.
 2) Auth: Authentication -> Sign-in method -> abilita "Email/Password",
    e crea l'utente bartender (Users -> Add user).

 GITHUB SECRETS (Settings -> Environments -> <ambiente>):
   - VITE_FIREBASE_*        -> dai valori "CONFIG WEB APP" qui sopra
   - FIREBASE_SERVICE_ACCOUNT -> incolla il CONTENUTO di:
       $KEY_FILE
     (poi cancella il file:  rm "$KEY_FILE")
============================================================
EOF
