# ai-dev

[English](README.md)

`ai-dev` 是一个面向 amd64 和 arm64 的不可变 Ubuntu 24.04 终端开发环境。镜像预装 [Docker CLI](https://github.com/docker/cli)/[Compose](https://github.com/docker/compose)/[Buildx](https://github.com/docker/buildx)、[GitHub CLI](https://github.com/cli/cli)、常用语言工具链、[Claude Code](https://www.anthropic.com/claude-code)、[Codex CLI](https://github.com/openai/codex)、[Oh My ClaudeCode](https://github.com/Yeachan-Heo/oh-my-claudecode)（OMC）、[Oh My Codex](https://github.com/Yeachan-Heo/oh-my-codex)（OMX）及 SaladDay [`cc-switch-cli`](https://github.com/SaladDay/cc-switch-cli)。项目、凭据、工具状态、日志、模型和备份均保存在命名卷中，不写入镜像。

## 安全警告

> **Compose 服务会以读写方式挂载 `/var/run/docker.sock`。原始 Docker Socket 访问权限等同于宿主机 root：容器内代码可以创建特权容器、挂载宿主机文件系统并控制 Docker 主机。**
>
> 仅可部署在可信的单用户服务器上，并且只能打开可信仓库和工具。以非 root `dev` 用户运行、未启用 `privileged: true` 或限制容器能力，均不能隔离 Docker Socket 风险。本部署明确接受该风险；启动前请阅读[安全模型](docs/security.md)。

## 快速开始

前提条件：Linux Docker 主机、Docker Engine、Docker Compose v2、可用的 `/var/run/docker.sock`、amd64 或 arm64 CPU，以及足够容纳镜像和六个卷的磁盘空间。

默认镜像为 [`docker.io/jerry0510/ai-dev:latest`](https://hub.docker.com/r/jerry0510/ai-dev)：

```bash
docker compose up -d
docker compose ps
```

无需修改 Compose 即可固定版本、使用镜像站或本地构建：

```bash
AI_DEV_IMAGE=docker.io/jerry0510/ai-dev:1.2.3 docker compose up -d
```

首次启动可设置 `PUID`、`PGID` 和 `TZ`；默认值为 `1000`、`1000`、`UTC`：

```bash
PUID="$(id -u)" PGID="$(id -g)" TZ=Asia/Shanghai docker compose up -d
```

首次成功启动后会记录 UID/GID；需要改动时，请使用离线的[身份迁移](docs/upgrade.md#identity-migration)。

## 预装软件与运行环境

镜像基于固定摘要的 Ubuntu 24.04 构建，支持 amd64 和 arm64，并使用 Zsh 作为 `dev` 用户的默认 shell。软件版本集中维护在 [`versions.env`](versions.env)；以下为当前镜像构建时固定的主要版本：

| 类别 | 软件 | 版本 / 说明 |
| --- | --- | --- |
| 容器开发 | [Docker CLI](https://github.com/docker/cli)、[Compose v2](https://github.com/docker/compose)、[Buildx](https://github.com/docker/buildx) | 由 Docker 官方 Ubuntu 软件源安装，用于连接已挂载的宿主机 Docker Socket |
| JavaScript / TypeScript | [Node.js](https://github.com/nodejs/node)、[pnpm](https://github.com/pnpm/pnpm)、[Bun](https://github.com/oven-sh/bun) | 24.4.1、10.13.1、1.2.19 |
| Python | [Python 3](https://github.com/python/cpython)、[pip](https://github.com/pypa/pip)、venv、[uv](https://github.com/astral-sh/uv) | Ubuntu 24.04 系统 Python；uv 0.8.3 |
| Go | [Go](https://github.com/golang/go) | 1.24.5 |
| Rust | [rustc](https://github.com/rust-lang/rust)、[cargo](https://github.com/rust-lang/cargo)、[rustup](https://github.com/rust-lang/rustup) | 1.88.0，minimal profile |
| Java | [OpenJDK](https://github.com/openjdk/jdk) headless | 21 |
| GitHub | [GitHub CLI](https://github.com/cli/cli)（`gh`） | 2.97.0 |
| AI 工具 | [Claude Code](https://www.anthropic.com/claude-code)、[Codex CLI](https://github.com/openai/codex) | 2.1.221、0.146.0 |
| AI 编排 | [Oh My ClaudeCode](https://github.com/Yeachan-Heo/oh-my-claudecode)、[Oh My Codex](https://github.com/Yeachan-Heo/oh-my-codex) | 4.15.7、0.20.3 |
| Claude 提供方工具 | SaladDay [`cc-switch-cli`](https://github.com/SaladDay/cc-switch-cli) | 5.9.3（Linux musl CLI） |
| 常用开发工具 | [Git](https://github.com/git/git)、[Git LFS](https://github.com/git-lfs/git-lfs)、[OpenSSH client](https://github.com/openssh/openssh-portable)、[tmux](https://github.com/tmux/tmux)、[Zsh](https://github.com/zsh-users/zsh)、[Bash](https://github.com/bminor/bash)、[GCC](https://github.com/gcc-mirror/gcc)、[Clang](https://github.com/llvm/llvm-project)、[CMake](https://github.com/Kitware/CMake)、[make](https://github.com/mirror/make)、[pkg-config](https://github.com/pkgconf/pkgconf) | 来自 Ubuntu 软件源 |
| 常用命令行工具 | [`curl`](https://github.com/curl/curl)、[`wget`](https://www.gnu.org/software/wget/)、[`jq`](https://github.com/jqlang/jq)、[`yq`](https://github.com/mikefarah/yq) 4.47.1、[`rg`](https://github.com/BurntSushi/ripgrep)、[`fd`](https://github.com/sharkdp/fd)、[`fzf`](https://github.com/junegunn/fzf)、[`sqlite3`](https://github.com/sqlite/sqlite)、[ShellCheck](https://github.com/koalaman/shellcheck) | `fd` 是 `fdfind` 的兼容别名 |

AI CLI 运行环境包括 Node.js 24（OMC 和 OMX 的运行时）、Python 3、原生编译工具链和 SQLite（原生 Node 模块的回退编译），以及受支持 CLI 工作流所需的 Git、`rg`、`jq`、`tmux`、`curl` 和 `tar`。镜像已禁用工具自更新；缓存存放在 `/data/cache`，配置、凭据和项目数据由下方的命名卷持久化。可在运行中的容器中使用 `scripts/exec <command> --version` 查看实际安装版本。

## 持久化卷

Compose 会创建六个命名卷。项目名为 `ai-dev`，卷通常命名为 `ai-dev_workspace`、`ai-dev_config` 等。除非明确要删除所有数据，否则不要运行 `docker compose down -v`。

| 卷 | 容器路径 | 内容 |
| --- | --- | --- |
| `workspace` | `/workspace` | Git 仓库及项目级 Claude、Codex、OMC、OMX 文件 |
| `config` | `/config` | 工具配置、凭据、SSH、Git、Zsh、日志事件与迁移记录 |
| `data` | `/data` | 软件包缓存和可复用工具数据 |
| `logs` | `/logs` | 运行事件和可选工具日志 |
| `models` | `/models` | 下载或本地模型文件 |
| `backups` | `/backups` | 容器内备份和迁移元数据 |

## 使用环境

在 Compose 项目目录下，打开受支持的 `dev` Zsh 会话：

```bash
scripts/shell
```

这是日常入口：以 `dev` 用户经 `ai-dev-shell` / `ai-dev-run` 启动，会导出当前配置代环境（如 `CLAUDE_CONFIG_DIR`、`CODEX_HOME`、`GH_CONFIG_DIR`）。等价写法：

```bash
docker compose exec --user dev ai-dev ai-dev-shell
docker exec -it --user dev ai-dev ai-dev-shell
```

只跑一条命令时用同一套解析器：

```bash
scripts/exec git --version
scripts/exec ai-dev readiness
scripts/exec ai-dev doctor
```

### 用 tmux 保持会话

tmux 运行在**容器内**，用于在宿主机 SSH 断开后仍保留工作会话：

```bash
scripts/shell
tmux new -As dev
```

或在宿主机一步完成：`scripts/tmux`。

- 首次：创建名为 `dev` 的会话并进入。
- 之后：同一命令在会话仍存在时重新附着（`-A`），不存在则新建。
- 暂时离开、不结束工作：`Ctrl-b` 再按 `d`（detach），然后退出容器。
- 再次进入：

```bash
scripts/shell
tmux attach -t dev
# 效果相同：
tmux new -As dev
```

在 Compose 项目目录下一键进入 tmux：

```bash
scripts/tmux
```

等价于 `docker compose exec --user dev ai-dev ai-dev-run tmux new -As dev`。其它写法：

```bash
docker compose exec --user dev ai-dev ai-dev-run tmux new -As dev
docker exec -it --user dev ai-dev ai-dev-run tmux new -As dev
```

可选：在宿主机加全局快捷命令（任意目录，依赖容器名 `ai-dev`）：

```bash
# bash/zsh — 写入 ~/.bashrc 或 ~/.zshrc
alias ai-dev-tmux='docker exec -it --user dev ai-dev ai-dev-run tmux new -As dev'

# 之后：
ai-dev-tmux
```

容器内常用：`tmux ls`、`tmux kill-session -t dev`。

说明：

- 镜像不提供 SSH 服务；应先 SSH 登录 Docker 主机，再使用 `scripts/shell` / `scripts/exec`（或上面的 `docker exec` 形式）。
- `docker compose exec ai-dev sh` 会以 root 启动，仅用于恢复，不是日常开发 shell。
- tmux 会话属于容器进程：`docker compose restart` 或重建容器会结束会话；命名卷中的工具配置与此无关，仍会保留。`~/.tmux.conf` 由当前配置代托管。

## 手动配置

启动过程不会虚构身份、登录 AI 服务、创建 SSH 密钥、配置 cc-switch 提供方或启用代理和自动更新。

先配置 Git 身份。`~/.ssh` 由 managed route 指向 `/config` 中的当前配置代，重建容器（保留卷）后密钥仍在。不要把宿主机整个 `~/.ssh` 挂进容器，也不要把私钥写入 Compose 或仓库。

```bash
# Git 身份
scripts/exec git config --global user.name "Your Name"
scripts/exec git config --global user.email "you@example.com"

# 方式 A：在容器内新生成密钥
scripts/shell
ssh-keygen -t ed25519 -C "you@example.com"
cat ~/.ssh/id_ed25519.pub
# 将公钥添加到 GitHub（或其它 Git 主机）

# 方式 B：导入宿主机已有 GitHub 私钥（以 id_ed25519 为例）
docker exec -u dev ai-dev ai-dev-run mkdir -p /home/dev/.ssh
docker cp ~/.ssh/id_ed25519 ai-dev:/home/dev/.ssh/id_ed25519
docker cp ~/.ssh/id_ed25519.pub ai-dev:/home/dev/.ssh/id_ed25519.pub
docker exec -u dev ai-dev ai-dev-run bash -lc 'chmod 700 ~/.ssh && chmod 600 ~/.ssh/id_ed25519 && chmod 644 ~/.ssh/id_ed25519.pub'
# 可选：写入 GitHub SSH config
docker exec -u dev -i ai-dev ai-dev-run bash -lc 'cat > ~/.ssh/config && chmod 600 ~/.ssh/config' <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
EOF
# 验证（成功时常见 Hi <username>!；退出码非 0 也可能正常）
docker exec -u dev ai-dev ai-dev-run ssh -T git@github.com
docker exec -u dev ai-dev ai-dev-run bash -lc 'readlink -f ~/.ssh; ls -la ~/.ssh'

# GitHub CLI：浏览器或设备认证
scripts/exec gh auth login
scripts/exec gh auth status

# Claude Code：在无头服务器上于本地浏览器完成 URL/代码流程
scripts/exec claude auth login

# Codex CLI：设备认证
scripts/exec codex login --device-auth
scripts/exec codex login status

# OMX：检查运行环境；项目初始化在目标仓库中执行
scripts/exec omx doctor
scripts/exec bash -lc 'cd /workspace/my-project && omx setup --scope project --merge-agents'

# SaladDay/cc-switch-cli：运行 TUI 或检查配置
scripts/exec cc-switch
scripts/exec cc-switch config path
scripts/exec cc-switch config validate
scripts/exec cc-switch provider list
```

OMC 已随镜像安装。进入目标项目后，在 Claude Code 中依次执行官方插件流程：

```text
/plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
/plugin install oh-my-claudecode@omc
/omc-setup
```

GitHub CLI 凭据通过当前配置代中的 `GH_CONFIG_DIR` 持久化（见[工具状态契约](docs/tool-state-contract.md)）。cc-switch 的提供方凭据、OAuth 数据、代理、同步和更新均由用户手动配置；其完整状态目录应视为机密。不要将令牌或 API 密钥放入 Compose 或提交至仓库。

## 运维与发布

- [升级、迁移、回滚、备份和恢复](docs/upgrade.md)
- [故障排除与常见问题](docs/troubleshooting.md)
- [架构与持久化模型](docs/architecture.md)
- [工具状态契约](docs/tool-state-contract.md)（预装工具可重建持久化的开发真源）
- [安全模型](docs/security.md)
- [开发与验证](docs/development.md)
- [贡献指南](CONTRIBUTING.md)

`main` 会发布 `edge` 与 `sha-<short-sha>`。稳定版 `vX.Y.Z` 会发布 `vX.Y.Z`、`X.Y.Z`、`X.Y`、`X`、`YYYY.MM` 和 `latest`；预发布版本只发布其完整预发布标签。稳定发布须通过候选镜像的原生 amd64 和 arm64 验证，QEMU 冒烟测试仅作补充。CI 始终运行静态合约、Compose/Bake 配置与 release-policy 校验；昂贵的镜像构建、原生门禁、发布与晋升作业仅在镜像/部署相关路径变更时运行，并在版本 tag 上始终运行。成功的镜像发布仍会携带 SBOM、provenance 与 artifact attestation。本地 `npm run validate` 在可选工具不可用时可能跳过检查，不能作为 Docker 构建或原生发布门禁已通过的证据。

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE)。
