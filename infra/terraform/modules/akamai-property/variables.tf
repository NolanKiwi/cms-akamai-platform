variable "environment" {
  type        = string
  description = "Deployment environment: staging or production"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production."
  }
}

variable "contract_id" {
  type        = string
  description = "Akamai contract ID (ctr_XXXXX)"
}

variable "group_id" {
  type        = string
  description = "Akamai group ID (grp_XXXXX)"
}

variable "property_name" {
  type        = string
  description = "Akamai property name"
}

variable "product_id" {
  type        = string
  default     = "prd_SPM"
  description = "Akamai product ID — verify with account team (prd_SPM = Ion Standard)"
}

variable "hostnames" {
  type        = list(string)
  description = "List of hostnames to attach to this property"
}

variable "origin_hostname" {
  type        = string
  description = "Origin hostname (load balancer DNS name)"
}

variable "origin_port" {
  type        = number
  default     = 443
  description = "Origin port"
}

variable "origin_protocol" {
  type        = string
  default     = "HTTPS"
  description = "Origin protocol: HTTP or HTTPS"
}

variable "cp_codes" {
  type        = map(string)
  description = "Map of CP code label to CP code name for provisioning"
  default     = {}
}

variable "activate_staging" {
  type        = bool
  default     = true
  description = "Whether to activate on Akamai STAGING network"
}

variable "activate_production" {
  type        = bool
  default     = false
  description = "Whether to activate on Akamai PRODUCTION network — requires staging validation"
}

variable "notification_emails" {
  type        = list(string)
  description = "Email addresses for Akamai activation notifications"
}

variable "rules_json" {
  type        = string
  description = "Full Akamai property rules JSON (PAPI format)"
}

variable "origin_shared_secret" {
  type        = string
  sensitive   = true
  description = "Shared secret header value for origin protection (fallback to Site Shield)"
  default     = ""
}
