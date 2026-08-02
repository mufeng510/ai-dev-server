# ai-dev

[English](README.md)

`ai-dev` 是一个面向 amd64 和 arm64 的不可变 Ubuntu 24.04 终端开发环境。镜像预装 Docker CLI/Compose/Buildx、常用语言工具链、Claude Code、Codex CLI、Oh My ClaudeCode（OMC）、Oh My Codex（OMX）及 SaladDay `cc-switch-cli`。项目、凭据、工具状态、日志、模型和备份均保存在命名卷中，不写入镜像。

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
| 容器开发 | Docker CLI、Compose v2、Buildx | 由 Docker 官方 Ubuntu 软件源安装，用于连接已挂载的宿主机 Docker Socket |
| JavaScript / TypeScript | Node.js、pnpm、Bun | 24.4.1、10.13.1、1.2.19 |
| Python | Python 3、pip、venv、uv | Ubuntu 24.04 系统 Python；uv 0.8.3 |
| Go | Go | 1.24.5 |
| Rust | rustc、cargo、rustup | 1.88.0，minimal profile |
| Java | OpenJDK headless | 21 |
| AI 工具 | Claude Code、Codex CLI | 1.0.58、0.20.0 |
| AI 编排 | Oh My ClaudeCode、Oh My Codex | 4.2.8、0.20.3 |
| Claude 提供方工具 | SaladDay `cc-switch-cli` | 5.9.3（Linux musl CLI） |
| 常用开发工具 | Git、Git LFS、OpenSSH client、tmux、Zsh、Bash、GCC、Clang、CMake、make、pkg-config | 来自 Ubuntu 软件源 |
| 常用命令行工具 | `curl`、`wget`、`jq`、`yq` 4.47.1、`rg`、`fd`、`fzf`、`sqlite3`、ShellCheck | `fd` 是 `fdfind` 的兼容别名 |

镜像已禁用工具自更新；缓存存放在 `/data/cache`，配置、凭据和项目数据由下方的命名卷持久化。可在运行中的容器中使用 `scripts/exec <command> --version` 查看实际安装版本。

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

使用受支持的 `dev` Zsh 会话：

```bash
scripts/shell
scripts/exec git --version
scripts/exec ai-dev readiness
scripts/exec ai-dev doctor
```

通过 tmux 保持 SSH 断开后的工作会话：

```bash
scripts/shell
tmux new -As dev
```

之后重新运行 `scripts/shell` 并执行 `tmux attach -t dev`。镜像不提供 SSH 服务；应先 SSH 登录 Docker 主机，再使用上述封装。`docker compose exec ai-dev sh` 会以 root 启动，仅用于恢复。

## 手动配置

启动过程不会虚构身份、登录 AI 服务、创建 SSH 密钥、配置 cc-switch 提供方或启用代理和自动更新。

```bash
# Git 与 SSH
scripts/exec git config --global user.name "Your Name"
scripts/exec git config --global user.email "you@example.com"
scripts/shell
ssh-keygen -t ed25519 -C "you@example.com"

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

cc-switch 的提供方凭据、OAuth 数据、代理、同步和更新均由用户手动配置；其完整状态目录应视为机密。不要将 API 密钥放入 Compose 或提交至仓库。

## 运维与发布

- [升级、迁移、回滚、备份和恢复](docs/upgrade.md)
- [故障排除与常见问题](docs/troubleshooting.md)
- [架构与持久化模型](docs/architecture.md)
- [安全模型](docs/security.md)
- [开发与验证](docs/development.md)
- [贡献指南](CONTRIBUTING.md)

`main` 会发布 `edge` 与 `sha-<short-sha>`。稳定版 `vX.Y.Z` 会发布 `vX.Y.Z`、`X.Y.Z`、`X.Y`、`X`、`YYYY.MM` 和 `latest`；预发布版本只发布其完整预发布标签。稳定发布须通过候选镜像的原生 amd64 和 arm64 验证，QEMU 冒烟测试仅作补充。

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE)。
