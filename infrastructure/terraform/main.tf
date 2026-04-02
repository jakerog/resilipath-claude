terraform {
  required_version = ">= 1.5.7"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  # Remote state stored in GCS — bucket created manually before terraform init
  # Run once before init:
  #   gsutil mb -p YOUR_PROJECT_ID -l us-central1 gs://resilipath-terraform-state
  #   gsutil versioning set on gs://resilipath-terraform-state
  backend "gcs" {
    bucket = "resilipath-terraform-state"
    prefix = "prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}
