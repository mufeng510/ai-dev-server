# Troubleshooting And FAQ

## First Checks

```bash
docker compose ps
docker compose logs --tail=200 ai-dev
docker compose config --quiet
scripts/exec ai-dev health
scripts/exec ai-dev readiness
scripts/exec ai-dev doctor
```

Health is local and authentication-independent. Readiness and doctor perform broader Docker/tool checks and may fail when credentials or the Docker Socket are unavailable. If the container is not running, inspect Compose logs before using `scripts/exec`.

## Docker Socket Is Absent Or Denied

Confirm `/var/run/docker.sock` exists on the Linux host and that Compose mounts it read-write. Startup adds `dev` to the Socket's numeric group; `scripts/shell` refuses to continue if that group access is missing. Rootless Docker or a nonstandard Socket path is not configured by the committed Compose file.

Remember that fixing Socket access grants host-root-equivalent capability. Do not expose the Socket on an untrusted multi-user host.

## Identity Mismatch

The first start records `PUID` and `PGID`. Starting later with different values fails intentionally; normal startup never recursively changes persisted ownership. Follow [Identity migration](upgrade.md#identity-migration) with the service stopped.

## `omx-migration-required`

The installed OMX version differs from the version recorded when the active generation was initialized. Startup preserves existing config and health fails closed. Back up the volumes and consult the release-specific migration notes. The generic migration helper only clones and switches a complete generation; it does not invent a tool-specific transformation.

## Incomplete Migration Or Rollback

Normal startup rejects leftover migration, rollback, or identity journals. Keep the service stopped. Inspect `/config/migration.journal`, `/config/rollback.journal`, or `/config/identity-migration.journal` through a root recovery container and review `/logs/events.jsonl`. Do not delete a journal or edit `/config/active-generation` casually; retry the corresponding offline helper or restore a complete backup.

## Managed Route Is Unsafe

Startup only replaces registered links it owns. A regular file, an external symlink, or a link to an unregistered generation at a managed path causes a closed failure. Move the conflicting path aside from a root recovery session, verify its contents, then restart. Managed routes are `.ssh`, `.config/git`, `.config/zsh`, `.config/claude-omc`, and `.config/gh` under `/home/dev`.

## Login Does Not Open A Browser

The service is headless. Use the URL/code printed by Claude Code. For Codex, use device flow:

```bash
scripts/exec codex login --device-auth
```

Authentication is intentionally not part of health. Check Codex with `scripts/exec codex login status`.

## Shell Or Command Runs As Root

Use `scripts/shell` and `scripts/exec`. Docker exec defaults to the image's configured root user, regardless of the main process having dropped privileges. A raw root exec is only for recovery.

## FAQ

### Does the container provide SSH access?

No. SSH to the Docker host, run `scripts/shell`, and use tmux to retain sessions.

### Can I remove a volume I do not use?

No. Startup and migration declare all six roots. Keep all six named volumes mounted.

### Can tools update themselves?

No supported workflow uses self-updaters. Change the image version and follow the explicit upgrade process.

### Why does `docker compose down` preserve my files?

Named volumes outlive containers. `docker compose down -v` deletes them and is intentionally absent from normal instructions.

### Does `npm run validate` prove the image works?

No. It always runs offline Node contract tests, but it skips optional tools that are unavailable unless `--strict-tools` is selected. Only CI's actual image builds and native architecture jobs establish those release gates.

### Where is cc-switch state?

Run `scripts/exec cc-switch config path`. It should resolve inside the active `/config/generations/<id>/cc-switch` directory. Treat everything there as secret.
