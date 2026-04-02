# ─────────────────────────────────────────────────────────────
# Firebase Storage — Cloud Storage bucket
#
# FIX: We do NOT use the default Firebase bucket name
# ({project_id}.appspot.com) because GCP requires domain
# ownership verification for .appspot.com buckets managed
# outside Firebase Console.
#
# Instead we use a separate bucket with a standard name.
# Firebase Storage SDK works with any GCS bucket — we point
# it to this bucket via FIREBASE_STORAGE_BUCKET env var.
# ─────────────────────────────────────────────────────────────
resource "google_storage_bucket" "app_storage" {
  name          = "${var.project_id}-resilipath-storage"
  location      = "US"
  force_destroy = false

  # Prevent accidental public access — all files served via signed URLs only
  public_access_prevention = "enforced"

  # Keep deleted/overwritten files (evidence integrity requirement)
  versioning {
    enabled = true
  }

  # Allow browsers to upload directly via presigned URLs
  cors {
    origin = [
      "https://${var.domain_name}",
      "https://*.${var.domain_name}",
      "http://localhost:5173",
      "http://localhost:3000"
    ]
    method          = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    response_header = ["Content-Type", "Content-Length", "Content-Range", "X-Goog-Upload-Protocol"]
    max_age_seconds = 3600
  }

  # Move old evidence files to cheaper storage after 2 years
  lifecycle_rule {
    condition {
      age            = 730
      matches_prefix = ["tenants/"]
      with_state     = "LIVE"
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  # Auto-delete temporary report exports after 1 day
  lifecycle_rule {
    condition {
      age            = 1
      matches_prefix = ["exports/"]
    }
    action {
      type = "Delete"
    }
  }
}

# Grant the API service account access to read/write storage
resource "google_storage_bucket_iam_member" "api_storage_access" {
  bucket = google_storage_bucket.app_storage.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}

output "storage_bucket_name" {
  value       = google_storage_bucket.app_storage.name
  description = "Set as FIREBASE_STORAGE_BUCKET in your environment variables"
}
