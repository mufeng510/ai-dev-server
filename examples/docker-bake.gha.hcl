# Merge after docker-bake.hcl in GitHub Actions to select the remote cache backend:
# docker buildx bake -f docker-bake.hcl -f examples/docker-bake.gha.hcl image
variable "CACHE_FROM" {
  default = "type=gha,scope=ai-dev"
}

variable "CACHE_TO" {
  default = "type=gha,scope=ai-dev,mode=max"
}
