#!/usr/bin/env bash
set -euo pipefail
umask 077

export AI_DEV_CONFIG_ROOT="${AI_DEV_CONFIG_ROOT:-/config}"
export AI_DEV_LOG_ROOT="${AI_DEV_LOG_ROOT:-/logs}"
export AI_DEV_BACKUP_ROOT="${AI_DEV_BACKUP_ROOT:-/backups}"
export AI_DEV_HOME="${AI_DEV_HOME:-/home/dev}"
export AI_DEV_ROOTS="${AI_DEV_ROOTS:-/workspace /config /data /logs /models /backups}"
AI_DEV_DEFAULTS_DIR="${AI_DEV_DEFAULTS_DIR:-/usr/local/share/ai-dev/defaults}"
AI_DEV_ROUTES_FILE="${AI_DEV_ROUTES_FILE:-/usr/local/share/ai-dev/managed-routes.tsv}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
export AI_DEV_RUNTIME_UID="${PUID}"
export AI_DEV_RUNTIME_GID="${PGID}"

. /usr/local/libexec/ai-dev-runtime

fail() {
  local message="$1"
  if [ -n "${startup_operation:-}" ]; then
    # Preserve the original startup failure if telemetry is unavailable.
    ai_dev_event "${startup_operation}" operation.failed error startup-failed state failed >/dev/null 2>&1 || true
  fi
  printf 'entrypoint: %s\n' "${message}" >&2
  exit 1
}

read_generation_state() {
  local name="$1"
  local path="${AI_DEV_GENERATION}/${name}"

  [ ! -L "${path}" ] || fail "generation state file is a symlink: ${name}"
  [ -e "${path}" ] || return 0
  [ -f "${path}" ] || fail "generation state path is not a regular file: ${name}"
  cat "${path}" || fail "generation state file cannot be read: ${name}"
}

[ "$(id -u)" -eq 0 ] || fail 'bootstrap must run as root'
case "${PUID}" in ''|*[!0-9]*) fail 'PUID and PGID must be positive integers' ;; esac
case "${PGID}" in ''|*[!0-9]*) fail 'PUID and PGID must be positive integers' ;; esac
[ "${PUID}" -gt 0 ] && [ "${PGID}" -gt 0 ] || fail 'PUID and PGID must be non-root'

case "${1:-}" in
  ai-dev-migrate|ai-dev-rollback|ai-dev-migrate-identity)
    helper="$1"; shift
    exec "/usr/local/bin/${helper}" "$@"
    ;;
esac

for root in ${AI_DEV_ROOTS}; do install -d -m 0755 "${root}"; done
exec 9>"${AI_DEV_LOCK}"
flock 9

if [ -e "${AI_DEV_CONFIG_ROOT}/identity-migration.journal" ]; then
  fail 'an identity migration is incomplete; stop the service and rerun ai-dev-migrate-identity'
fi
if [ -e "${AI_DEV_CONFIG_ROOT}/migration.journal" ] || [ -e "${AI_DEV_CONFIG_ROOT}/rollback.journal" ]; then
  ai_dev_event "${startup_operation}" recovery.started warning recovery-required state configuration
  fail 'a configuration operation is incomplete; run the offline migrate or rollback helper'
fi

fresh_identity=0
if [ -e "${AI_DEV_IDENTITY}" ]; then
  [ -f "${AI_DEV_IDENTITY}" ] && [ ! -L "${AI_DEV_IDENTITY}" ] || fail 'identity record is not a safe regular file'
  recorded_uid="$(sed -n 's/^PUID=//p' "${AI_DEV_IDENTITY}")"
  recorded_gid="$(sed -n 's/^PGID=//p' "${AI_DEV_IDENTITY}")"
  [ "${recorded_uid}" = "${PUID}" ] && [ "${recorded_gid}" = "${PGID}" ] ||
    fail "identity mismatch (recorded ${recorded_uid}:${recorded_gid}, requested ${PUID}:${PGID}); use offline ai-dev-migrate-identity"
