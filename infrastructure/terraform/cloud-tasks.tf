# ─────────────────────────────────────────────────────────────
# Cloud Tasks Queues
# Free tier: 1 million tasks/month
# ─────────────────────────────────────────────────────────────

# Queue: PDF and XLSX report generation
resource "google_cloud_tasks_queue" "report_generation" {
  name     = "report-generation"
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 5
    max_dispatches_per_second = 2
  }

  retry_config {
    max_attempts       = 3
    max_retry_duration = "300s"
    min_backoff        = "10s"
    max_backoff        = "60s"
    max_doublings      = 3
  }
}

# Queue: Email delivery
resource "google_cloud_tasks_queue" "email_delivery" {
  name     = "email-delivery"
  location = var.region

  rate_limits {
    # Respect Resend free tier: 100 emails/day = ~0.001/sec
    # Set higher and let Resend rate limiting handle the actual throttle
    max_concurrent_dispatches = 10
    max_dispatches_per_second = 10
  }

  retry_config {
    max_attempts       = 3
    max_retry_duration = "600s"
    min_backoff        = "30s"
    max_backoff        = "300s"
    max_doublings      = 3
  }
}

# Queue: Check-in escalation reminders
resource "google_cloud_tasks_queue" "checkin_escalations" {
  name     = "checkin-escalations"
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 5
    max_dispatches_per_second = 5
  }

  retry_config {
    max_attempts  = 2
    min_backoff   = "60s"
    max_backoff   = "300s"
    max_doublings = 2
  }
}

# Queue: File processing (malware scan, thumbnail generation)
resource "google_cloud_tasks_queue" "file_processing" {
  name     = "file-processing"
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 10
    max_dispatches_per_second = 5
  }

  retry_config {
    max_attempts  = 3
    min_backoff   = "5s"
    max_backoff   = "60s"
    max_doublings = 3
  }
}

output "queue_report_generation_name" {
  value = google_cloud_tasks_queue.report_generation.name
}

output "queue_email_delivery_name" {
  value = google_cloud_tasks_queue.email_delivery.name
}
