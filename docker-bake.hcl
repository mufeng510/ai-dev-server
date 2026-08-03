variable "REGISTRY" {
  default = "docker.io"
}

variable "IMAGE" {
  default = "jerry0510/ai-dev"
}

variable "TAG" {
  default = "latest"
}

variable "CACHE_FROM" {
  default = "type=local,src=.buildx-cache"
}

variable "CACHE_TO" {
  default = "type=local,dest=.buildx-cache-new,mode=max"
}

variable "SOURCE_REPOSITORY" {
  default = ""
}

variable "REVISION" {
  default = "unknown"
}

variable "CREATED" {
  default = ""
}

variable "OUTPUT" {
  default = ""
}

variable "OPERATION_ID" {
  default = ""
}

variable "UBUNTU_VERSION" { default = "24.04" }
variable "UBUNTU_DIGEST" { default = "sha256:353675e2a41babd526e2b837d7ec780c2a05bca0164f7ea5dbbd433d21d166fc" }
variable "NODE_VERSION" { default = "24.4.1" }
variable "PNPM_VERSION" { default = "10.13.1" }
variable "BUN_VERSION" { default = "1.2.19" }
variable "UV_VERSION" { default = "0.8.3" }
variable "GO_VERSION" { default = "1.24.5" }
variable "RUST_VERSION" { default = "1.88.0" }
variable "JDK_VERSION" { default = "21" }
variable "CLAUDE_CODE_VERSION" { default = "1.0.58" }
variable "CLAUDE_AMD64_SHA256" { default = "9f35ec9379079a36fb3597df06a0c2842e88fae4bd7f314edaea50068c65b1c5" }
variable "CLAUDE_ARM64_SHA256" { default = "df7ef4007ca58313266505c32d684817a8e83b607c9e1b78b3a08a2842058023" }
variable "CODEX_VERSION" { default = "0.146.0" }
variable "CODEX_INSTALLER_SHA256" { default = "ba92dd27e5c06f0d3bbc58bfa4b9cfb6599cd2742fbb1f92a2765e6c07dedb5a" }
variable "GH_VERSION" { default = "2.97.0" }
variable "GH_AMD64_SHA256" { default = "7c7fa3bb890db0934baf65910d97b8c0fa437b2e590f7f7daf6bdf82c5c486d7" }
variable "GH_ARM64_SHA256" { default = "0ba7a76739c865d82ebde24667d875d9b8caa55db47c7597c24accdd4defd2bb" }
variable "OMC_VERSION" { default = "4.2.8" }
variable "OMX_VERSION" { default = "0.20.3" }
variable "CC_SWITCH_VERSION" { default = "5.9.3" }
variable "YQ_VERSION" { default = "4.47.1" }
variable "YQ_AMD64_SHA256" { default = "0fb28c6680193c41b364193d0c0fc4a03177aecde51cfc04d506b1517158c2fb" }
variable "YQ_ARM64_SHA256" { default = "b7f7c991abe262b0c6f96bbcb362f8b35429cefd59c8b4c2daa4811f1e9df599" }
variable "CC_SWITCH_AMD64_ASSET" { default = "cc-switch-cli-v5.9.3-linux-x64-musl.tar.gz" }
variable "CC_SWITCH_AMD64_SHA256" { default = "a581ec26efda795182949243665ea725d42029c58bb4b9137d0708b255a4fb91" }
variable "CC_SWITCH_ARM64_ASSET" { default = "cc-switch-cli-v5.9.3-linux-arm64-musl.tar.gz" }
variable "CC_SWITCH_ARM64_SHA256" { default = "b733f613b32bbb37af3fedd4703c3431da12d346e94bc55af791b134545ebd07" }

group "default" {
  targets = ["image"]
}

group "check" {
  targets = ["validate", "test"]
}

target "common" {
  context    = "."
  dockerfile = "Dockerfile"
  platforms  = ["linux/amd64", "linux/arm64"]
  args = {
    UBUNTU_VERSION            = UBUNTU_VERSION
    UBUNTU_DIGEST             = UBUNTU_DIGEST
    NODE_VERSION              = NODE_VERSION
    PNPM_VERSION              = PNPM_VERSION
    BUN_VERSION               = BUN_VERSION
    UV_VERSION                = UV_VERSION
    GO_VERSION                = GO_VERSION
    RUST_VERSION              = RUST_VERSION
    JDK_VERSION               = JDK_VERSION
    CLAUDE_CODE_VERSION       = CLAUDE_CODE_VERSION
    CLAUDE_AMD64_SHA256       = CLAUDE_AMD64_SHA256
    CLAUDE_ARM64_SHA256       = CLAUDE_ARM64_SHA256
    CODEX_VERSION             = CODEX_VERSION
    CODEX_INSTALLER_SHA256    = CODEX_INSTALLER_SHA256
    GH_VERSION                = GH_VERSION
    GH_AMD64_SHA256           = GH_AMD64_SHA256
    GH_ARM64_SHA256           = GH_ARM64_SHA256
    OMC_VERSION               = OMC_VERSION
    OMX_VERSION               = OMX_VERSION
    CC_SWITCH_VERSION         = CC_SWITCH_VERSION
    YQ_VERSION                = YQ_VERSION
    YQ_AMD64_SHA256           = YQ_AMD64_SHA256
    YQ_ARM64_SHA256           = YQ_ARM64_SHA256
    CC_SWITCH_AMD64_ASSET     = CC_SWITCH_AMD64_ASSET
    CC_SWITCH_AMD64_SHA256    = CC_SWITCH_AMD64_SHA256
    CC_SWITCH_ARM64_ASSET     = CC_SWITCH_ARM64_ASSET
    CC_SWITCH_ARM64_SHA256    = CC_SWITCH_ARM64_SHA256
  }
  labels = {
    "org.opencontainers.image.title"       = "ai-dev"
    "org.opencontainers.image.description" = "Ubuntu AI development environment"
    "org.opencontainers.image.source"      = SOURCE_REPOSITORY
    "org.opencontainers.image.revision"    = REVISION
    "org.opencontainers.image.version"     = TAG
    "org.opencontainers.image.created"     = CREATED
    "org.opencontainers.image.licenses"    = "MIT"
    "org.opencontainers.image.operation_id" = OPERATION_ID
  }
  cache-from = [CACHE_FROM]
  cache-to   = [CACHE_TO]
}

target "general" {
  inherits = ["common"]
  target   = "general"
}

target "image" {
  inherits = ["common"]
  target   = "runtime"
  tags     = ["${REGISTRY}/${IMAGE}:${TAG}"]
  output   = OUTPUT == "" ? [] : [OUTPUT]
  attest   = ["type=sbom", "type=provenance,mode=max"]
}

target "test" {
  inherits  = ["common"]
  target    = "runtime"
  platforms = ["linux/amd64"]
  output    = ["type=docker"]
  tags      = ["ai-dev:test"]
}

target "validate" {
  inherits  = ["common"]
  target    = "downloads"
  platforms = ["linux/amd64"]
  output    = ["type=cacheonly"]
}
