# Tool State Contract

This document is the **development source of truth** for how preinstalled tools store configuration, credentials, and durable state across container recreation.

All persistence, runtime export, managed-route, doctor/readiness, migration, and documentation work for tools **must follow this contract**. When code or operator docs change the persistence model, **update this file in the same change**.

Related surfaces:

- Runtime export and validation: `scripts/ai-dev-runtime`, `scripts/ai-dev-run`
- Bootstrap and generation creation: `entrypoint.sh`
- Managed home links: `config/managed-routes.tsv`, `config/contracts.json`
- Operator overview: [Architecture](architecture.md), [Security](security.md), [Upgrade](upgrade.md)
- Contributor entry: [Development](development.md), [Contributing](../CONTRIBUTING.md)

---

## Goals

1. **Recreate-safe state** — `docker compose up --force-recreate` / `down` + `up` without `-v` keeps tool config and credentials.
2. **One storage model** — durable tool state lives in the active configuration generation (and project files under `/workspace` when they are repository-local by design).
3. **Predictable runtime** — supported workloads always resolve the active generation through `ai-dev-run`.
4. **Fail closed** — missing pointers, path escape, unsafe symlinks, and occupied managed routes abort rather than guess.
5. **No secret invention** — startup never auto-logs in, never fabricates credentials, and never silently rewrites user auth state.
6. **Maintainability** — every supported tool uses the same checklist so later changes stay reviewable and test-locked.

Non-goals:

- Persisting all of `/home/dev`
- Per-tool extra named volumes for ordinary config
- Host-injected tokens in Compose as the primary auth mechanism
- Automatic migration of ad-hoc files from ephemeral home paths (greenfield policy; do not add unless explicitly designed later)

---

## Architectural Invariants

These are absolute for this repository. Do not “temporarily” violate them in feature work.

1. **The image is immutable.** User-durable state is never baked into the image and never relies on runtime self-update of pinned tools.
2. **Exactly six named volumes** own durable data: `workspace`, `config`, `data`, `logs`, `models`, `backups`.
3. **Tool credentials and user-scope tool configuration live only under the active generation**  
   `/config/generations/<id>/...`  
   selected by the regular file `/config/active-generation`.
4. **`/home/dev` is ephemeral** unless a path is explicitly listed in the managed-routes whitelist and retargeted into the active generation.
5. **Supported workloads must run through `ai-dev-run`** (`scripts/shell`, `scripts/exec`, container `ai-dev-shell`, doctor/readiness wrappers). Bare `docker compose exec` is recovery-only.
6. **Redirect durable tool roots with stable official mechanisms first** (environment variables), then add managed routes only when the tool still touches `$HOME`.
7. **Startup may report missing authentication; it must not create it.**
8. **Identity (`PUID`/`PGID`) changes are offline-only** via `ai-dev-migrate-identity`. Container recreate is not identity migration.
9. **Volume deletion is explicit.** `docker compose down -v` destroys persistence; ordinary recreate must not require that flag.
10. **This contract, `config/contracts.json`, managed routes, runtime export, tests, and operator docs stay synchronized in one change set.**

---

## Storage Layout

### Named volumes

| Volume | Container path | Owns |
| --- | --- | --- |
| `workspace` | `/workspace` | Git repos and **repository-local** tool/plugin state (for example project `.omx`) |
| `config` | `/config` | Generations, active pointer, identity, locks, journals, event outbox |
| `data` | `/data` | Package and tool caches (for example `/data/cache`) |
| `logs` | `/logs` | Runtime logs and replay sinks |
| `models` | `/models` | Model artifacts |
| `backups` | `/backups` | In-container backups and migration metadata |

### Generation tree

