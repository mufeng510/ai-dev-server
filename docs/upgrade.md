# Upgrade And Recovery

## Policy

Tools do not update themselves at runtime. Upgrade by selecting a reviewed image tag or digest. Treat moving tags such as `latest` and `edge` as mutable; pin `X.Y.Z`, `vX.Y.Z`, or an image digest when reproducibility matters.

An image update does not silently rewrite existing configuration. A packaged OMX version change may make health report `omx-migration-required`. The generic configuration helper clones and switches a complete generation; it does not run arbitrary release-specific tool transformations. Follow release-specific migration notes when a release requires them.

## Backup All Volumes

Run backups from a POSIX shell on the Docker host. Stop the service first for a consistent snapshot:

```bash
docker compose stop ai-dev
test -z "$(docker compose ps --status running -q ai-dev)"
backup_dir="backup-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
image="${AI_DEV_IMAGE:-docker.io/jerry0510/ai-dev:latest}"
for volume in workspace config data logs models backups; do
  docker run --rm --entrypoint sh \
    --mount "type=volume,src=ai-dev_${volume},dst=/source,readonly" \
    --mount "type=bind,src=$(pwd)/${backup_dir},dst=/backup" \
    "$image" -c "tar -C /source -czf /backup/${volume}.tar.gz ."
done
```

Verify that the directory contains six nonempty archives before proceeding. The command assumes the committed top-level Compose project name `ai-dev`.

## Upgrade An Image

```bash
export AI_DEV_IMAGE=docker.io/jerry0510/ai-dev:X.Y.Z
docker compose pull ai-dev
docker compose stop ai-dev
docker compose up -d
docker compose ps
docker compose logs --tail=100 ai-dev
```

Run `scripts/exec ai-dev readiness` and `scripts/exec ai-dev doctor` only after the service is running. These checks may require the Docker Socket and local tool state. They do not prove native release gates for the other architecture.

## Explicit Configuration Migration

The migration helper must run as root while the normal service is stopped. An optional safe generation ID may contain only letters, digits, dots, underscores, and hyphens.

```bash
docker compose stop ai-dev
test -z "$(docker compose ps --status running -q ai-dev)"
docker compose run --rm --no-deps \
  --entrypoint /usr/local/bin/ai-dev-migrate \
  ai-dev g20260731
docker compose up -d
```

The helper hashes and copies the complete active generation, validates its required directories, records the old generation, and atomically commits `/config/active-generation`. It never mutates the old generation in place.

## Roll Back Configuration

By default, rollback selects `/config/previous-generation`. Supply an explicit retained generation ID only when you have verified it exists.

```bash
docker compose stop ai-dev
test -z "$(docker compose ps --status running -q ai-dev)"
docker compose run --rm --no-deps \
  --entrypoint /usr/local/bin/ai-dev-rollback \
  ai-dev
docker compose up -d
```

To roll back the image as well, set `AI_DEV_IMAGE` to the previous immutable tag before `docker compose up -d`. Do not delete the newer volumes or generations until the old image has passed readiness and doctor checks.

## Identity Migration

Changing `PUID` or `PGID` at normal startup fails closed. Record the current and target numeric identities, stop the service, back up all volumes, then run:

```bash
docker compose stop ai-dev
test -z "$(docker compose ps --status running -q ai-dev)"
docker compose run --rm --no-deps \
  --entrypoint /usr/local/bin/ai-dev-migrate-identity \
  ai-dev 1000 1000 1001 1001
PUID=1001 PGID=1001 docker compose up -d
```

The four arguments are `SOURCE_UID SOURCE_GID TARGET_UID TARGET_GID`. The helper verifies the recorded source identity, recursively changes ownership of all six roots, verifies top-level ownership, and only then commits the new identity record. Large volumes can make this operation slow. An incomplete identity journal prevents normal startup; rerun the offline helper with the same intended values after inspecting logs and backups.

## Restore All Volumes

Restore is destructive. Confirm the service is stopped, the backup directory has all six archives, and `AI_DEV_IMAGE` identifies an image that can read them.

```bash
docker compose stop ai-dev
test -z "$(docker compose ps --status running -q ai-dev)"
backup_dir=backup-YYYYMMDDTHHMMSSZ
image="${AI_DEV_IMAGE:-docker.io/jerry0510/ai-dev:latest}"
for volume in workspace config data logs models backups; do
  test -s "${backup_dir}/${volume}.tar.gz"
  docker run --rm --entrypoint sh \
    --mount "type=volume,src=ai-dev_${volume},dst=/target" \
    --mount "type=bind,src=$(pwd)/${backup_dir},dst=/backup,readonly" \
    "$image" -c "find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; tar -C /target -xzf /backup/${volume}.tar.gz"
done
docker compose up -d
```

Restore the complete set together. Mixing a `config` archive from one snapshot with other volumes from another can produce inconsistent credentials, identity, and project state.
