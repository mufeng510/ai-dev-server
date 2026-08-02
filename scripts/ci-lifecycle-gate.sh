#!/usr/bin/env bash
set -Eeuo pipefail

image=${1:?usage: ci-lifecycle-gate.sh IMAGE}
name="ai-dev-lifecycle-${RANDOM}${RANDOM}"
prefix="${name}-volume"
volumes=()

cleanup() {
  docker rm -f "${name}" >/dev/null 2>&1 || true
  for volume in "${volumes[@]}"; do docker volume rm "${volume}" >/dev/null 2>&1 || true; done
}
trap cleanup EXIT

for suffix in workspace config data logs models backups; do
  volume="${prefix}-${suffix}"
  docker volume create "${volume}" >/dev/null
  volumes+=("${volume}")
done

run_container() {
  docker run -d --name "${name}" \
    --mount "type=volume,src=${prefix}-workspace,dst=/workspace" \
    --mount "type=volume,src=${prefix}-config,dst=/config" \
    --mount "type=volume,src=${prefix}-data,dst=/data" \
    --mount "type=volume,src=${prefix}-logs,dst=/logs" \
    --mount "type=volume,src=${prefix}-models,dst=/models" \
    --mount "type=volume,src=${prefix}-backups,dst=/backups" \
    --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
    "${image}" >/dev/null
}

wait_healthy() {
  for _ in $(seq 1 90); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "${name}")"
    [ "${status}" = healthy ] && return 0
    [ "${status}" = unhealthy ] && break
    sleep 2
  done
  docker logs "${name}" >&2 || true
  return 1
}

run_container
wait_healthy
docker exec --user dev "${name}" ai-dev-run bash -lc '
  test "$(id -u)" -ne 0
  test "$HOME" = /home/dev && test "$USER" = dev && test "$LOGNAME" = dev
  test -r /config/active-generation
  test -w /data/cache/npm
  case "$(cc-switch config path)" in /config/generations/*/cc-switch*) ;; *) exit 1 ;; esac
  printf persisted > /workspace/lifecycle-marker
'
docker restart "${name}" >/dev/null
wait_healthy
docker exec --user dev "${name}" ai-dev-run bash -lc 'test "$(cat /workspace/lifecycle-marker)" = persisted; ai-dev-health'
docker stop -t 10 "${name}" >/dev/null
test "$(docker wait "${name}")" = 0
docker rm "${name}" >/dev/null

if docker run --rm \
  --mount "type=volume,src=${prefix}-workspace,dst=/workspace" \
  --mount "type=volume,src=${prefix}-config,dst=/config" \
  --mount "type=volume,src=${prefix}-data,dst=/data" \
  --mount "type=volume,src=${prefix}-logs,dst=/logs" \
  --mount "type=volume,src=${prefix}-models,dst=/models" \
  --mount "type=volume,src=${prefix}-backups,dst=/backups" \
  --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
  -e PUID=1001 -e PGID=1001 "${image}" true; then
  printf 'ci-lifecycle-gate: identity mismatch unexpectedly started\n' >&2
  exit 1
fi