```text
/config/
  active-generation          # root-owned regular file; single-line generation id
  identity                   # recorded PUID/PGID
  generations/
    <generation-id>/
      schema-version
      claude/                # CLAUDE_CONFIG_DIR
      codex/                 # CODEX_HOME (Codex + user-scope OMX state)
      omc/                   # OMC_STATE_DIR and managed ~/.config/claude-omc
      cc-switch/             # CC_SWITCH_CONFIG_DIR
      git/                   # GIT_CONFIG_GLOBAL lives at git/config
      ssh/                   # managed ~/.ssh
      zsh/                   # ZDOTDIR
      tmux.conf
      omx-initialized        # recorded OMX package version after first user setup
      gh/                    # GH_CONFIG_DIR
```

Generation ids must remain safe (`ai_dev_safe_generation_id`). Validation must require every **required** tool root directory to exist as a real directory (not a symlink) under the generation.

### Managed routes

Managed routes map home-relative paths to generation-relative targets. They are declared in:

- `config/managed-routes.tsv` (runtime)
- `config/contracts.json` → `managedRoutes` (contract mirror)

Rules:

- Startup creates or repairs **only** registered routes.
- A plain file, foreign symlink, or link outside a registered generation at a managed path **fails closed**.
- Do not add a managed route for paths that are fully covered by an env root **and** never touched via `$HOME`, unless dual-read risk is demonstrated.
- Do add a managed route when the tool (or ecosystem plugins) may still read or write under `$HOME/.config/...` even with an env override.

---

## Runtime Resolution

`scripts/ai-dev-run` (and anything that execs through it) must:

1. Refuse root for supported workloads.
2. Call `ai_dev_export_generation`.
3. Resolve `/config/active-generation` fail-closed.
4. Export at least:

| Variable | Target |
| --- | --- |
| `HOME` | `/home/dev` |
| `USER` / `LOGNAME` | `dev` |
| `CLAUDE_CONFIG_DIR` | `<generation>/claude` |
| `CODEX_HOME` | `<generation>/codex` |
| `OMC_STATE_DIR` | `<generation>/omc` |
| `CC_SWITCH_CONFIG_DIR` | `<generation>/cc-switch` |
| `GH_CONFIG_DIR` | `<generation>/gh` |
| `GIT_CONFIG_GLOBAL` | `<generation>/git/config` |
| `ZDOTDIR` | `<generation>/zsh` |

When a new durable tool root is added, extend **both** `ai_dev_export_generation` and `ai_dev_probe_generation_tools` (or the current probe helper) in the same change.

### Operator semantics (do not blur)

| Operator action | Durable tool state |
| --- | --- |
| `docker compose up -d --force-recreate` | Kept (volumes remain) |
| `docker compose down` then `up -d` | Kept |
| `docker compose down -v` | **Destroyed** |
| Change `PUID`/`PGID` only | **Rejected** until offline identity migration |
| `scripts/shell` / `scripts/exec` | Supported path; generation exported |
| Bare `docker compose exec ai-dev sh` | Recovery only; may write ephemeral or root-owned state |

---

## Tool State Checklist (mandatory for every durable tool)

A tool is **persistence-supported** only when all applicable items are done in one change:

### 1. Classify the state

| Class | Where it belongs | Examples |
| --- | --- | --- |
| User-scope credentials/config | Active generation subdir under `/config` | Claude auth, Codex auth, `gh` hosts, cc-switch providers |
| Repo-local / project plugin state | `/workspace/<project>/...` | Project `.omx`, project Claude/OMC plugin files |
| Cache only | `/data/cache/...` | npm/pnpm/bun/uv caches |
| Ephemeral | Unmanaged `/home/dev` paths | Scratch files that may disappear on recreate |

If a tool mixes classes, document each class separately. Do not store credentials in `/workspace` or caches in the generation credential tree without an explicit design note in this file.

### 2. Choose one authoritative root

Prefer, in order:

1. Upstream env var for config/data dir (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `GH_CONFIG_DIR`, `CC_SWITCH_CONFIG_DIR`, ...)
2. Generation subdir name matching the tool (`<generation>/<tool>/`)
3. Managed route only as compatibility for `$HOME` leakage
4. Never “it defaults to home and home is a volume”

### 3. Wire bootstrap

On first generation creation (`entrypoint.sh`):