else
  fresh_identity=1
fi

# A mismatched identity must fail before any requested-identity state is written.
startup_operation="$(ai_dev_new_operation)"
ai_dev_event "${startup_operation}" startup.started info startup-started
for cache in npm pnpm bun uv go-build go-mod pip gradle code-server; do
  install -d -o "${PUID}" -g "${PGID}" -m 0700 "/data/cache/${cache}"
done
install -d -m 0700 "${AI_DEV_CONFIG_ROOT}/events/outbox" "${AI_DEV_CONFIG_ROOT}/events/cursors"

# A single named volume can be replaced independently of /config. Repair only
# its mountpoint ownership after identity validation; never recurse into data.
for root in /workspace /data /logs /models /backups; do
  chown "${PUID}:${PGID}" "${root}"
done

current_uid="$(id -u dev)" current_gid="$(id -g dev)"
if [ "${current_gid}" != "${PGID}" ]; then
  # A host Socket or distro group can already use the requested numeric GID.
  # A non-unique numeric group is safer than renaming an unrelated base group.
  groupmod --non-unique --gid "${PGID}" dev
fi
if [ "${current_uid}" != "${PUID}" ]; then
  conflicting_user="$(getent passwd "${PUID}" | cut -d: -f1 || true)"
  [ -z "${conflicting_user}" ] || [ "${conflicting_user}" = dev ] || fail "PUID ${PUID} is already assigned"
  usermod --uid "${PUID}" dev
fi

# Keep the control-plane directory root-owned. The dev user receives write access
# only through its explicitly created children (generations, events, and caches).
chown root:dev "${AI_DEV_CONFIG_ROOT}"
chmod 0750 "${AI_DEV_CONFIG_ROOT}"

if [ -S /var/run/docker.sock ]; then
  socket_gid="$(stat -c %g /var/run/docker.sock)"
  socket_group="$(getent group "${socket_gid}" | cut -d: -f1 || true)"
  if [ -z "${socket_group}" ]; then
    socket_group=docker-host
    groupadd --gid "${socket_gid}" "${socket_group}"
  fi
  usermod -aG "${socket_group}" dev
else
  printf '%s\n' 'entrypoint: readiness warning: Docker Socket is absent' >&2
fi

if [ "${fresh_identity}" -eq 1 ]; then
  for root in ${AI_DEV_ROOTS}; do
    [ "${root}" = "${AI_DEV_CONFIG_ROOT}" ] || chown "${PUID}:${PGID}" "${root}"
  done
  printf 'PUID=%s\nPGID=%s\n' "${PUID}" "${PGID}" | ai_dev_atomic_write "${AI_DEV_IDENTITY}" 0600
fi
chown root:root "${AI_DEV_IDENTITY}"

initialization_recovery=0
if [ -e "${AI_DEV_CONFIG_ROOT}/initialization.journal" ] && [ ! -e "${AI_DEV_CONFIG_ROOT}/initialized" ]; then
  initialization_recovery=1
  ai_dev_event "${startup_operation}" recovery.started warning stale-initialization state initialization
fi
printf 'operation_id=%s\nstate=initializing\n' "${startup_operation}" |
  ai_dev_atomic_write "${AI_DEV_CONFIG_ROOT}/initialization.journal" 0600

