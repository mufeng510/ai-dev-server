# ai-dev

`ai-dev` is an immutable Ubuntu 24.04 terminal development environment for amd64 and arm64. It includes [Docker CLI](https://github.com/docker/cli)/[Compose](https://github.com/docker/compose)/[Buildx](https://github.com/docker/buildx), [GitHub CLI](https://github.com/cli/cli), common language toolchains, [Claude Code](https://www.anthropic.com/claude-code), [Codex CLI](https://github.com/openai/codex), [Oh My ClaudeCode](https://github.com/Yeachan-Heo/oh-my-claudecode) (OMC), [Oh My Codex](https://github.com/Yeachan-Heo/oh-my-codex) (OMX), and SaladDay [`cc-switch-cli`](https://github.com/SaladDay/cc-switch-cli). Projects, credentials, tool state, logs, models, and backups live in named volumes rather than the image.

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
| Container development | [Docker CLI](https://github.com/docker/cli), [Compose v2](https://github.com/docker/compose), [Buildx](https://github.com/docker/buildx) | Installed from Docker's Ubuntu repository and used through the mounted host Docker Socket |
| JavaScript / TypeScript | [Node.js](https://github.com/nodejs/node), [pnpm](https://github.com/pnpm/pnpm), [Bun](https://github.com/oven-sh/bun) | 24.4.1, 10.13.1, 1.2.19 |
| Python | [Python 3](https://github.com/python/cpython), [pip](https://github.com/pypa/pip), venv, [uv](https://github.com/astral-sh/uv) | Ubuntu 24.04 system Python; uv 0.8.3 |
| Go | [Go](https://github.com/golang/go) | 1.24.5 |
| Rust | [rustc](https://github.com/rust-lang/rust), [cargo](https://github.com/rust-lang/cargo), [rustup](https://github.com/rust-lang/rustup) | 1.88.0, minimal profile |
| Java | [OpenJDK](https://github.com/openjdk/jdk) headless | 21 |
| GitHub | [GitHub CLI](https://github.com/cli/cli) (`gh`) | 2.97.0 |
| AI tools | [Claude Code](https://www.anthropic.com/claude-code), [Codex CLI](https://github.com/openai/codex) | 2.1.221, 0.146.0 |
| AI orchestration | [Oh My ClaudeCode](https://github.com/Yeachan-Heo/oh-my-claudecode), [Oh My Codex](https://github.com/Yeachan-Heo/oh-my-codex) | 4.15.7, 0.20.3 |
| Claude provider tool | SaladDay [`cc-switch-cli`](https://github.com/SaladDay/cc-switch-cli) | 5.9.3 Linux musl CLI |
| Browser IDE | [code-server](https://github.com/coder/code-server) | 4.132.0 (always-on at port 8080; requires `CODE_SERVER_PASSWORD`) |
| Development tools | [Git](https://github.com/git/git), [Git LFS](https://github.com/git-lfs/git-lfs), [OpenSSH client](https://github.com/openssh/openssh-portable), [tmux](https://github.com/tmux/tmux), [Zsh](https://github.com/zsh-users/zsh), [Bash](https://github.com/bminor/bash), [GCC](https://github.com/gcc-mirror/gcc), [Clang](https://github.com/llvm/llvm-project), [CMake](https://github.com/Kitware/CMake), [make](https://github.com/mirror/make), [pkg-config](https://github.com/pkgconf/pkgconf) | Installed from Ubuntu repositories |
| Command-line tools | [`curl`](https://github.com/curl/curl), [`wget`](https://www.gnu.org/software/wget/), [`jq`](https://github.com/jqlang/jq), [`yq`](https://github.com/mikefarah/yq) 4.47.1, [`rg`](https://github.com/BurntSushi/ripgrep), [`fd`](https://github.com/sharkdp/fd), [`fzf`](https://github.com/junegunn/fzf), [`sqlite3`](https://github.com/sqlite/sqlite), [ShellCheck](https://github.com/koalaman/shellcheck) | `fd` is a compatibility alias for `fdfind` |

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

## Browser IDE (code-server)

code-server is preinstalled and starts automatically with the container on `0.0.0.0:8080`.

1. Set a strong password in the environment or a gitignored `.env` next to Compose:

```bash
export CODE_SERVER_PASSWORD='replace-with-a-strong-password'
```

Compose requires the variable (`${CODE_SERVER_PASSWORD:?...}`). Starting without it fails closed.

2. Publish is already declared as `8080:8080` in `docker-compose.yml`.
3. Open `http://<host>:8080` and sign in with that password.
4. User settings persist in the active `/config` generation (`code-server/`). Extension cache lives under `/data/cache/code-server`.

This is a **breaking change** for older deployments: image upgrades that include code-server will not start until `CODE_SERVER_PASSWORD` is set. Prefer a reverse proxy with TLS in front of port 8080 on any non-loopback network.

## Use The Environment

Open the supported Zsh session as `dev` (from the Compose project directory):

```bash
scripts/shell
```

That is the normal entry path. It runs as `dev` through `ai-dev-shell` / `ai-dev-run`, so generation exports such as `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, and `GH_CONFIG_DIR` are applied. Equivalents:

```bash
docker compose exec --user dev ai-dev ai-dev-shell
docker exec -it --user dev ai-dev ai-dev-shell
```

Run one command through the same generation resolver:

```bash
scripts/exec git --version
scripts/exec cc-switch config path
scripts/exec ai-dev readiness
scripts/exec ai-dev doctor
```

### Keep A Session With tmux

tmux runs **inside** the container. Use it so host SSH disconnects do not kill your shell work:

```bash
scripts/shell
tmux new -As dev
```

Or from the host in one step: `scripts/tmux`.

- First time: creates a session named `dev` and attaches.
- Later: the same command reattaches if the session still exists (`-A`), or creates it again if not.
- Detach without stopping work: `Ctrl-b` then `d`, then leave the container.
- Reattach later:

```bash
scripts/shell
tmux attach -t dev
# same effect:
tmux new -As dev
```

From the Compose project directory, open tmux in one step:

```bash
scripts/tmux
```

That runs `docker compose exec --user dev ai-dev ai-dev-run tmux new -As dev`. Equivalents:

```bash
docker compose exec --user dev ai-dev ai-dev-run tmux new -As dev
docker exec -it --user dev ai-dev ai-dev-run tmux new -As dev
```

Optional host-wide shortcut (any directory; requires container name `ai-dev`):

```bash
# bash/zsh — add to ~/.bashrc or ~/.zshrc
alias ai-dev-tmux='docker exec -it --user dev ai-dev ai-dev-run tmux new -As dev'

# then:
ai-dev-tmux
```

Useful checks inside the container: `tmux ls`, `tmux kill-session -t dev`.

Notes:

- The image does not run an SSH daemon; SSH to the Docker host, then use `scripts/shell` / `scripts/exec` (or the `docker exec` forms above).
- A bare `docker compose exec ai-dev sh` starts as root and is a recovery interface, not a normal development shell.
- tmux session state lives in the container process. `docker compose restart` or recreating the container ends the session; tool config in named volumes is separate and persists. `~/.tmux.conf` is managed into the active generation.

## Manual Setup

Startup never invents identity, logs into an AI provider, creates SSH keys, configures a cc-switch provider, enables its proxy, or starts an updater.

### Git And SSH

Configure Git identity first:

```bash
scripts/exec git config --global user.name "Your Name"
scripts/exec git config --global user.email "you@example.com"
```

`~/.ssh` is a managed route into the active configuration generation under `/config`, so keys survive container recreate when volumes are kept. Do not bind-mount the host `~/.ssh` directory and do not put private keys in Compose or git.

#### Generate a new key inside the container

```bash
scripts/shell
ssh-keygen -t ed25519 -C "you@example.com"
cat ~/.ssh/id_ed25519.pub
```

Add the printed public key to GitHub (or another Git host).

#### Import an existing host key (for example GitHub)

Copy the host private key (and public key if present) into the container as `dev`. Example for `id_ed25519`:

```bash
docker exec -u dev ai-dev ai-dev-run mkdir -p /home/dev/.ssh
docker cp ~/.ssh/id_ed25519 ai-dev:/home/dev/.ssh/id_ed25519
docker cp ~/.ssh/id_ed25519.pub ai-dev:/home/dev/.ssh/id_ed25519.pub
docker exec -u dev ai-dev ai-dev-run bash -lc 'chmod 700 ~/.ssh && chmod 600 ~/.ssh/id_ed25519 && chmod 644 ~/.ssh/id_ed25519.pub'
```

Optional GitHub SSH config:

```bash
docker exec -u dev -i ai-dev ai-dev-run bash -lc 'cat > ~/.ssh/config && chmod 600 ~/.ssh/config' <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
EOF
```

Verify:

```bash
docker exec -u dev ai-dev ai-dev-run ssh -T git@github.com
docker exec -u dev ai-dev ai-dev-run bash -lc 'readlink -f ~/.ssh; ls -la ~/.ssh'
```

`ssh -T git@github.com` often exits non-zero even on success; look for `Hi <username>! You've successfully authenticated`. `readlink -f ~/.ssh` should resolve under `/config/generations/<id>/ssh`. Use `id_rsa` (or your real key name) instead of `id_ed25519` when that is what the host uses.

### GitHub CLI

Authenticate with the browser or device flow appropriate for the host:

```bash
scripts/exec gh auth login
scripts/exec gh auth status
```

GitHub CLI credentials persist through `GH_CONFIG_DIR` in the active configuration generation (see the [Tool State Contract](docs/tool-state-contract.md)). Do not add tokens to Compose or commit them to a repository.

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
- [Tool state contract](docs/tool-state-contract.md) (development source of truth for recreate-safe tool config)
- [Security model](docs/security.md)
- [Development and validation](docs/development.md)
- [Contributing](CONTRIBUTING.md)

## Image Tags And CI

| Source | Published tags |
| --- | --- |
| `main` | `edge`, `sha-<short-sha>` |
| Stable `vX.Y.Z` | `vX.Y.Z`, `X.Y.Z`, `X.Y`, `X`, `YYYY.MM`, `latest` |
| Prerelease `vX.Y.Z-rc.N` | `vX.Y.Z-rc.N`, `X.Y.Z-rc.N` only |

Stable publication requires native amd64 and arm64 gates against the candidate digest. QEMU smoke tests are supplemental. CI always runs static contracts, Compose/Bake configuration checks, and release-policy validation. Expensive image build, native gate, publish, and promote jobs run only when image/deploy-relevant paths change, and always for version tags. Successful image publishes still carry SBOM, provenance, and artifact attestation. Local `npm run validate` can skip unavailable host tools and is not evidence that Docker builds or native release gates passed.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