- `install -d` the tool root with `0700` and `dev` ownership where appropriate
- Create copy-if-missing defaults only when required (empty credential dirs are fine)
- Do not auto-authenticate

On every start:

- Validate the root exists and is safe
- Re-apply managed routes if registered
- Optionally report auth status; never block health on missing login unless product policy explicitly changes (today health stays auth-independent)

### 4. Wire runtime export

Add the env var to `ai_dev_export_generation`.  
Ensure `scripts/shell`, `scripts/exec`, doctor, readiness, and probes inherit it through `ai-dev-run`.

### 5. Wire validation and observability

Minimum:

- `ai_dev_validate_generation` requires the directory (when user-scope durable)
- doctor can invoke a non-destructive version/config probe
- path-escape checks for tools that print their config dir (cc-switch is the reference strictness)
- event redaction patterns updated if new secret shapes appear

### 6. Lock with tests

Update offline contracts so regressions fail in `npm test`:

- export list contains the new variable / ordering assertion
- managed route mirrors (`managed-routes.tsv` and `contracts.json`) stay aligned
- documentation mentions the supported login or config command when operator-facing
- lifecycle expectations remain “volumes survive recreate”

### 7. Update this contract and operator docs

In the **same PR**:

- Inventory row in this file
- [Architecture](architecture.md) if export/roots change
- README / README.zh-CN if user procedures change
- [Security](security.md) if secret locations change
- [Troubleshooting](troubleshooting.md) if failure modes change

---

## Current Tool Inventory

Status meanings:

- **complete** — implemented and aligned with this contract
- **required** — contract demands it; implementation must be completed before calling the tool recreate-safe
- **n/a** — not a durable user-config tool in this image’s support surface

| Tool | Class | Authoritative root | Env / route | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Claude Code | user-scope | `<generation>/claude` | `CLAUDE_CONFIG_DIR` | complete | Manual `claude auth login` |
| Codex CLI | user-scope | `<generation>/codex` | `CODEX_HOME` | complete | Manual device login; shares tree with user-scope OMX |
| Oh My Codex (user) | user-scope | `<generation>/codex` | via `CODEX_HOME` | complete | First-boot offline `omx setup --scope user`; do not split from Codex home without a full redesign |
| Oh My Codex (project) | repo-local | `/workspace/<project>/.omx` | n/a | complete | Explicit project setup |
| Oh My ClaudeCode (user/state) | user-scope | `<generation>/omc` | `OMC_STATE_DIR` + route `.config/claude-omc` | complete | |
| Oh My ClaudeCode (project plugin) | repo-local | under `/workspace/<project>` | n/a | complete | Interactive plugin install per project |
| cc-switch-cli | user-scope | `<generation>/cc-switch` | `CC_SWITCH_CONFIG_DIR` | complete | Reference strict path validation |
| GitHub CLI (`gh`) | user-scope | `<generation>/gh` | `GH_CONFIG_DIR` + route `.config/gh` | complete | Recreate-safe via generation-backed `GH_CONFIG_DIR` |
| Git | user-scope | `<generation>/git` | `GIT_CONFIG_GLOBAL` + route `.config/git` | complete | |
| SSH client keys | user-scope | `<generation>/ssh` | route `.ssh` | complete | |
| Zsh / tmux defaults | user-scope | `<generation>/zsh`, `tmux.conf` | `ZDOTDIR` + routes | complete | |
| Language toolchains (Node, pnpm, Bun, uv, Go, Rust, JDK, ...) | cache / immutable bits | image + `/data/cache` | cache envs where set | n/a | Versions pinned in image; caches not credentials |
| Docker CLI/Compose/Buildx | host interface | host engine via socket | n/a | n/a | No substitute for generation secrets; socket is the trust boundary |

### Closed gaps

- GitHub CLI (`gh`) persistence is implemented: `generation/gh`, `GH_CONFIG_DIR`, managed route `.config/gh`, validate/doctor/tests/docs.

---

## Security Rules Tied To Persistence

