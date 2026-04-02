# ─────────────────────────────────────────────────────────────
# Service Account: API (Cloud Run API service)
# ─────────────────────────────────────────────────────────────
resource "google_service_account" "api" {
  account_id   = "resilipath-api"
  display_name = "ResiliPath API Service Account"
  description  = "Used by the Cloud Run API service"

  # If this service account was created manually before Terraform,
  # import it first:
  #   terraform import google_service_account.api \
  #     projects/YOUR_PROJECT_ID/serviceAccounts/resilipath-api@YOUR_PROJECT_ID.iam.gserviceaccount.com
}

resource "google_project_iam_member" "api_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_tasks" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_firebase_auth" {
  project = var.project_id
  role    = "roles/firebaseauth.admin"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# ─────────────────────────────────────────────────────────────
# Service Account: Worker
# ─────────────────────────────────────────────────────────────
resource "google_service_account" "worker" {
  account_id   = "resilipath-worker"
  display_name = "ResiliPath Worker Service Account"
  description  = "Used by the Cloud Run worker service"
}

resource "google_project_iam_member" "worker_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_project_iam_member" "worker_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_project_iam_member" "worker_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_project_iam_member" "worker_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

# ─────────────────────────────────────────────────────────────
# Service Account: CI/CD (GitHub Actions)
# ─────────────────────────────────────────────────────────────
resource "google_service_account" "cicd" {
  account_id   = "resilipath-cicd"
  display_name = "ResiliPath CI/CD Service Account"
  description  = "Used by GitHub Actions to deploy Cloud Run services"
}

resource "google_project_iam_member" "cicd_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

resource "google_project_iam_member" "cicd_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

resource "google_project_iam_member" "cicd_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

resource "google_project_iam_member" "cicd_firebase_deploy" {
  project = var.project_id
  role    = "roles/firebase.admin"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

# ─────────────────────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────────────────────
output "api_service_account_email" {
  value = google_service_account.api.email
}

output "worker_service_account_email" {
  value = google_service_account.worker.email
}

output "cicd_service_account_email" {
  value = google_service_account.cicd.email
}
