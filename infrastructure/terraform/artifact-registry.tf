# ─────────────────────────────────────────────────────────────
# Artifact Registry — Docker image repository
# Images are pushed here by GitHub Actions, pulled by Cloud Run
# ─────────────────────────────────────────────────────────────
resource "google_artifact_registry_repository" "resilipath" {
  location      = var.region
  repository_id = "resilipath"
  description   = "Docker images for ResiliPath API and Worker services"
  format        = "DOCKER"
}

output "artifact_registry_url" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/resilipath"
  description = "Base URL for Docker images — used in CI/CD and Cloud Run"
}
