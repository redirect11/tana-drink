# ── UN'ISTANZA DELLA FLOTTA: il progetto Firebase di un locale ──────────
#
# docs/flotta.md, REQ-FLOTTA-006. Dallo slug nasce `drink-<slug>` con tutto
# quello che l'app si aspetta: le API, Firebase, Firestore in europe-west1,
# un sito Hosting, la web app (la cui config diventa il .env della build),
# Auth. Le regole, gli indici, le Functions e l'app li pubblica il
# workflow dopo l'apply, con lo stesso firebase-tools di sempre.
#
# SCHELETRO: dichiara, non è mai stato applicato. Si valida con
# `terraform validate` (infra/README.md).

terraform {
  required_version = ">= 1.6"
  required_providers {
    google      = { source = "hashicorp/google", version = "~> 6.0" }
    google-beta = { source = "hashicorp/google-beta", version = "~> 6.0" }
  }
  backend "gcs" {
    # bucket e prefisso li passa il workflow: -backend-config="bucket=…"
    # -backend-config="prefix=istanze/<slug>"
  }
}

variable "slug" {
  description = "Lo slug del locale (clienti.js: minuscole, cifre, trattini, 6-30 caratteri)."
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.slug))
    error_message = "Slug non valido."
  }
}

variable "billing_account" {
  description = "L'id dell'account di fatturazione Blaze."
  type        = string
}

variable "org_id" {
  description = "L'organizzazione Google Cloud, se c'è. Vuota: il progetto deve esistere già (creato dall'utente) e viene importato."
  type        = string
  default     = ""
}

variable "regione" {
  type    = string
  default = "europe-west1"
}

locals {
  progetto = "drink-${var.slug}"
  api = [
    "firebase.googleapis.com",
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "firebasehosting.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "run.googleapis.com",
    "eventarc.googleapis.com",
    "pubsub.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com",
    "firebaseappcheck.googleapis.com",
  ]
}

resource "google_project" "istanza" {
  provider        = google-beta
  project_id      = local.progetto
  name            = local.progetto
  org_id          = var.org_id != "" ? var.org_id : null
  billing_account = var.billing_account
  deletion_policy = "PREVENT"
  labels = {
    prodotto = "drink"
    slug     = var.slug
  }
}

resource "google_project_service" "api" {
  provider = google-beta
  for_each = toset(local.api)
  project  = google_project.istanza.project_id
  service  = each.value
  disable_on_destroy = false
}

resource "google_firebase_project" "firebase" {
  provider   = google-beta
  project    = google_project.istanza.project_id
  depends_on = [google_project_service.api]
}

resource "google_firestore_database" "db" {
  provider    = google-beta
  project     = google_project.istanza.project_id
  name        = "(default)"
  location_id = var.regione
  type        = "FIRESTORE_NATIVE"
  depends_on  = [google_firebase_project.firebase]
}

resource "google_firebase_web_app" "app" {
  provider     = google-beta
  project      = google_project.istanza.project_id
  display_name = local.progetto
  depends_on   = [google_firebase_project.firebase]
}

data "google_firebase_web_app_config" "app" {
  provider   = google-beta
  project    = google_project.istanza.project_id
  web_app_id = google_firebase_web_app.app.app_id
}

resource "google_firebase_hosting_site" "sito" {
  provider = google-beta
  project  = google_project.istanza.project_id
  site_id  = local.progetto
  app_id   = google_firebase_web_app.app.app_id
}

resource "google_identity_platform_config" "auth" {
  provider = google-beta
  project  = google_project.istanza.project_id
  sign_in {
    email {
      enabled           = true
      password_required = true
    }
  }
  depends_on = [google_project_service.api]
}

# Il service account del deploy (come quello della Tana, docs/functions.md):
# pubblica hosting, functions e regole dal workflow.
resource "google_service_account" "deploy" {
  provider     = google-beta
  project      = google_project.istanza.project_id
  account_id   = "deploy"
  display_name = "Deploy dal workflow"
}

resource "google_project_iam_member" "deploy" {
  provider = google-beta
  for_each = toset([
    "roles/firebase.admin",
    "roles/cloudfunctions.admin",
    "roles/run.admin",
    "roles/iam.serviceAccountUser",
    "roles/serviceusage.serviceUsageConsumer",
    "roles/storage.admin",
  ])
  project = google_project.istanza.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Quello che il workflow mette nel .env della build (VITE_FIREBASE_*).
output "config_web" {
  value = {
    VITE_FIREBASE_API_KEY             = data.google_firebase_web_app_config.app.api_key
    VITE_FIREBASE_AUTH_DOMAIN         = data.google_firebase_web_app_config.app.auth_domain
    VITE_FIREBASE_PROJECT_ID          = google_project.istanza.project_id
    VITE_FIREBASE_STORAGE_BUCKET      = lookup(data.google_firebase_web_app_config.app, "storage_bucket", "")
    VITE_FIREBASE_MESSAGING_SENDER_ID = lookup(data.google_firebase_web_app_config.app, "messaging_sender_id", "")
    VITE_FIREBASE_APP_ID              = google_firebase_web_app.app.app_id
  }
  sensitive = true
}

output "deploy_service_account" {
  value = google_service_account.deploy.email
}

output "url" {
  value = "https://${google_firebase_hosting_site.sito.site_id}.web.app"
}
