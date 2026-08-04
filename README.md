# ai-dev

`ai-dev` is an immutable Ubuntu 24.04 terminal development environment for amd64 and arm64. It includes Docker CLI/Compose/Buildx, GitHub CLI, common language toolchains, Claude Code, Codex CLI, Oh My ClaudeCode (OMC), Oh My Codex (OMX), and SaladDay `cc-switch-cli`. Projects, credentials, tool state, logs, models, and backups live in named volumes rather than the image.

[简体中文](README.zh-CN.md)

## Security Warning

> **The Compose service mounts `/var/run/docker.sock` read-write. Access to the raw Docker Socket is effectively host-root access: code in the container can create privileged containers, mount host filesystems, and control the Docker host.**
>
> Use this image only on a trusted, single-user server and only with trusted repositories and tools. Running normal commands as the non-root `dev` user, omitting `privileged: true`, and limiting container capabilities do not sandbox Docker Socket access. This deployment accepts that risk by design. Read [Security](docs/security.md) before starting it.

## Quick Start

### Prerequisites

- Linux Docker host with Docker Engine, Docker Compose v2, and a working `/var/run/docker.sock`
- amd64 or arm64 CPU
- Permission to use Docker on the host
- Enough disk space for the image, six named volumes, and backups

The committed Compose file defaults to [`docker.io/jerry0510/ai-dev:latest`](https://hub.docker.com/r/jerry0510/ai-dev). Override the image for a pinned release, registry mirror, or local build without editing Compose:

```bash
AI_DEV_IMAGE=docker.io/jerry0510/ai-dev:1.2.3 docker compose up -d
```

For the default image:

```bash
docker compose up -d
docker compose ps
```

Optional first-start identity and timezone values are `PUID`, `PGID`, and `TZ`; defaults are `1000`, `1000`, and `UTC`:

```bash
PUID="$(id -u)" PGID="$(id -g)" TZ=Asia/Shanghai docker compose up -d
```

The first successful start records the selected UID/GID. Later changes require the offline [identity migration](docs/upgrade.md#identity-migration).

## Included Software And Environment

The image is built from a digest-pinned Ubuntu 24.04 base, supports amd64 and arm64, and uses Zsh as the default shell for the `dev` user. [`versions.env`](versions.env) is the single source of truth for pinned versions; the primary contents of the current image are:

| Category | Software | Version / notes |
| --- | --- | --- |
| Container development | Docker CLI, Compose v2, Buildx | Installed from Docker's Ubuntu repository and used through the mounted host Docker Socket |
| JavaScript / TypeScript | Node.js, pnpm, Bun | 24.4.1, 10.13.1, 1.2.19 |
| Python | Python 3, pip, venv, uv | Ubuntu 24.04 system Python; uv 0.8.3 |
| Go | Go | 1.24.5 |
| Rust | rustc, cargo, rustup | 1.88.0, minimal profile |
| Java | OpenJDK headless | 21 |
| GitHub | GitHub CLI (`gh`) | 2.97.0 |
| AI tools | Claude Code, Codex CLI | 2.1.221, 0.146.0 |
| AI orchestration | Oh My ClaudeCode, Oh My Codex | 4.15.7, 0.20.3 |
| Claude provider tool | SaladDay `cc-switch-cli` | 5.9.3 Linux musl CLI |
| Development tools | Git, Git LFS, OpenSSH client, tmux, Zsh, Bash, GCC, Clang, CMake, make, pkg-config | Installed from Ubuntu repositories |
| Command-line tools | `curl`, `wget`, `jq`, `yq` 4.47.1, `rg`, `fd`, `fzf`, `sqlite3`, ShellCheck | `fd` is a compatibility alias for `fdfind` |

The AI CLI support baseline includes Node.js 24 (the OMC and OMX runtime), Python 3 plus a native build toolchain and SQLite (native Node module fallback), and Git, `rg`, `jq`, `tmux`, `curl`, and `tar` for the supported CLI workflows. Runtime self-updates are disabled. Caches live under `/data/cache`, while configuration, credentials, and projects are persisted through the named volumes below. Check a running image with `scripts/exec <command> --version`.

## Persistent Volumes

Compose creates exactly six named volumes:

| Volume | Container path | Contents |
| --- | --- | --- |
| `workspace` | `/workspace` | Git repositories and repository-local Claude, Codex, OMC, and OMX files |
| `config` | `/config` | Versioned tool configuration, credentials, SSH, Git, Zsh, journals, and events |
| `data` | `/data` | Package caches and reusable tool data |
| `logs` | `/logs` | Runtime events and optional tool logs |
| `models` | `/models` | Downloaded or local model artifacts |
| `backups` | `/backups` | In-container backups and migration metadata |

The Compose project name is `ai-dev`, so Docker normally names these volumes `ai-dev_workspace`, `ai-dev_config`, and so on. Do not use `docker compose down -v` unless you intend to delete all persistent state.

## Use The Environment

Open the supported Zsh session as `dev`:

```bash
scripts/shell
```

Run one command through the same generation resolver:

```bash
scripts/exec git --version
scripts/exec cc-switch config path
scripts/exec ai-dev readiness
scripts/exec ai-dev doctor
```

Use tmux to retain a session across host SSH disconnects:

```bash
scripts/shell
tmux new -As dev
```

Later, re-run `scripts/shell` and `tmux attach -t dev`. The image does not run an SSH daemon; SSH to the Docker host, then use the wrappers. A bare `docker compose exec ai-dev sh` starts as root and is a recovery interface, not a normal development shell.

## Manual Setup

Startup never invents identity, logs into an AI provider, creates SSH keys, configures a cc-switch provider, enables its proxy, or starts an updater.

### Git And SSH

```bash
scripts/exec git config --global user.name "Your Name"
scripts/exec git config --global user.email "you@example.com"
scripts/shell
ssh-keygen -t ed25519 -C "you@example.com"
```

Add the printed public key to the relevant Git host. Private keys persist in the selected configuration generation under `/config`.

### GitHub CLI

Authenticate with the browser or device flow appropriate for the host:

```bash
scripts/exec gh auth login
scripts/exec gh auth status
```

GitHub CLI credentials persist in the selected configuration generation. Do not add tokens to Compose or commit them to a repository.

### Claude Code

```bash
scripts/exec claude auth login
```

Complete the URL/code flow on your local browser when the server is headless. Claude credentials persist through `CLAUDE_CONFIG_DIR` in the active generation.

### Codex CLI

Device authentication works well on a headless server:

```bash
scripts/exec codex login --device-auth
scripts/exec codex login status
```

Codex stores its credentials under the generation-selected `CODEX_HOME`. Do not place API keys in Compose or commit them to a repository.

### OMC Project Plugin

The pinned `omc` CLI is already in the image. For the official Claude Code plugin workflow, start Claude from the target project and enter these commands in Claude Code:

```text
/plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
/plugin install oh-my-claudecode@omc
/omc-setup
```

Run this per project; project files remain under `/workspace`. The container does not automate this interactive marketplace operation.

### OMX

On a fresh config volume, startup performs the packaged user-scope initialization offline and runs `omx doctor` before committing the first configuration generation. It does not authenticate Codex. Verify the wiring at any time:

```bash
scripts/exec omx doctor
```

Initialize OMX for a repository explicitly:

```bash
scripts/exec bash -lc 'cd /workspace/my-project && omx setup --scope project --merge-agents'
```

Repository-local OMX runtime state stays in `/workspace/my-project/.omx`.

### cc-switch-cli

The image contains the pinned headless TUI/scriptable CLI from `SaladDay/cc-switch-cli`, not the similarly named desktop GUI:

```bash
scripts/exec cc-switch --version
scripts/exec cc-switch config path
scripts/exec cc-switch config validate
scripts/exec cc-switch provider list
```

Run `scripts/exec cc-switch` for the TUI. Provider credentials, OAuth material, proxy configuration, sync, and updates are manual user actions. Treat the entire cc-switch state directory as secret.

## Operations

- [Upgrade, migration, rollback, backup, and restore](docs/upgrade.md)
- [Troubleshooting and FAQ](docs/troubleshooting.md)
- [Architecture and persistence model](docs/architecture.md)
- [Security model](docs/security.md)
- [Development and validation](docs/development.md)
- [Contributing](CONTRIBUTING.md)

## Image Tags And CI

| Source | Published tags |
| --- | --- |
| `main` | `edge`, `sha-<short-sha>` |
| Stable `vX.Y.Z` | `vX.Y.Z`, `X.Y.Z`, `X.Y`, `X`, `YYYY.MM`, `latest` |
| Prerelease `vX.Y.Z-rc.N` | `vX.Y.Z-rc.N`, `X.Y.Z-rc.N` only |

Stable publication requires native amd64 and arm64 gates against the candidate digest. QEMU smoke tests are supplemental. CI also checks static contracts, Compose/Bake configuration, image tool versions, release policy, SBOM, provenance, and artifact attestation. Local `npm run validate` can skip unavailable host tools and is not evidence that Docker builds or native release gates passed.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
