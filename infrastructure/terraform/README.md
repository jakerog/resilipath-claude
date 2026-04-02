# ResiliPath — Terraform Infrastructure

## How It Works

Cloud Run requires a Docker image to exist before the service can be created.
Since your application code doesn't exist yet, Terraform uses Google's official
`us-docker.pkg.dev/cloudrun/container/hello:latest` placeholder image.

This means you can provision all infrastructure **right now**, and CI/CD will
swap the placeholder for your real image automatically when code is built later.

---

## Errors Fixed (history)

| Error | Fix Applied |
|-------|------------|
| `PORT is a reserved env name` | Removed all PORT env vars — Cloud Run sets this automatically |
| `Service account already exists` | Use `terraform import` commands before apply (see below) |
| `domain ownership required for .appspot.com` | Changed bucket name away from `.appspot.com` format |
| `Image not found` | Now uses Google placeholder image — no real image needed on first apply |

---

## Step 1 — One-time setup (run once, right now)

### 1a. Create Terraform state bucket
```bash
gsutil mb -p resilipath-prod -l us-central1 gs://resilipath-terraform-state
gsutil versioning set on gs://resilipath-terraform-state
```

### 1b. Copy and fill in your variables
```bash
cp terraform.tfvars.example terraform.tfvars
# Open terraform.tfvars and fill in your project_id and resend_api_key
```

### 1c. Initialize Terraform
```bash
terraform init
```

### 1d. Import service accounts that already exist
If you created service accounts manually before Terraform, import them:
```bash
# Replace resilipath-prod with your actual project ID
terraform import google_service_account.api \
  "projects/resilipath-prod/serviceAccounts/resilipath-api@resilipath-prod.iam.gserviceaccount.com"

terraform import google_service_account.cicd \
  "projects/resilipath-prod/serviceAccounts/resilipath-cicd@resilipath-prod.iam.gserviceaccount.com"
```
If you get "resource not found" on the import, the accounts don't exist yet — skip this step.

---

## Step 2 — Apply everything (run now)

`use_placeholder_image = true` is set in your tfvars, so Cloud Run will deploy
the Google hello-world placeholder. No real Docker image needed.

```bash
# Deploy worker first (api depends on worker URL)
terraform apply -target=google_cloud_run_v2_service.worker \
                -target=google_cloud_run_v2_service_iam_member.worker_tasks_invoker

# Get the worker URL and add it to terraform.tfvars
terraform output worker_url
# → Copy the URL, open terraform.tfvars, set:
# worker_url_override = "https://resilipath-worker-xxxx-uc.a.run.app"

# Deploy everything else
terraform apply
```

After this completes you will have:
- ✅ All IAM service accounts with correct roles
- ✅ Artifact Registry repository ready for Docker images
- ✅ All Cloud Tasks queues
- ✅ All Secret Manager secrets
- ✅ Storage bucket with CORS
- ✅ Cloud Run API service (running placeholder — returns "Hello World")
- ✅ Cloud Run Worker service (running placeholder)

---

## Step 3 — Add secret values (manual, run now)

Two secrets need values that Terraform cannot know in advance:

### Firebase Admin SDK key
```bash
# Download from: Firebase Console → Project Settings → Service Accounts
# → "Generate new private key" → save the JSON file
gcloud secrets versions add firebase-service-account-key \
  --data-file=/path/to/downloaded-firebase-key.json
```

### Firebase Realtime Database URL
```bash
# Get from: Firebase Console → Realtime Database → copy the URL shown
# Looks like: https://resilipath-prod-default-rtdb.firebaseio.com
echo -n "https://resilipath-prod-default-rtdb.firebaseio.com" | \
  gcloud secrets versions add firebase-realtime-db-url --data-file=-
```

---

## Step 4 — Set Vercel environment variables (run now)

```bash
terraform output api_url
```

Copy the URL and add it as `VITE_API_BASE_URL` in your Vercel project settings.

---

## Step 5 — After Sub-Phase 1.3 (code exists, CI/CD runs)

When Sub-Phase 1.3 is complete, GitHub Actions will build and push real Docker
images to Artifact Registry. Cloud Run will automatically pick them up on the
next deploy — **you do not need to change Terraform for this**.

Optionally, to track the real image in Terraform state:
```bash
# In terraform.tfvars, change:
use_placeholder_image = false

# Then re-apply
terraform apply
```

---

## File Reference

| File | Purpose |
|------|---------|
| `main.tf` | Provider config, GCS backend |
| `variables.tf` | Input variable definitions |
| `iam.tf` | Service accounts and IAM role bindings |
| `artifact-registry.tf` | Docker image repository |
| `cloud-tasks.tf` | Job queues (report, email, checkin, file) |
| `secrets.tf` | Secret Manager secrets |
| `storage.tf` | GCS storage bucket with CORS |
| `outputs.tf` | Post-apply instructions |
| `cloud-run.tf` | API + Worker Cloud Run services |
| `terraform.tfvars.example` | Template — copy to `terraform.tfvars` |
| `terraform.tfvars` | **Your values — never commit to git** |
