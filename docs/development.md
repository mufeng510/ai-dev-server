# Development

## Requirements

- Node.js 20 or newer for repository contract tests
- Bash for `scripts/validate.sh` and the Makefile targets
- Docker Engine with Compose v2 and Buildx for Compose/Bake/image checks
- Optional `shellcheck`, `hadolint`, and `actionlint` for stricter local validation

## Repository Layout

| Path | Responsibility |
| --- | --- |
| `Dockerfile`, `install/` | Image stages and pinned tool installation |
| `entrypoint.sh`, `scripts/ai-dev-*` | Bootstrap, runtime wrappers, health, migration, and events |
| `config/` | Static contracts, managed routes, and copy-if-missing defaults |
| `docker-compose.yml`, `docker-bake.hcl` | Runtime and build contracts |
| `.github/workflows/docker.yml` | Multi-architecture build, native gates, and release promotion |
| `tests/` | Offline Node contract tests and fixtures |

## Validation

Run the deterministic offline tests:

```bash
npm test
```

Run static validation:

```bash
npm run lint
```

Run the full local validator:

```bash
npm run validate
```

`npm run validate` checks the version manifest and offline tests, then runs ShellCheck, Hadolint, Actionlint, Compose config, and Bake print when those tools exist. Missing optional tools are reported as `SKIP`. Require all tools with:

```bash
npm run validate:strict
```

Equivalent Make targets are `make test`, `make lint`, and `make validate`.

Before submitting a change, also run:

```bash
git diff --check
git status --short
git diff --stat
```

## Image Checks

The Bake targets are `general`, `image`, `test`, and `validate`. Inspect the resolved plan before a build:

```bash
docker buildx bake --print
docker buildx bake test
```

Do not report an image, Docker, amd64, or arm64 check as passed unless that command actually ran. Local offline validation does not replace CI native gates. Stable publication requires the candidate digest to pass both native architecture jobs; QEMU is supplemental.

## Updating Versions

Edit `versions.env`, the matching Bake defaults, and any pinned checksums as one reviewed change. Do not replace exact versions with floating installer channels. Run the manifest check and applicable image/native tests. Tool compatibility on one architecture does not establish compatibility on the other.

## Documentation

Keep commands synchronized with the actual wrappers and Compose defaults. Put the Docker Socket root-equivalence warning before any quick-start instruction. Separate checks executed locally from gates delegated to CI.
