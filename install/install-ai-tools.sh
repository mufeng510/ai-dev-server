#!/bin/sh

set -eu

readonly CLAUDE_RELEASE_BASE_URL="https://github.com/anthropics/claude-code/releases/download"
readonly OPENCODE_RELEASE_BASE_URL="https://github.com/anomalyco/opencode/releases/download"
readonly GROK_RELEASE_BASE_URL="https://x.ai/cli"
readonly CODEX_INSTALLER_URL="https://chatgpt.com/codex/install.sh"
readonly CC_SWITCH_REPOSITORY="SaladDay/cc-switch-cli"

fail() {
  printf 'install-ai-tools: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"
}

require_variable() {
  eval "value=\${$1:-}"
  [ -n "$value" ] || fail "required environment variable is unset: $1"
}

fetch() {
  url="$1"
  output="$2"
  curl --fail --silent --show-error --location \
    --proto '=https' --tlsv1.2 \
    --retry 5 --retry-all-errors \
    --output "$output" "$url"
}

verify_sha256() {
  file="$1"
  expected="$2"

  case "$expected" in
    ''|*[!0-9a-f]*) fail "invalid SHA-256 for $(basename "$file")" ;;
  esac
  [ "${#expected}" -eq 64 ] || fail "invalid SHA-256 length for $(basename "$file")"
  printf '%s  %s\n' "$expected" "$file" | sha256sum --check --status \
    || fail "SHA-256 verification failed for $(basename "$file")"
}

single_extracted_file() {
  directory="$1"
  filename="$2"
  found="$(find "$directory" -type f -name "$filename" -print)"
  [ -n "$found" ] || fail "archive did not contain $filename"
  [ "$(printf '%s\n' "$found" | wc -l)" -eq 1 ] \
    || fail "archive contained more than one $filename"
  printf '%s\n' "$found"
}

install_opencode() {
  case "$TARGETARCH" in
    amd64) opencode_asset=opencode-linux-x64.tar.gz; opencode_checksum=$OPENCODE_AMD64_SHA256 ;;
    arm64) opencode_asset=opencode-linux-arm64.tar.gz; opencode_checksum=$OPENCODE_ARM64_SHA256 ;;
    *) fail "unsupported TARGETARCH for OpenCode: $TARGETARCH" ;;
  esac
  archive="$work_dir/$opencode_asset"
  extract_dir="$work_dir/opencode-extract"
  fetch "$OPENCODE_RELEASE_BASE_URL/v$OPENCODE_VERSION/$opencode_asset" "$archive"
  verify_sha256 "$archive" "$opencode_checksum"
  mkdir -p "$extract_dir"
  tar -xzf "$archive" -C "$extract_dir"
  binary="$(single_extracted_file "$extract_dir" opencode)"
  install -m 0755 "$binary" "$INSTALL_PREFIX/bin/opencode"
  "$INSTALL_PREFIX/bin/opencode" --version | grep -F "$OPENCODE_VERSION" >/dev/null || fail "OpenCode version verification failed"
}

install_grok() {
  case "$TARGETARCH" in
    amd64) grok_asset=grok-${GROK_VERSION}-linux-x86_64; grok_checksum=$GROK_AMD64_SHA256 ;;
    arm64) grok_asset=grok-${GROK_VERSION}-linux-aarch64; grok_checksum=$GROK_ARM64_SHA256 ;;
    *) fail "unsupported TARGETARCH for Grok Build: $TARGETARCH" ;;
  esac
  binary="$work_dir/$grok_asset"
  fetch "$GROK_RELEASE_BASE_URL/$grok_asset" "$binary"
  verify_sha256 "$binary" "$grok_checksum"
  install -m 0755 "$binary" "$INSTALL_PREFIX/bin/grok"
  ln -sf grok "$INSTALL_PREFIX/bin/agent"
  "$INSTALL_PREFIX/bin/grok" --version | grep -F "$GROK_VERSION" >/dev/null || fail "Grok Build version verification failed"
}

install_claude() {
  case "$TARGETARCH" in
    amd64) claude_asset=claude-linux-x64.tar.gz; claude_checksum=$CLAUDE_AMD64_SHA256 ;;
    arm64) claude_asset=claude-linux-arm64.tar.gz; claude_checksum=$CLAUDE_ARM64_SHA256 ;;
    *) fail "unsupported TARGETARCH for Claude Code: $TARGETARCH" ;;
  esac
  archive="$work_dir/$claude_asset"
  extract_dir="$work_dir/claude-extract"
  fetch "$CLAUDE_RELEASE_BASE_URL/v$CLAUDE_CODE_VERSION/$claude_asset" "$archive"
  verify_sha256 "$archive" "$claude_checksum"
  mkdir -p "$extract_dir"
  tar -xzf "$archive" -C "$extract_dir"
  binary="$(single_extracted_file "$extract_dir" claude)"
  install -m 0755 "$binary" "$INSTALL_PREFIX/bin/claude"
  "$INSTALL_PREFIX/bin/claude" --version | grep -F "$CLAUDE_CODE_VERSION" >/dev/null || fail "Claude Code version verification failed"
}

