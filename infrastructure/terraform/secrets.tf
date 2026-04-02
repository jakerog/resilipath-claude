# ─────────────────────────────────────────────────────────────
# Secret Manager
# Stores all sensitive configuration values
# ─────────────────────────────────────────────────────────────

# Firebase Admin SDK service account key (JSON)
resource "google_secret_manager_secret" "firebase_service_account" {
  secret_id = "firebase-service-account-key"
  replication {
    auto {}
  }
}

# Resend API key
resource "google_secret_manager_secret" "resend_api_key" {
  secret_id = "resend-api-key"
  replication {
    auto {}
  }
}

# Store the Resend API key value from variable
resource "google_secret_manager_secret_version" "resend_api_key_value" {
  secret      = google_secret_manager_secret.resend_api_key.id
  secret_data = var.resend_api_key
}

# Firebase Realtime Database URL
resource "google_secret_manager_secret" "firebase_realtime_db_url" {
  secret_id = "firebase-realtime-db-url"
  replication {
    auto {}
  }
}

# Bridge token signing secret (random — used to sign shareable Bridge URLs)
resource "google_secret_manager_secret" "bridge_token_secret" {
  secret_id = "bridge-token-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "bridge_token_secret_value" {
  secret = google_secret_manager_secret.bridge_token_secret.id
  # Generate a random 32-byte hex string as the signing secret
  secret_data = random_id.bridge_secret.hex
}

resource "random_id" "bridge_secret" {
  byte_length = 32
}

# ─────────────────────────────────────────────────────────────
# Outputs — secret resource IDs for reference in Cloud Run env
# ─────────────────────────────────────────────────────────────
output "secret_firebase_sa_id" {
  value = google_secret_manager_secret.firebase_service_account.secret_id
}

output "secret_resend_api_key_id" {
  value = google_secret_manager_secret.resend_api_key.secret_id
}
