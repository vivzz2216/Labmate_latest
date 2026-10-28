terraform {
  required_version = ">= 1.6, < 2.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = "asia-southeast1"
}

# Intentionally inactive. No resources exist unless enabled is explicitly changed.
resource "google_project_service" "compute" {
  count              = var.enabled ? 1 : 0
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "iam" {
  count              = var.enabled ? 1 : 0
  service            = "iam.googleapis.com"
  disable_on_destroy = false
}

resource "google_compute_network" "worker" {
  count                   = var.enabled ? 1 : 0
  name                    = "labmate-worker"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.compute]
}

resource "google_compute_subnetwork" "worker" {
  count         = var.enabled ? 1 : 0
  name          = "labmate-worker"
  ip_cidr_range = "10.71.0.0/24"
  region        = "asia-southeast1"
  network       = google_compute_network.worker[0].id
}

resource "google_compute_firewall" "ssh" {
  count         = var.enabled ? 1 : 0
  name          = "labmate-worker-ssh"
  network       = google_compute_network.worker[0].name
  source_ranges = var.ssh_source_ranges
  target_tags   = ["labmate-worker"]
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

resource "google_service_account" "worker" {
  count        = var.enabled ? 1 : 0
  account_id   = "labmate-runtime"
  display_name = "Isolated worker; no project IAM roles"
  depends_on   = [google_project_service.iam]
}

resource "google_compute_instance" "worker" {
  count        = var.enabled ? 1 : 0
  name         = "labmate-worker"
  machine_type = "e2-standard-2"
  zone         = "asia-southeast1-b"
  tags         = ["labmate-worker"]
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 50
      type  = "pd-balanced"
    }
  }
  network_interface {
    subnetwork = google_compute_subnetwork.worker[0].id
    access_config {}
  }
  metadata = {
    block-project-ssh-keys = "true"
    worker-bundle-url      = var.bundle_url
    worker-bundle-sha256   = var.bundle_sha256
    worker-public-key      = var.worker_public_key
    ssh-keys               = "operator:${var.operator_public_key}"
  }
  metadata_startup_script = file("${path.module}/startup.sh")
  service_account {
    email  = google_service_account.worker[0].email
    scopes = []
  }
  lifecycle {
    precondition {
      condition = !var.enabled || (length(var.project_id) > 0 && length(var.ssh_source_ranges) > 0
        && can(regex("^https://", var.bundle_url)) && can(regex("^[a-f0-9]{64}$", var.bundle_sha256))
      && startswith(var.worker_public_key, "ssh-ed25519 ") && startswith(var.operator_public_key, "ssh-ed25519 "))
      error_message = "Explicit project, SSH source ranges, HTTPS bundle with SHA256 and separate public keys are required."
    }
  }
}

output "worker_address" {
  value = var.enabled ? google_compute_instance.worker[0].network_interface[0].access_config[0].nat_ip : null
}