install_codex() {
  installer="$work_dir/codex-install.sh"
  codex_home="$INSTALL_PREFIX/share/codex"
  fetch "$CODEX_INSTALLER_URL" "$installer"
  verify_sha256 "$installer" "$CODEX_INSTALLER_SHA256"
  mkdir -p "$codex_home"
  CODEX_HOME="$codex_home" \
  CODEX_INSTALL_DIR="$INSTALL_PREFIX/bin" \
  CODEX_NON_INTERACTIVE=1 \
  CODEX_RELEASE="$CODEX_VERSION" \
    sh "$installer" --release "$CODEX_VERSION"
  [ -x "$INSTALL_PREFIX/bin/codex" ] || fail "official Codex installer did not publish the expected binary"
}

install_node_tools() {
  npm_config_audit=false \
  npm_config_fund=false \
  npm_config_update_notifier=false \
    npm install --global --prefix "$INSTALL_PREFIX" --omit=dev \
      "oh-my-claude-sisyphus@$OMC_VERSION" \
      "oh-my-codex@$OMX_VERSION" \
      "oh-my-openagent@$OMO_VERSION"

  node -e \
    'const [path, expected] = process.argv.slice(1); const actual = require(path).version; if (actual !== expected) { throw new Error(`expected ${expected}, installed ${actual}`); }' \
    "$INSTALL_PREFIX/lib/node_modules/oh-my-claude-sisyphus/package.json" "$OMC_VERSION"
  node -e \
    'const [path, expected] = process.argv.slice(1); const actual = require(path).version; if (actual !== expected) { throw new Error(`expected ${expected}, installed ${actual}`); }' \
    "$INSTALL_PREFIX/lib/node_modules/oh-my-codex/package.json" "$OMX_VERSION"
  node -e \
    'const [path, expected] = process.argv.slice(1); const actual = require(path).version; if (actual !== expected) { throw new Error(`expected ${expected}, installed ${actual}`); }' \
    "$INSTALL_PREFIX/lib/node_modules/oh-my-openagent/package.json" "$OMO_VERSION"
}

install_cc_switch() {
  archive="$work_dir/$cc_switch_asset"
  extract_dir="$work_dir/cc-switch-extract"
  release_url="https://github.com/$CC_SWITCH_REPOSITORY/releases/download/v$CC_SWITCH_VERSION"

  case "$cc_switch_asset" in
    *"v$CC_SWITCH_VERSION"*linux-*musl.tar.gz) ;;
    *) fail "cc-switch asset is not an exact version-qualified Linux musl archive" ;;
  esac

  fetch "$release_url/$cc_switch_asset" "$archive"
  verify_sha256 "$archive" "$cc_switch_checksum"
  mkdir -p "$extract_dir"
  tar -xzf "$archive" -C "$extract_dir"
  binary="$(single_extracted_file "$extract_dir" cc-switch)"
  install -m 0755 "$binary" "$INSTALL_PREFIX/bin/cc-switch"
}

for variable in \
  TARGETARCH \
  CLAUDE_CODE_VERSION \
  CLAUDE_AMD64_SHA256 \
  CLAUDE_ARM64_SHA256 \
  CODEX_VERSION \
  CODEX_INSTALLER_SHA256 \
  OMC_VERSION \
  OMX_VERSION \
  OPENCODE_VERSION \
  OPENCODE_AMD64_SHA256 \
  OPENCODE_ARM64_SHA256 \
  OMO_VERSION \
  GROK_VERSION \
  GROK_AMD64_SHA256 \
  GROK_ARM64_SHA256 \
  CC_SWITCH_VERSION \
  CC_SWITCH_AMD64_ASSET \
  CC_SWITCH_AMD64_SHA256 \
  CC_SWITCH_ARM64_ASSET \
  CC_SWITCH_ARM64_SHA256
do
  require_variable "$variable"
done

for command_name in bash basename curl find install jq mktemp node npm readlink sha256sum tar wc
do
  require_command "$command_name"
done

INSTALL_PREFIX="${INSTALL_PREFIX:-/usr/local}"
case "$INSTALL_PREFIX" in
  /*) ;;
  *) fail "INSTALL_PREFIX must be an absolute path" ;;
esac

case "$TARGETARCH" in
  amd64)
    cc_switch_asset="$CC_SWITCH_AMD64_ASSET"
    cc_switch_checksum="$CC_SWITCH_AMD64_SHA256"
    ;;
  arm64)
    cc_switch_asset="$CC_SWITCH_ARM64_ASSET"
    cc_switch_checksum="$CC_SWITCH_ARM64_SHA256"
    ;;
  *) fail "unsupported TARGETARCH: $TARGETARCH" ;;
esac

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' 0
mkdir -p "$INSTALL_PREFIX/bin"

install_claude
install_codex
install_opencode
install_grok
install_node_tools
install_cc_switch
