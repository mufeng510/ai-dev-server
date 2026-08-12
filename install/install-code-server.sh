#!/bin/sh
set -eu

readonly CODE_SERVER_RELEASE_BASE_URL="https://github.com/coder/code-server/releases/download"

fail() {
  printf 'install-code-server: %s\n' "$*" >&2
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

for variable in \
  TARGETARCH \
  CODE_SERVER_VERSION \
  CODE_SERVER_AMD64_ASSET \
  CODE_SERVER_AMD64_SHA256 \
  CODE_SERVER_ARM64_ASSET \
  CODE_SERVER_ARM64_SHA256
do
  require_variable "$variable"
done

for command_name in basename curl find install mktemp sha256sum tar
do
  require_command "$command_name"
done

INSTALL_PREFIX="${INSTALL_PREFIX:-/usr/local}"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

case "$TARGETARCH" in
  amd64)
    code_server_asset=$CODE_SERVER_AMD64_ASSET
    code_server_checksum=$CODE_SERVER_AMD64_SHA256
    ;;
  arm64)
    code_server_asset=$CODE_SERVER_ARM64_ASSET
    code_server_checksum=$CODE_SERVER_ARM64_SHA256
    ;;
  *) fail "unsupported TARGETARCH for code-server: $TARGETARCH" ;;
esac

case "$code_server_asset" in
  *"code-server-$CODE_SERVER_VERSION-linux-"*.tar.gz) ;;
  *) fail "code-server asset is not an exact version-qualified Linux archive" ;;
esac

archive="$work_dir/$code_server_asset"
extract_dir="$work_dir/code-server-extract"
fetch "$CODE_SERVER_RELEASE_BASE_URL/v$CODE_SERVER_VERSION/$code_server_asset" "$archive"
verify_sha256 "$archive" "$code_server_checksum"
mkdir -p "$extract_dir"
tar -xzf "$archive" -C "$extract_dir"

# Release tarballs contain a single top-level directory with bin/code-server.
top_dir="$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d -print)"
[ -n "$top_dir" ] || fail "archive did not contain a top-level directory"
[ "$(printf '%s\n' "$top_dir" | wc -l)" -eq 1 ] || fail "archive contained more than one top-level directory"
[ -x "$top_dir/bin/code-server" ] || fail "archive did not contain bin/code-server"

install_root="$INSTALL_PREFIX/lib/code-server"
rm -rf "$install_root"
mkdir -p "$INSTALL_PREFIX/lib" "$INSTALL_PREFIX/bin"
mv "$top_dir" "$install_root"
ln -sfn "$install_root/bin/code-server" "$INSTALL_PREFIX/bin/code-server"

"$INSTALL_PREFIX/bin/code-server" --version | grep -F "$CODE_SERVER_VERSION" >/dev/null \
  || fail "code-server version verification failed"