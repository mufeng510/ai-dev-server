#!/usr/bin/env bash
set -Eeuo pipefail

image_ref=${1:?usage: release-native-gate.sh IMAGE@sha256:DIGEST EXPECTED_ARCH}
expected_arch=${2:?usage: release-native-gate.sh IMAGE@sha256:DIGEST EXPECTED_ARCH}

case "$image_ref" in
  *@sha256:[0-9a-f][0-9a-f]*) ;;
  *) printf 'release-native-gate: an immutable digest reference is required\n' >&2; exit 2 ;;
esac
case "$expected_arch" in amd64|arm64) ;; *) printf 'release-native-gate: unsupported architecture\n' >&2; exit 2 ;; esac

case "$(uname -m)" in
  x86_64) host_arch=amd64 ;;
  aarch64|arm64) host_arch=arm64 ;;
  *) printf 'release-native-gate: unsupported native runner architecture: %s\n' "$(uname -m)" >&2; exit 2 ;;
esac
test "${host_arch}" = "${expected_arch}" || {
  printf 'release-native-gate: runner is %s, expected native %s\n' "${host_arch}" "${expected_arch}" >&2
  exit 2
}

docker pull --platform "linux/$expected_arch" "$image_ref"
actual_arch=$(docker image inspect "$image_ref" --format '{{.Architecture}}')
test "$actual_arch" = "$expected_arch"

# These are capability probes, not package-presence checks. Any unavailable probe
# fails the native gate; an emulated runner is never accepted by this script.
docker run --rm --entrypoint bash "$image_ref" -lc '
  set -Eeuo pipefail
  test "$(id -u dev)" != 0
  set -a
  . /usr/local/share/ai-dev/versions.env
  set +a
  assert_version() {
    tool=$1 expected=$2
    actual=$($tool --version | grep -Eo "[0-9]+\.[0-9]+\.[0-9]+" | head -n 1)
    test "$actual" = "$expected"
  }
  assert_version node "$NODE_VERSION"
  assert_version claude "$CLAUDE_CODE_VERSION"
  assert_version codex "$CODEX_VERSION"
  assert_version cc-switch "$CC_SWITCH_VERSION"
  assert_version omc "$OMC_VERSION"
  assert_version omx "$OMX_VERSION"
  assert_version opencode "$OPENCODE_VERSION"
  temp=$(mktemp -d)
  trap '\''rm -rf "$temp"'\'' EXIT
  export HOME="$temp/home" CC_SWITCH_CONFIG_DIR="$temp/cc-switch"
  mkdir -p "$HOME" "$CC_SWITCH_CONFIG_DIR" "$temp/codex-home"
  chmod 700 "$CC_SWITCH_CONFIG_DIR"
  config_path=$(cc-switch config path | sed -n "s/^Config dir:[[:space:]]*//p")
  test -n "$config_path"
  case "$(readlink -f "$config_path")/" in "$(readlink -f "$CC_SWITCH_CONFIG_DIR")/"*) ;; *) exit 1 ;; esac
  cc-switch config validate
  cc-switch provider list >/dev/null
  set +e
  cc-switch auth status --json >"$temp/cc-switch-auth.json"
  auth_status=$?
  set -e
  case "$auth_status" in 0|1) ;; *) exit "$auth_status" ;; esac
  jq -e "type == \"object\"" "$temp/cc-switch-auth.json" >/dev/null
  ! find "$CC_SWITCH_CONFIG_DIR" -type d ! -perm 0700 -print -quit | grep -q .
  ! find "$CC_SWITCH_CONFIG_DIR" -type f ! -perm 0600 -print -quit | grep -q .
  test -w "$CC_SWITCH_CONFIG_DIR"
  CODEX_HOME="$temp/codex-home" CI=1 npm_config_offline=true omx setup --scope user --install-mode legacy --mcp none --team-mode enabled
  doctor_output=$(CODEX_HOME="$temp/codex-home" CI=1 npm_config_offline=true omx doctor)
  printf "%s\n" "$doctor_output"
  grep -Eq "Results: [0-9]+ passed, [0-9]+ warnings, 0 failed" <<<"$doctor_output"
  find /usr/local/lib/node_modules/oh-my-codex -type f -perm /111 -print -quit | grep -q .
  find /usr/local/lib/node_modules/oh-my-openagent -type f -perm /111 -print -quit | grep -q .
  omo_ver=$(oh-my-openagent version | grep -Eo "[0-9]+\.[0-9]+\.[0-9]+" | head -n 1)
  test "$omo_ver" = "$OMO_VERSION"
  omc --help >/dev/null
  OMC_STATE_DIR="$temp/omc-state" HOME="$temp/home" omc config >/dev/null
  OMC_DB="$temp/omc-state.db" node -e "const modulePath=require.resolve(\"better-sqlite3\", {paths:[\"/usr/local/lib/node_modules/oh-my-claude-sisyphus\"]}); const Database=require(modulePath); const db=new Database(process.env.OMC_DB); db.exec(\"CREATE TABLE probe (value TEXT NOT NULL)\"); db.prepare(\"INSERT INTO probe VALUES (?)\").run(\"ready\"); if (db.prepare(\"SELECT value FROM probe\").get().value !== \"ready\") process.exit(1); db.close()"
  tmux -L ai-dev-native-gate new-session -d -s probe "printf ready > $temp/tmux-ready"
  for _ in 1 2 3 4 5; do test -f "$temp/tmux-ready" && break; sleep 1; done
  test "$(cat "$temp/tmux-ready")" = ready
  lock="$temp/flock.lock"
  flock "$lock" sh -c "printf locked > $temp/flock-ready"
  test "$(cat "$temp/flock-ready")" = locked
'
