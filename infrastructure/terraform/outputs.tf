# ─────────────────────────────────────────────────────────────
# Consolidated outputs
# Run: terraform output
# to see all values needed for environment variable configuration
# ─────────────────────────────────────────────────────────────

output "setup_instructions" {
  value = <<-EOT

    ═══════════════════════════════════════════════════════
    ResiliPath Infrastructure — Setup Complete
    ═══════════════════════════════════════════════════════

    After terraform apply, set these values:

    1. GitHub Secrets (Settings → Secrets → Actions):
       GCP_PROJECT_ID         = ${var.project_id}
       GCP_REGION             = ${var.region}
       ARTIFACT_REGISTRY_URL  = ${var.region}-docker.pkg.dev/${var.project_id}/resilipath

    2. Vercel Environment Variables (project settings):
       VITE_FIREBASE_PROJECT_ID    = ${var.project_id}
       VITE_API_BASE_URL           = (set after cloud-run.tf is applied in Stage 2)

    3. Add Firebase Admin SDK key to Secret Manager:
       Go to Firebase Console → Project Settings → Service Accounts
       → Generate new private key → download JSON
       Then run:
         gcloud secrets versions add firebase-service-account-key \
           --data-file=path/to/downloaded-key.json

    4. Add Firebase Realtime DB URL to Secret Manager:
       Get URL from Firebase Console → Realtime Database
       Then run:
         echo -n "https://YOUR-PROJECT-default-rtdb.firebaseio.com" | \
           gcloud secrets versions add firebase-realtime-db-url --data-file=-

    ⚠️  STAGE 2 (after Sub-Phase 1.3 — when Docker images exist):
       terraform apply -target=google_cloud_run_v2_service.api
       terraform apply -target=google_cloud_run_v2_service.worker

    ═══════════════════════════════════════════════════════
  EOT
  description = "Post-apply setup instructions"
}
