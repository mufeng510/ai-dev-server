# syntax=docker/dockerfile:1.10

ARG UBUNTU_VERSION
ARG UBUNTU_DIGEST
ARG NODE_VERSION
ARG PNPM_VERSION
ARG BUN_VERSION
ARG UV_VERSION
ARG GO_VERSION
ARG RUST_VERSION
ARG JDK_VERSION
ARG CLAUDE_CODE_VERSION
ARG CLAUDE_AMD64_SHA256
ARG CLAUDE_ARM64_SHA256
ARG CODEX_VERSION
ARG CODEX_INSTALLER_SHA256
ARG GH_VERSION
ARG GH_AMD64_SHA256
ARG GH_ARM64_SHA256
ARG OMC_VERSION
ARG OMX_VERSION
ARG OPENCODE_VERSION
ARG OPENCODE_AMD64_SHA256
ARG OPENCODE_ARM64_SHA256
ARG OMO_VERSION
ARG GROK_VERSION
ARG GROK_AMD64_SHA256
ARG GROK_ARM64_SHA256
ARG CC_SWITCH_VERSION
ARG YQ_VERSION
ARG YQ_AMD64_SHA256
ARG YQ_ARM64_SHA256
ARG CC_SWITCH_AMD64_ASSET
ARG CC_SWITCH_AMD64_SHA256
ARG CC_SWITCH_ARM64_ASSET
ARG CC_SWITCH_ARM64_SHA256
ARG CODE_SERVER_VERSION
ARG CODE_SERVER_AMD64_ASSET
ARG CODE_SERVER_AMD64_SHA256
ARG CODE_SERVER_ARM64_ASSET
ARG CODE_SERVER_ARM64_SHA256

FROM ubuntu:${UBUNTU_VERSION}@${UBUNTU_DIGEST} AS downloads