1. Credential directories default to `0700`; credential files default to `0600`.
2. Generation credential trees must not contain unexpected symlinks (`ai_dev_secure_state` pattern).
3. Do not put tokens in Compose, Bake, Docker build args, or git.
4. Event logs must keep redacting known secret shapes; extend patterns when onboarding a new secret format.
5. cc-switch state is entirely secret-bearing; support bundles must omit it by default.
6. Recovery root shells can read everything and control the Docker socket; document them as break-glass only.

See [Security](security.md).

---

## Explicitly Rejected Designs

Do not adopt these without changing this contract first and recording a new architecture decision here:

1. **Bind or volume-mount all of `/home/dev`** for convenience.
2. **One named volume per tool** for ordinary config/credentials.
3. **Dual sources of truth** (home copy + generation copy both “live”).
4. **Startup auto-login or silent import** from unmanaged home paths.
5. **Weakening fail-closed managed routes** to overwrite user files in place.
6. **Documenting persistence that runtime export does not implement.**
7. **Using floating installer channels** or runtime self-update to “fix” state issues.

---

## Change Process (keep this document synchronized)

### When you must edit this file

Update this document in the **same commit/PR** if you:

- add, remove, or rename a preinstalled tool with user state
- add/change env exports, generation subdirs, or managed routes
- change volume layout or recreate/identity semantics
- change doctor/readiness persistence probes
- fix a persistence bug that changes the described behavior
- close a row in the inventory (for example implement `gh`)

### PR checklist for persistence-related work

Copy into the PR body when relevant:

```text
Tool State Contract
- [ ] Inventory row updated (status/fields accurate)
- [ ] Generation root created/validated in entrypoint/runtime
- [ ] Env export added/updated in ai_dev_export_generation
- [ ] Managed route added only if $HOME leakage requires it
- [ ] contracts.json + managed-routes.tsv remain mirrored
- [ ] doctor/readiness/probes updated appropriately
- [ ] Offline tests lock the new behavior
- [ ] architecture/README/security/troubleshooting updated as needed
- [ ] No dual-home live state introduced
- [ ] No auto-auth or secret injection added
```

### Review focus

Reviewers should reject persistence changes that:

- only update README claims without runtime wiring
- only add code without inventory/contract updates
- introduce unmanaged durable writes under `/home/dev`
- couple unrelated tools into one directory **unless** already established (Codex + user-scope OMX is an existing coupling; do not add new implicit couplings lightly)

---

## Implementation Reference Map

| Concern | Primary files |
| --- | --- |
| Export generation envs | `scripts/ai-dev-runtime` (`ai_dev_export_generation`) |
| Execute supported commands | `scripts/ai-dev-run`, `scripts/ai-dev-shell`, `scripts/exec`, `scripts/shell` |
| Create/validate generation | `entrypoint.sh`, `ai_dev_validate_generation` |
| Managed routes | `config/managed-routes.tsv`, `config/contracts.json` |
| Doctor / readiness | `scripts/ai-dev-doctor`, `scripts/ai-dev-readiness` |
| Offline persistence contracts | `tests/runtime-contracts.test.mjs`, `tests/contracts.test.mjs`, `tests/documentation-contracts.test.mjs` |
| Compose volumes | `docker-compose.yml` |
| Lifecycle recreate smoke | `scripts/ci-lifecycle-gate.sh` |

---

## Maintenance Policy

1. **This file leads.** If code and this document disagree, fix the disagreement in one change; do not leave operator docs ahead of runtime.
2. **Inventory status is authoritative** for what may be called recreate-safe.
3. Prefer deleting special cases over adding flags.
4. When unsure whether state is durable, classify it ephemeral until the checklist is completed.
5. After closing a **required** inventory item, remove or narrow the “Known gap” section so the document does not accumulate stale debt language.

---

## Revision Notes

| Date | Change |
| --- | --- |
| 2026-08-09 | Initial Tool State Contract: invariants, checklist, inventory, rejected designs, sync process. Records `gh` persistence as required work. |
| 2026-08-09 | Implemented GitHub CLI persistence (`GH_CONFIG_DIR`, managed route, validate/doctor/tests); inventory status complete. |
