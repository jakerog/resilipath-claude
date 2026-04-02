# ─────────────────────────────────────────────────────────────
# Cloud Run Services
#
# SAFE TO APPLY NOW — uses a Google-provided placeholder image
# on first deploy so Cloud Run can be created without your code.
#
# Lifecycle:
#   Step 1 (now):        terraform apply — deploys placeholder image
#   Step 2 (after 1.3):  CI/CD pushes real image → Cloud Run auto-updates
#   Step 3 (optional):   set use_placeholder = false in tfvars, re-apply
#                        to switch Terraform tracking to your real image
# ─────────────────────────────────────────────────────────────

# When true: uses Google's hello-world placeholder so Cloud Run
# can be provisioned before your code exists.
# When false: uses your real images from Artifact Registry.
variable "use_placeholder_image" {
  type        = bool
  description = "Use Google placeholder image. Set true on first apply, false after CI/CD has pushed real images."
  default     = true
}

locals {
  # Google's official placeholder — always available, no auth needed
  placeholder_image = "us-docker.pkg.dev/cloudrun/container/hello:latest"

  api_image    = var.use_placeholder_image ? local.placeholder_image : "${var.region}-docker.pkg.dev/${var.project_id}/resilipath/api:latest"
  worker_image = var.use_placeholder_image ? local.placeholder_image : "${var.region}-docker.pkg.dev/${var.project_id}/resilipath/worker:latest"
}

# Worker URL is populated after first worker deploy and stored as a variable.
# On first apply: leave worker_url_override empty — update after worker is deployed.
variable "worker_url_override" {
  type        = string
  description = "Cloud Run Worker service URL. Set after first worker deploy. Leave empty on first apply."
  default     = ""
}

# ─────────────────────────────────────────────────────────────
# Worker Service — Deploy this FIRST
# ─────────────────────────────────────────────────────────────
resource "google_cloud_run_v2_service" "worker" {
  name     = "resilipath-worker"
  location = var.region

  template {
    service_account = google_service_account.worker.email

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image = local.worker_image

      # NOTE: Do NOT set PORT — Cloud Run reserves this and sets it automatically.

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
        cpu_idle          = false
        startup_cpu_boost = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "STORAGE_BUCKET"
        value = google_storage_bucket.app_storage.name
      }

      # Secret env vars are only attached when NOT using the placeholder image.
      # The placeholder (Google hello-world) doesn't read any env vars, so
      # attaching secrets it can't access causes Cloud Run to fail the health check.
      dynamic "env" {
        for_each = var.use_placeholder_image ? [] : [1]
        content {
          name = "FIREBASE_SERVICE_ACCOUNT_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.firebase_service_account.secret_id
              version = "latest"
            }
          }
        }
      }

      dynamic "env" {
        for_each = var.use_placeholder_image ? [] : [1]
        content {
          name = "RESEND_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.resend_api_key.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_iam_member.worker_firestore,
    google_project_iam_member.worker_secrets,
    google_project_iam_member.worker_storage,
  ]
}

# ─────────────────────────────────────────────────────────────
# API Service — Deploy AFTER worker (needs worker URL)
# ─────────────────────────────────────────────────────────────
resource "google_cloud_run_v2_service" "api" {
  name     = "resilipath-api"
  location = var.region

  template {
    service_account = google_service_account.api.email

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image = local.api_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      # NOTE: PORT is reserved — do not set it. Cloud Run injects it automatically.

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "STORAGE_BUCKET"
        value = google_storage_bucket.app_storage.name
      }
      env {
        name  = "WORKER_URL"
        value = var.worker_url_override != "" ? var.worker_url_override : google_cloud_run_v2_service.worker.uri
      }

      # Secret env vars only attached when using real images.
      # Placeholder image can't access secrets and fails health checks if they're missing.
      dynamic "env" {
        for_each = var.use_placeholder_image ? [] : [1]
        content {
          name = "FIREBASE_SERVICE_ACCOUNT_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.firebase_service_account.secret_id
              version = "latest"
            }
          }
        }
      }
      dynamic "env" {
        for_each = var.use_placeholder_image ? [] : [1]
        content {
          name = "RESEND_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.resend_api_key.secret_id
              version = "latest"
            }
          }
        }
      }
      dynamic "env" {
        for_each = var.use_placeholder_image ? [] : [1]
        content {
          name = "BRIDGE_TOKEN_SECRET"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.bridge_token_secret.secret_id
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  depends_on = [
    google_project_iam_member.api_firestore,
    google_project_iam_member.api_secrets,
    google_cloud_run_v2_service.worker,
  ]
}

# Make API publicly accessible (JWT auth enforced in application code)
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = google_cloud_run_v2_service.api.project
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Worker only callable by service accounts (not public)
resource "google_cloud_run_v2_service_iam_member" "worker_tasks_invoker" {
  project  = google_cloud_run_v2_service.worker.project
  location = google_cloud_run_v2_service.worker.location
  name     = google_cloud_run_v2_service.worker.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.worker.email}"
}

# ─────────────────────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────────────────────
output "api_url" {
  value       = google_cloud_run_v2_service.api.uri
  description = "Set as VITE_API_BASE_URL in Vercel environment variables"
}

output "worker_url" {
  value       = google_cloud_run_v2_service.worker.uri
  description = "Set as worker_url_override in terraform.tfvars after first worker deploy"
}