if [ ! -e "${AI_DEV_POINTER}" ]; then
  generation_id=g000001
  generation="${AI_DEV_GENERATIONS}/${generation_id}"
  install -d -o dev -g dev -m 0700 "${generation}"
  for directory in claude omc cc-switch git ssh zsh gh code-server opencode omo opencode-data; do install -d -o dev -g dev -m 0700 "${generation}/${directory}"; done
  printf '%s\n' "${AI_DEV_CONFIG_SCHEMA:-1}" | ai_dev_atomic_write "${generation}/schema-version" 0600
  [ -e "${generation}/zsh/.zshrc" ] || install -m 0600 "${AI_DEV_DEFAULTS_DIR}/zshrc" "${generation}/zsh/.zshrc"
  [ -e "${generation}/tmux.conf" ] || install -m 0600 "${AI_DEV_DEFAULTS_DIR}/tmux.conf" "${generation}/tmux.conf"

  installed_omx_version="$(omx --version | sed -n '1p')"
  [ -n "${installed_omx_version}" ] || fail 'OMX did not report an installed version'
  if [ ! -e "${generation}/omx-initialized" ]; then
    omx_staging="${generation}/.codex-omx-staging"
    if [ -d "${omx_staging}" ] && [ ! -L "${omx_staging}" ]; then
      [ ! -e "${generation}/codex" ] || fail 'both OMX staging and live state exist'
    elif [ -e "${omx_staging}" ]; then
      fail 'OMX staging path is unsafe'
    elif [ -d "${generation}/codex" ] && [ ! -L "${generation}/codex" ]; then
      mv "${generation}/codex" "${omx_staging}"
    elif [ -e "${generation}/codex" ]; then
      fail 'OMX state path is unsafe'
    else
      install -d -o dev -g dev -m 0700 "${omx_staging}"
    fi
    gosu dev:dev env HOME="${AI_DEV_HOME}" CODEX_HOME="${omx_staging}" CI=1 \
      npm_config_offline=true npm_config_update_notifier=false \
      omx setup --scope user --install-mode legacy --mcp none --team-mode enabled
    doctor_output="$(gosu dev:dev env HOME="${AI_DEV_HOME}" CODEX_HOME="${omx_staging}" CI=1 \
      npm_config_offline=true npm_config_update_notifier=false omx doctor)"
    printf '%s\n' "${doctor_output}"
    grep -Eq 'Results: [0-9]+ passed, [0-9]+ warnings, 0 failed' <<<"${doctor_output}" ||
      fail 'OMX doctor reported failed checks after setup'
    mv "${omx_staging}" "${generation}/codex"
    ai_dev_sync_path "${generation}"
    printf '%s\n' "${installed_omx_version}" | ai_dev_atomic_write "${generation}/omx-initialized" 0600
  fi
  chown "${PUID}:${PGID}" "${generation}/schema-version" "${generation}/tmux.conf" \
    "${generation}/zsh/.zshrc" "${generation}/omx-initialized"
  ai_dev_commit_pointer "${generation_id}"
fi
ai_dev_resolve_generation || fail 'active generation is corrupt'
chmod 0644 "${AI_DEV_POINTER}"
chown root:root "${AI_DEV_POINTER}"
# Non-destructive ensure for newly contracted roots so existing generations remain bootable.
install -d -o dev -g dev -m 0700 "${AI_DEV_GENERATION}/gh"
install -d -o dev -g dev -m 0700 "${AI_DEV_GENERATION}/code-server"
install -d -o dev -g dev -m 0700 "${AI_DEV_GENERATION}/opencode"
install -d -o dev -g dev -m 0700 "${AI_DEV_GENERATION}/omo"
install -d -o dev -g dev -m 0700 "${AI_DEV_GENERATION}/opencode-data"
installed_omo_version="$(node -p "require('/usr/local/lib/node_modules/oh-my-openagent/package.json').version")"
[ -n "${installed_omo_version}" ] || fail 'oh-my-openagent did not report an installed version'
if [ ! -e "${AI_DEV_GENERATION}/opencode-omo-initialized" ]; then
  ai_dev_register_opencode_omo "${AI_DEV_GENERATION}" || fail 'OpenCode oh-my-openagent plugin registration failed'
  chown "${PUID}:${PGID}" "${AI_DEV_GENERATION}/opencode/opencode.json" "${AI_DEV_GENERATION}/omo/omo.jsonc" 2>/dev/null || true
  printf '%s\n' "${installed_omo_version}" | ai_dev_atomic_write "${AI_DEV_GENERATION}/opencode-omo-initialized" 0600
  chown "${PUID}:${PGID}" "${AI_DEV_GENERATION}/opencode-omo-initialized"