ARG TARGETARCH
ARG NODE_VERSION
ARG PNPM_VERSION
ARG BUN_VERSION
ARG UV_VERSION
ARG GO_VERSION
ARG RUST_VERSION
ARG YQ_VERSION
ARG YQ_AMD64_SHA256
ARG YQ_ARM64_SHA256
ARG GH_VERSION
ARG GH_AMD64_SHA256
ARG GH_ARM64_SHA256

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl unzip xz-utils && rm -rf /var/lib/apt/lists/*
COPY install/install-languages.sh /usr/local/libexec/install-languages.sh
RUN TARGETARCH="${TARGETARCH}" \
    NODE_VERSION="${NODE_VERSION}" \
    PNPM_VERSION="${PNPM_VERSION}" \
    BUN_VERSION="${BUN_VERSION}" \
    UV_VERSION="${UV_VERSION}" \
    GO_VERSION="${GO_VERSION}" \
    RUST_VERSION="${RUST_VERSION}" \
    YQ_VERSION="${YQ_VERSION}" \
    YQ_AMD64_SHA256="${YQ_AMD64_SHA256}" \
    YQ_ARM64_SHA256="${YQ_ARM64_SHA256}" \
    bash /usr/local/libexec/install-languages.sh download
RUN case "${TARGETARCH}" in \
      amd64) gh_asset="gh_${GH_VERSION}_linux_amd64.deb"; gh_sha="${GH_AMD64_SHA256}" ;; \
      arm64) gh_asset="gh_${GH_VERSION}_linux_arm64.deb"; gh_sha="${GH_ARM64_SHA256}" ;; \
      *) exit 1 ;; \
    esac && \
    curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
      --output "/opt/downloads/${gh_asset}" "https://github.com/cli/cli/releases/download/v${GH_VERSION}/${gh_asset}" && \
    printf '%s  %s\n' "${gh_sha}" "/opt/downloads/${gh_asset}" | sha256sum --check --status

FROM ubuntu:${UBUNTU_VERSION}@${UBUNTU_DIGEST} AS general

ARG TARGETARCH
ARG DEV_UID=1000
ARG DEV_GID=1000
ARG NODE_VERSION
ARG PNPM_VERSION
ARG BUN_VERSION
ARG UV_VERSION
ARG GO_VERSION
ARG RUST_VERSION
ARG JDK_VERSION
ARG CLAUDE_CODE_VERSION
ARG CLAUDE_AMD64_SHA256
ARG CLAUDE_ARM64_SHA256
ARG CODEX_VERSION
ARG CODEX_INSTALLER_SHA256
ARG OMC_VERSION
ARG OMX_VERSION
ARG OPENCODE_VERSION
ARG OPENCODE_AMD64_SHA256
ARG OPENCODE_ARM64_SHA256
ARG OMO_VERSION
ARG GROK_VERSION
ARG GROK_AMD64_SHA256
ARG GROK_ARM64_SHA256
ARG CC_SWITCH_VERSION
ARG YQ_VERSION
ARG YQ_AMD64_SHA256
ARG YQ_ARM64_SHA256

ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    DEBIAN_FRONTEND=noninteractive \
    PATH=/opt/cargo/bin:/usr/local/go/bin:/home/dev/.local/bin:${PATH} \
    CARGO_HOME=/opt/cargo \
    RUSTUP_HOME=/opt/rustup \
    DISABLE_UPDATES=1 \
    XDG_CACHE_HOME=/data/cache \
    npm_config_cache=/data/cache/npm \
    PNPM_STORE_DIR=/data/cache/pnpm \
    BUN_INSTALL_CACHE_DIR=/data/cache/bun \
    UV_CACHE_DIR=/data/cache/uv \
    GOCACHE=/data/cache/go-build \
    GOMODCACHE=/data/cache/go-mod \
    PIP_CACHE_DIR=/data/cache/pip \
    GRADLE_USER_HOME=/data/cache/gradle \
    npm_config_update_notifier=false \
    PNPM_DISABLE_SELF_UPDATE_CHECK=1 \
    BUN_INSTALL=/usr/local

COPY install/ /usr/local/libexec/ai-dev-install/
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    DEV_UID="${DEV_UID}" DEV_GID="${DEV_GID}" JDK_VERSION="${JDK_VERSION}" \
    bash /usr/local/libexec/ai-dev-install/install-base.sh

COPY --from=downloads /opt/downloads/ /opt/downloads/
RUN dpkg --install /opt/downloads/gh_*.deb && gh --version | grep -F "${GH_VERSION}" >/dev/null
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
    --mount=type=cache,target=/root/.cache/uv,sharing=locked \
    --mount=type=cache,target=/root/.cache/go-build,sharing=locked \
    --mount=type=cache,target=/go/pkg/mod,sharing=locked \
    --mount=type=cache,target=/opt/cargo/registry,sharing=locked \
    --mount=type=cache,target=/opt/cargo/git,sharing=locked \
    TARGETARCH="${TARGETARCH}" \
    NODE_VERSION="${NODE_VERSION}" \
    PNPM_VERSION="${PNPM_VERSION}" \
    BUN_VERSION="${BUN_VERSION}" \
    UV_VERSION="${UV_VERSION}" \
    GO_VERSION="${GO_VERSION}" \
    RUST_VERSION="${RUST_VERSION}" \
    YQ_VERSION="${YQ_VERSION}" \
    YQ_AMD64_SHA256="${YQ_AMD64_SHA256}" \
    YQ_ARM64_SHA256="${YQ_ARM64_SHA256}" \
    bash /usr/local/libexec/ai-dev-install/install-languages.sh install

WORKDIR /workspace
USER root

FROM general AS runtime

ARG TARGETARCH
ARG CLAUDE_CODE_VERSION
ARG CLAUDE_AMD64_SHA256
ARG CLAUDE_ARM64_SHA256
ARG CODEX_VERSION
ARG CODEX_INSTALLER_SHA256
ARG OMC_VERSION
ARG OMX_VERSION
ARG OPENCODE_VERSION
ARG OPENCODE_AMD64_SHA256
ARG OPENCODE_ARM64_SHA256
ARG OMO_VERSION
ARG GROK_VERSION
ARG GROK_AMD64_SHA256
ARG GROK_ARM64_SHA256
ARG CC_SWITCH_VERSION
ARG CC_SWITCH_AMD64_ASSET
ARG CC_SWITCH_AMD64_SHA256
ARG CC_SWITCH_ARM64_ASSET
ARG CC_SWITCH_ARM64_SHA256
ARG CODE_SERVER_VERSION
ARG CODE_SERVER_AMD64_ASSET
ARG CODE_SERVER_AMD64_SHA256
ARG CODE_SERVER_ARM64_ASSET
ARG CODE_SERVER_ARM64_SHA256

# The AI lane owns this installer; all its versions remain explicit build inputs here.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    --mount=type=cache,target=/opt/cargo/registry,sharing=locked \
    --mount=type=cache,target=/opt/cargo/git,sharing=locked \
    TARGETARCH="${TARGETARCH}" \
    CLAUDE_CODE_VERSION="${CLAUDE_CODE_VERSION}" \
    CLAUDE_AMD64_SHA256="${CLAUDE_AMD64_SHA256}" \
    CLAUDE_ARM64_SHA256="${CLAUDE_ARM64_SHA256}" \
    CODEX_VERSION="${CODEX_VERSION}" \
    CODEX_INSTALLER_SHA256="${CODEX_INSTALLER_SHA256}" \
    OMC_VERSION="${OMC_VERSION}" \
    OMX_VERSION="${OMX_VERSION}" \
    OPENCODE_VERSION="${OPENCODE_VERSION}" \
    OPENCODE_AMD64_SHA256="${OPENCODE_AMD64_SHA256}" \
    OPENCODE_ARM64_SHA256="${OPENCODE_ARM64_SHA256}" \
    OMO_VERSION="${OMO_VERSION}" \
    GROK_VERSION="${GROK_VERSION}" \
    GROK_AMD64_SHA256="${GROK_AMD64_SHA256}" \
    GROK_ARM64_SHA256="${GROK_ARM64_SHA256}" \
    CC_SWITCH_VERSION="${CC_SWITCH_VERSION}" \
    CC_SWITCH_AMD64_ASSET="${CC_SWITCH_AMD64_ASSET}" \
    CC_SWITCH_AMD64_SHA256="${CC_SWITCH_AMD64_SHA256}" \
    CC_SWITCH_ARM64_ASSET="${CC_SWITCH_ARM64_ASSET}" \
    CC_SWITCH_ARM64_SHA256="${CC_SWITCH_ARM64_SHA256}" \
    sh /usr/local/libexec/ai-dev-install/install-ai-tools.sh

RUN TARGETARCH="${TARGETARCH}" \
    CODE_SERVER_VERSION="${CODE_SERVER_VERSION}" \
    CODE_SERVER_AMD64_ASSET="${CODE_SERVER_AMD64_ASSET}" \
    CODE_SERVER_AMD64_SHA256="${CODE_SERVER_AMD64_SHA256}" \
    CODE_SERVER_ARM64_ASSET="${CODE_SERVER_ARM64_ASSET}" \
    CODE_SERVER_ARM64_SHA256="${CODE_SERVER_ARM64_SHA256}" \
    sh /usr/local/libexec/ai-dev-install/install-code-server.sh

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY versions.env /usr/local/share/ai-dev/versions.env
COPY config/managed-routes.tsv /usr/local/share/ai-dev/managed-routes.tsv
COPY config/tmux.conf config/zshrc /usr/local/share/ai-dev/defaults/
COPY scripts/ai-dev-runtime /usr/local/libexec/ai-dev-runtime
COPY scripts/ai-dev scripts/ai-dev-run scripts/ai-dev-shell scripts/ai-dev-idle \
     scripts/ai-dev-health scripts/ai-dev-readiness scripts/ai-dev-doctor \
     scripts/ai-dev-migrate scripts/ai-dev-rollback scripts/ai-dev-migrate-identity \
     /usr/local/bin/
RUN chmod 0755 /usr/local/bin/entrypoint.sh /usr/local/bin/ai-dev* && \
    chmod 0644 /usr/local/libexec/ai-dev-runtime \
      /usr/local/share/ai-dev/managed-routes.tsv \
      /usr/local/share/ai-dev/versions.env \
      /usr/local/share/ai-dev/defaults/tmux.conf \
      /usr/local/share/ai-dev/defaults/zshrc

ENV PUID=1000 \
    PGID=1000 \
    AI_DEV_CONFIG_SCHEMA=1

WORKDIR /workspace
USER root
ENTRYPOINT ["tini", "-g", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["/usr/local/bin/ai-dev-idle"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["/usr/local/bin/ai-dev-health"]
