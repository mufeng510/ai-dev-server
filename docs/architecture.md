# Architecture

## Build Model

`ai-dev` is one immutable Ubuntu 24.04 image for `linux/amd64` and `linux/arm64`. `versions.env` pins the base digest and downloaded tool versions. `docker-bake.hcl` defines the `general`, `image`, `test`, and `validate` targets. Runtime self-update is disabled; reviewed image rebuilds deliver upgrades.

The image keeps Docker's configured user as root because startup must create fresh-volume state, reconcile the host Docker Socket GID, and drop privileges. Root-owned `tini` is PID 1. After bootstrap, the entrypoint executes the foreground workload as `dev`; supported interactive and one-shot wrappers also require `dev`.

## Persistence

Six named volumes mount at `/workspace`, `/config`, `/data`, `/logs`, `/models`, and `/backups`. `/workspace` owns projects and repository-local state. `/config` owns credentials and versioned user configuration. The remaining volumes separate caches, logs, models, and backups from the image.

**Development source of truth for tool durability:** [Tool State Contract](tool-state-contract.md). All preinstalled-tool persistence work follows that checklist and inventory; keep it synchronized when export paths, managed routes, or recreate semantics change.

Managed configuration is stored under `/config/generations/<generation-id>`. The regular file `/config/active-generation` selects the complete live generation. `ai-dev-run` validates that pointer before exporting:

- `CLAUDE_CONFIG_DIR=<generation>/claude`
- `CODEX_HOME=<generation>/codex`
- `OMC_STATE_DIR=<generation>/omc`
- `CC_SWITCH_CONFIG_DIR=<generation>/cc-switch`
- `GH_CONFIG_DIR=<generation>/gh`

Managed links for SSH, Git, Zsh, OMC, and other contracted home paths point into the selected generation. Unsafe files or links at managed paths fail closed rather than being overwritten. Repository-local OMC and OMX state remains in `/workspace`. `/home/dev` is ephemeral except for managed routes.

`/config` itself is a root-owned control plane. The active-generation pointer, identity record, locks, and operation journals are root-managed; `dev` receives write access only to explicit runtime children such as generations and event outboxes. This prevents normal workloads from bypassing the offline migration workflow while keeping their tool state persistent.

## Startup

Startup holds an exclusive `/config` lock, validates the recorded PUID/PGID, resolves or creates the configuration generation, installs copy-if-missing shell defaults, repairs only registered managed links, and reports missing Git/SSH/AI authentication without creating it.

On the first configuration volume only, startup stages user-scope OMX configuration with:

```text
omx setup --scope user --install-mode legacy --mcp none --team-mode enabled
omx doctor
```

The setup runs offline and noninteractively. A later packaged OMX version mismatch creates `/config/omx-migration-required`; startup does not rewrite existing user state.

## Runtime Interfaces

- `scripts/shell` uses `docker compose exec --user dev ai-dev ai-dev-shell`.
- `scripts/exec COMMAND ...` uses `docker compose exec --user dev ai-dev ai-dev-run COMMAND ...`.
- `ai-dev-health` is local and authentication-independent.
- `ai-dev-readiness` checks broader tool and Docker availability.
- `ai-dev-doctor` runs version/config probes, including `omx doctor`.

The container publishes no ports and runs no SSH daemon. The raw read-write Docker Socket is the only host Docker interface and defines the dominant trust boundary.

## Configuration Changes

`ai-dev-migrate` clones the complete active generation, validates required subdirectories, records hashes and a previous-generation pointer, then atomically commits the new active pointer. `ai-dev-rollback` performs the inverse pointer commit. Both require root, the service stopped, and the exclusive lock. `ai-dev-migrate-identity` separately changes ownership across all declared volume roots and commits the new recorded UID/GID only after verification.

Canonical operation records live under `/config/events/outbox`. `/logs/events.jsonl` and stdout are replayable sinks and may contain physical duplicates; `(operation_id, sequence)` defines logical identity.

## Release Model

Pull requests run static and image checks. `master` publishes only `edge` and `sha-*`. Native gates run on GitHub-hosted `ubuntu-24.04` (amd64) and `ubuntu-24.04-arm` (arm64) runners. Stable semantic releases promote moving tags only after both checks pass against the same immutable digest. QEMU does not replace native capability evidence. See [Development](development.md) for local validation limits.