fi
ai_dev_validate_generation "${AI_DEV_GENERATION_ID}" || fail 'active generation is incomplete or unsafe'
chmod 0700 "${AI_DEV_GENERATION}/claude" "${AI_DEV_GENERATION}/codex" "${AI_DEV_GENERATION}/omc" "${AI_DEV_GENERATION}/ssh" "${AI_DEV_GENERATION}/gh" "${AI_DEV_GENERATION}/opencode" "${AI_DEV_GENERATION}/omo" "${AI_DEV_GENERATION}/opencode-data"
ai_dev_secure_state "${AI_DEV_GENERATION}/cc-switch" || fail 'cc-switch state has unsafe permissions'
find "${AI_DEV_GENERATION}/ssh" -xdev -type f -exec chmod 0600 {} +
[ ! -f "${AI_DEV_GENERATION}/codex/auth.json" ] || chmod 0600 "${AI_DEV_GENERATION}/codex/auth.json"
ai_dev_secure_state "${AI_DEV_BACKUP_ROOT}" || fail 'backup state has unsafe permissions'

installed_omx_version="$(omx --version | sed -n '1p')"
recorded_omx_version="$(read_generation_state omx-initialized)"
if [ -z "${recorded_omx_version}" ] || [ "${recorded_omx_version}" != "${installed_omx_version}" ]; then
  printf 'expected=%s\nactual=%s\n' "${recorded_omx_version:-unrecorded}" "${installed_omx_version:-unavailable}" |
    ai_dev_atomic_write "${AI_DEV_CONFIG_ROOT}/omx-migration-required" 0600
  printf '%s\n' 'entrypoint: OMX migration is required; persisted user configuration was not changed' >&2
else
  rm -f "${AI_DEV_CONFIG_ROOT}/omx-migration-required"
fi

recorded_omo_version="$(read_generation_state opencode-omo-initialized)"
if [ -z "${recorded_omo_version}" ] || [ "${recorded_omo_version}" != "${installed_omo_version}" ]; then
  printf 'expected=%s\nactual=%s\n' "${recorded_omo_version:-unrecorded}" "${installed_omo_version:-unavailable}" |
    ai_dev_atomic_write "${AI_DEV_CONFIG_ROOT}/opencode-omo-migration-required" 0600
  printf '%s\n' 'entrypoint: OpenCode/OMO migration is required; persisted user configuration was not changed' >&2
else
  rm -f "${AI_DEV_CONFIG_ROOT}/opencode-omo-migration-required"
fi

