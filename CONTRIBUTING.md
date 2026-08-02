# Contributing

## Before You Start

Open an issue for changes that alter the persistence model, security boundary, image contents, release tags, or migration behavior. Never include credentials or unredacted configuration in an issue or pull request.

## Make A Change

1. Keep production code under the existing feature boundary and tests under `tests/`.
2. Add or update deterministic tests for every behavior change.
3. Keep build inputs immutable and version-qualified; do not add runtime self-update behavior.
4. Update documentation when commands, Compose defaults, volumes, authentication, migration, or release policy changes.
5. Preserve the raw Docker Socket warning before Quick Start in `README.md`.

Use focused, imperative commits, optionally with `feat:`, `fix:`, `test:`, or `docs:` prefixes.

## Validate

At minimum:

```bash
npm test
npm run lint
git diff --check
git status --short
git diff --stat
```

Run `npm run validate` when Docker and the optional linters are available. Use `npm run validate:strict` when the complete local toolchain is installed. State exactly which commands ran and which checks were skipped. Do not describe offline contract tests as Docker builds or native amd64/arm64 evidence.

## Pull Requests

Explain the problem, summarize the solution, list exact verification commands and results, and call out migration, security, configuration, or release effects. Include screenshots or sample output only when relevant and redact all secrets. Stable image changes remain subject to CI's native amd64 and arm64 gates, SBOM/provenance generation, and release policy checks.

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
