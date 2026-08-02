#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
download_dir="${DOWNLOAD_DIR:-/opt/downloads}"

: "${TARGETARCH:?TARGETARCH is required}"
: "${NODE_VERSION:?NODE_VERSION is required}"
: "${PNPM_VERSION:?PNPM_VERSION is required}"
: "${BUN_VERSION:?BUN_VERSION is required}"
: "${UV_VERSION:?UV_VERSION is required}"
: "${GO_VERSION:?GO_VERSION is required}"
: "${RUST_VERSION:?RUST_VERSION is required}"
: "${YQ_VERSION:?YQ_VERSION is required}"

case "${TARGETARCH}" in
  amd64)
    node_arch="x64"
    bun_arch="x64"
    uv_arch="x86_64"
    rust_arch="x86_64"
    yq_arch="amd64"
    ;;
  arm64)
    node_arch="arm64"
    bun_arch="aarch64"
    uv_arch="aarch64"
    rust_arch="aarch64"
    yq_arch="arm64"
    ;;
  *)
    echo "unsupported TARGETARCH: ${TARGETARCH}" >&2
    exit 64
    ;;
esac

node_asset="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
bun_asset="bun-linux-${bun_arch}.zip"
uv_asset="uv-${uv_arch}-unknown-linux-gnu.tar.gz"
go_asset="go${GO_VERSION}.linux-${TARGETARCH}.tar.gz"
rust_asset="rustup-init-${rust_arch}-unknown-linux-gnu"
yq_asset="yq_linux_${yq_arch}"

download_and_verify_sidecar() {
  local url="$1"
  local destination="$2"
  local expected
  local actual
  curl -fsSL --retry 5 --retry-all-errors -o "${destination}" "${url}"
  curl -fsSL --retry 5 --retry-all-errors -o "${destination}.sha256" "${url}.sha256"
  expected="$(awk 'NR == 1 { print $1 }' "${destination}.sha256")"
  actual="$(sha256sum "${destination}" | awk '{ print $1 }')"
  test "${actual}" = "${expected}"
}

download_and_verify_go() {
  local url="$1"
  local destination="$2"
  local asset
  local expected
  local actual

  asset="$(basename "${destination}")"
  curl -fsSL --retry 5 --retry-all-errors -o "${destination}" "${url}"
  expected="$(curl -fsSL --retry 5 --retry-all-errors 'https://go.dev/dl/?mode=json&include=all' \
    | awk -F '"' -v asset="${asset}" '
      $0 ~ "\\\"filename\\\": \\\"" asset "\\\"" { found = 1; next }
      found && $0 ~ /"sha256"/ && !printed { print $4; printed = 1 }
    ')"
  test -n "${expected}"
  actual="$(sha256sum "${destination}" | awk '{ print $1 }')"
  test "${actual}" = "${expected}"
}

download() {
  install -d -m 0755 "${download_dir}"

  curl -fsSL --retry 5 --retry-all-errors \
    -o "${download_dir}/${node_asset}" \
    "https://nodejs.org/dist/v${NODE_VERSION}/${node_asset}"
  curl -fsSL --retry 5 --retry-all-errors \
    -o "${download_dir}/node-SHASUMS256.txt" \
    "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
  (cd "${download_dir}" && grep " ${node_asset}\$" node-SHASUMS256.txt | sha256sum -c -)

  curl -fsSL --retry 5 --retry-all-errors \
    -o "${download_dir}/${bun_asset}" \
    "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${bun_asset}"
  curl -fsSL --retry 5 --retry-all-errors \
    -o "${download_dir}/bun-SHASUMS256.txt" \
    "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/SHASUMS256.txt"
  (cd "${download_dir}" && grep " ${bun_asset}\$" bun-SHASUMS256.txt | sha256sum -c -)

  printf '%s\n' "downloading ${uv_asset}"
  download_and_verify_sidecar \
    "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${uv_asset}" \
    "${download_dir}/${uv_asset}"
  printf '%s\n' "downloading ${go_asset}"
  download_and_verify_go \
    "https://go.dev/dl/${go_asset}" \
    "${download_dir}/${go_asset}"
  printf '%s\n' "downloading ${rust_asset}"
  download_and_verify_sidecar \
    "https://static.rust-lang.org/rustup/dist/${rust_arch}-unknown-linux-gnu/rustup-init" \
    "${download_dir}/${rust_asset}"

  printf '%s\n' "downloading ${yq_asset}"
  curl -fsSL --retry 5 --retry-all-errors \
    -o "${download_dir}/${yq_asset}" \
    "https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/${yq_asset}"
  curl -fsSL --retry 5 --retry-all-errors \
    -o "${download_dir}/yq-checksums" \
    "https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/checksums"
  yq_checksum="$(awk -v asset="${yq_asset}" '$2 == asset { print $1; exit }' "${download_dir}/yq-checksums")"
  test -n "${yq_checksum}"
  printf '%s  %s\n' "${yq_checksum}" "${yq_asset}" | (cd "${download_dir}" && sha256sum -c -)
}

install_toolchains() {
  tar -xJf "${download_dir}/${node_asset}" -C /usr/local --strip-components=1
  npm install --global "pnpm@${PNPM_VERSION}"

  unzip -q "${download_dir}/${bun_asset}" -d /tmp/bun
  install -m 0755 "/tmp/bun/bun-linux-${bun_arch}/bun" /usr/local/bin/bun
  ln -sf /usr/local/bin/bun /usr/local/bin/bunx

  tar -xzf "${download_dir}/${uv_asset}" -C /tmp
  install -m 0755 "/tmp/uv-${uv_arch}-unknown-linux-gnu/uv" /usr/local/bin/uv
  install -m 0755 "/tmp/uv-${uv_arch}-unknown-linux-gnu/uvx" /usr/local/bin/uvx

  rm -rf /usr/local/go
  tar -xzf "${download_dir}/${go_asset}" -C /usr/local

  install -m 0755 "${download_dir}/${rust_asset}" /tmp/rustup-init
  RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo /tmp/rustup-init \
    -y --no-modify-path --profile minimal --default-toolchain "${RUST_VERSION}"
  chmod -R a+rX /opt/rustup /opt/cargo

  install -m 0755 "${download_dir}/${yq_asset}" /usr/local/bin/yq
  rm -rf /tmp/bun /tmp/uv-* /tmp/rustup-init "${download_dir}"
}

case "${mode}" in
  download) download ;;
  install) install_toolchains ;;
  *)
    echo "usage: $0 {download|install}" >&2
    exit 64
    ;;
esac