while IFS=$'\t' read -r home_path generation_path; do
  case "${home_path}" in ''|'#'*) continue ;; esac
  case "${home_path}" in /*|*..*) fail 'managed route manifest contains an unsafe home path' ;; esac
  case "${generation_path}" in ''|/*|*..*) fail 'managed route manifest contains an unsafe generation path' ;; esac
  route="${AI_DEV_HOME}/${home_path}"
  target="${AI_DEV_GENERATION}/${generation_path}"
  [ -e "${target}" ] || fail "managed route target is absent: ${generation_path}"
  install -d -o dev -g dev -m 0700 "$(dirname "${route}")"
  if [ -L "${route}" ]; then
    old_target="$(readlink -f "${route}" || true)"
    generation_root="$(readlink -f "${AI_DEV_GENERATIONS}")"
    case "${old_target}" in
      "${generation_root}"/*)
        old_relative="${old_target#"${generation_root}"/}"
        old_generation="${old_relative%%/*}"
        [ "${old_target}" = "${generation_root}/${old_generation}/${generation_path}" ] && \
          ai_dev_validate_generation "${old_generation}" || fail "managed route points outside a registered generation: ${route}"
        ;;
      *) fail "managed route points outside a registered generation: ${route}" ;;
    esac
  elif [ -e "${route}" ]; then
    fail "managed route is occupied by user data: ${route}"
  fi
  temporary="${route}.tmp.$$"
  ln -s "${target}" "${temporary}"
  mv -Tf "${temporary}" "${route}"
done <"${AI_DEV_ROUTES_FILE}"

chown -h "${PUID}:${PGID}" "${AI_DEV_HOME}/.tmux.conf" "${AI_DEV_HOME}/.zshrc"

schema="$(read_generation_state schema-version)"
if [ "${schema}" != "${AI_DEV_CONFIG_SCHEMA:-1}" ]; then
  printf 'expected=%s\nactual=%s\n' "${AI_DEV_CONFIG_SCHEMA:-1}" "${schema}" |
    ai_dev_atomic_write "${AI_DEV_CONFIG_ROOT}/migration-pending" 0600
  printf '%s\n' 'entrypoint: configuration migration is pending; stop the service and run ai-dev migrate' >&2
else
  rm -f "${AI_DEV_CONFIG_ROOT}/migration-pending"
fi

git config --file "${AI_DEV_GENERATION}/git/config" user.name >/dev/null 2>&1 || printf '%s\n' 'entrypoint: Git identity is not configured (no identity was created)' >&2
find "${AI_DEV_GENERATION}/ssh" -mindepth 1 -maxdepth 1 -type f -print -quit | grep -q . || printf '%s\n' 'entrypoint: no SSH keys are configured (no key was created)' >&2
for tool in claude codex omx omc cc-switch opencode oh-my-openagent; do
  command -v "${tool}" >/dev/null 2>&1 || fail "required tool is unavailable: ${tool}"
done
cc_switch_path="$(gosu dev:dev ai-dev-run cc-switch config path | sed -n 's/^Config dir:[[:space:]]*//p')" || fail 'cc-switch configuration path cannot be resolved'
[ -n "${cc_switch_path}" ] && [[ "${cc_switch_path}" != *$'\n'* ]] || fail 'cc-switch configuration path cannot be parsed'
case "$(readlink -f "${cc_switch_path}")/" in
  "${AI_DEV_GENERATION}/cc-switch/"*) ;;
  *) fail 'cc-switch configuration path escapes the active generation' ;;
esac
gosu dev:dev ai-dev-run cc-switch config validate >/dev/null || fail 'cc-switch configuration is invalid'
gosu dev:dev ai-dev-run claude auth status --json >/dev/null 2>&1 ||
  printf '%s\n' 'entrypoint: Claude is not authenticated (no login was started)' >&2
gosu dev:dev ai-dev-run codex login status >/dev/null 2>&1 ||
  printf '%s\n' 'entrypoint: Codex is not authenticated (no login was started)' >&2

printf 'operation_id=%s\ngeneration=%s\nstate=complete\n' "${startup_operation}" "${AI_DEV_GENERATION_ID}" |
  ai_dev_atomic_write "${AI_DEV_CONFIG_ROOT}/initialized" 0600
rm -f "${AI_DEV_CONFIG_ROOT}/initialization.journal"
ai_dev_sync_path "${AI_DEV_CONFIG_ROOT}"
chown root:root "${AI_DEV_CONFIG_ROOT}/initialized"
[ "${initialization_recovery}" -eq 0 ] || ai_dev_event "${startup_operation}" recovery.completed info recovery-completed state initialization generation "${AI_DEV_GENERATION_ID}"
ai_dev_event "${startup_operation}" startup.completed info startup-completed generation "${AI_DEV_GENERATION_ID}"
ai_dev_event "${startup_operation}" operation.completed info operation-completed

exec gosu dev:dev ai-dev-run "$@"
