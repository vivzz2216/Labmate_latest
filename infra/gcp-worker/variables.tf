variable "enabled" {
  type    = bool
  default = false
}
variable "project_id" {
  type    = string
  default = ""
}
variable "ssh_source_ranges" {
  type    = list(string)
  default = []
}
variable "bundle_url" {
  type      = string
  default   = ""
  sensitive = true
}
variable "bundle_sha256" {
  type    = string
  default = ""
}
variable "worker_public_key" {
  type    = string
  default = ""
}
variable "operator_public_key" {
  type    = string
  default = ""
}
