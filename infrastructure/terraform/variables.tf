variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "GCP region for all resources"
  default     = "us-central1"
}

variable "domain_name" {
  type        = string
  description = "Primary domain e.g. resilipath.app"
  default     = "resilipath.app"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "prod"
}

variable "resend_api_key" {
  type        = string
  description = "Resend email API key"
  sensitive   = true
}

variable "firebase_rt_db_url" {
  type        = string
  description = "Firebase Realtime Database URL e.g. https://resilipath-prod-default-rtdb.firebaseio.com"
  default     = ""
}

variable "firebase_storage_bucket" {
  type        = string
  description = "Firebase Storage bucket name (leave empty — Terraform manages this)"
  default     = ""
}
