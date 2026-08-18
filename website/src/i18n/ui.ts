import type { Locale } from "./utils";

const en = {
  "meta.title": "AI Dev Server — Your AI Development Environment, Anywhere",
  "meta.description":
    "Self-hosted immutable Ubuntu 24.04 terminal development environment with Claude Code, Codex CLI, and multi-language toolchains — run via Docker Compose on amd64 and arm64.",
  "nav.features": "Features",
  "nav.docs": "Docs",
  "nav.github": "GitHub",
  "nav.menuOpen": "Open menu",
  "nav.menuClose": "Close menu",
  "nav.mobile": "Mobile",
  "nav.primary": "Primary",
  "theme.toggle": "Toggle color theme",
  "lang.label": "Language",
  "lang.en": "English",
  "lang.zh": "中文",
  "hero.badge": "Open Source · Self Hosted · Docker Native",
  "hero.kicker": "AI Development Environment",
  "hero.titleBefore": "Your AI Development",
  "hero.titleAfter": "Environment, Anywhere.",
  "hero.subtitle":
    "Run Claude Code, Codex CLI, and your favorite development tools in a self-hosted, immutable Ubuntu 24.04 terminal environment — on amd64 and arm64.",
  "hero.ctaPrimary": "Get Started",
  "hero.ctaSecondary": "View on GitHub",
  "mock.caption": "Illustrative terminal mockup (not a product screenshot)",
  "mock.workspace": "/workspace",
  "mock.hostComment": "# on the Docker host",
  "mock.insideComment": "# inside the container as dev",
  "mock.footerLine": "persistent volumes · docker sock · multi-arch image",
  "features.title": "Everything you need to build with AI.",
  "features.subtitle":
    "A serious Docker-native terminal environment for AI coding agents and everyday development work.",
  "features.1.title": "Immutable multi-arch image",
  "features.1.body":
    "Ubuntu 24.04 for linux/amd64 and linux/arm64. Upgrades come from reviewed image tags — not runtime self-update.",
  "features.2.title": "AI coding CLIs ready",
  "features.2.body":
    "Claude Code, Codex CLI, OpenCode, Oh My ClaudeCode (OMC), Oh My Codex (OMX), Oh My OpenAgent, and SaladDay cc-switch-cli are preinstalled.",
  "features.3.title": "Persistent named volumes",
  "features.3.body":
    "Projects, credentials, caches, logs, models, and backups live in six named volumes that survive container recreate.",
  "features.4.title": "Docker from inside",
  "features.4.body":
    "Docker CLI, Compose, and Buildx talk to the host docker.sock. Powerful — and intentionally trusted-single-user only.",
  "features.5.title": "Multi-language toolchains",
  "features.5.body":
    "Node.js, pnpm, Bun, Python/uv, Go, Rust, OpenJDK, GitHub CLI, and common developer utilities ship in the image.",
  "features.6.title": "Terminal + tmux workflow",
  "features.6.body":
    "Enter with scripts/shell or scripts/tmux. Keep sessions alive across host SSH disconnects without an in-container SSH daemon.",
  "showcase.title": "Built for durable AI coding sessions.",
  "showcase.subtitle": "Terminal-first by design — illustrated below, not presented as product screenshots.",
  "showcase.1.title": "Powerful enough for serious development",
  "showcase.1.body":
    "Keep toolchains, AI CLIs, and project state together. Recreate the container without throwing away /workspace or /config.",
  "showcase.2.title": "Run AI coding workflows without rebuilding every time",
  "showcase.2.body":
    "Credentials and tool homes resolve through configuration generations so Claude, Codex, and gh keep working after restarts.",
  "showcase.3.title": "Host access in, container shell next",
  "showcase.3.body":
    "There is no in-container SSH daemon. Reach your Docker host first, then use scripts/shell or scripts/tmux for the supported dev identity.",
  "showcase.panel": "// illustrative panel",
  "how.title": "How it works",
  "how.subtitle": "Three steps from a trusted Docker host to a ready AI development shell.",
  "how.1.title": "Start",
  "how.1.body": "On a Linux Docker host with Engine, Compose v2, and a working docker.sock:",
  "how.2.title": "Enter",
  "how.2.body": "Open the supported Zsh session as dev (not a web app URL, not SSH into the container):",
  "how.2.code": "scripts/shell\n# or durable sessions:\nscripts/tmux",
  "how.3.title": "Build",
  "how.3.body": "Authenticate tools as needed, then develop under /workspace with your AI coding agents.",
  "how.3.code": "scripts/exec claude auth login\nscripts/exec codex login --device-auth",
  "agents.title": "Bring your favorite AI coding agents.",
  "agents.subtitle":
    "Works with your preinstalled AI coding tools. These are packaged CLIs shipped in the image.",
  "agents.1.name": "Claude Code",
  "agents.1.body":
    "Preinstalled CLI for agentic coding. Authenticate with scripts/exec claude auth login and keep state in the active config generation.",
  "agents.2.name": "Codex CLI",
  "agents.2.body":
    "Preinstalled OpenAI Codex CLI. Device auth works well on headless servers via scripts/exec codex login --device-auth.",
  "agents.3.name": "Oh My ClaudeCode (OMC)",
  "agents.3.body":
    "Pinned OMC CLI ships in the image. Project plugin setup is a per-repo Claude Code workflow under /workspace.",
  "agents.4.name": "Oh My Codex (OMX)",
  "agents.4.body":
    "User-scope OMX initialization runs offline on fresh config volumes. Project setup stays repository-local under /workspace.",
  "agents.5.name": "cc-switch-cli",
  "agents.5.body":
    "SaladDay headless TUI/scriptable CLI for Claude provider switching — not the desktop GUI of a similar name.",
  "agents.6.name": "OpenCode",
  "agents.6.body":
    "Pinned OpenCode CLI. Authenticate from the TUI with scripts/exec opencode. Config lives in the active generation.",
  "agents.7.name": "Oh My OpenAgent",
  "agents.7.body":
    "Ultimate OpenCode plugin, registered offline on first boot. Verify with scripts/exec oh-my-openagent doctor. Codex Light is not installed.",
  "quick.title": "Get started in minutes.",
  "quick.subtitlePrefix": "Prerequisites: Linux Docker host, Docker Engine, Compose v2, working /var/run/docker.sock, amd64 or arm64. Default image:",
  "quick.step1": "1. Clone",
  "quick.step2": "2. Start",
  "quick.step3": "3. Enter the environment",
  "quick.note":
    "There is no published web app port and no in-container SSH daemon. On a remote machine, reach the Docker host first, then use the scripts above.",
  "quick.docs": "Read the full documentation →",
  "use.title": "Where it fits",
  "use.subtitle": "Practical deployments on hosts you already control.",
  "use.1.title": "Personal AI development",
  "use.1.body":
    "Run Claude Code, Codex, and your toolchains in one trusted container on your own machine or server.",
  "use.2.title": "Remote development",
  "use.2.body":
    "Connect to the Docker host from another device, then attach with scripts/shell or scripts/tmux. The container does not expose its own SSH service.",
  "use.3.title": "Homelab / NAS",
  "use.3.body":
    "If your NAS or homelab can run Linux Docker with a docker.sock, you can host the environment there under the same security assumptions.",
  "use.4.title": "Reproducible development",
  "use.4.body":
    "Pin image tags, keep state in named volumes, and recreate containers without rebuilding your personal toolchain from scratch.",
  "faq.title": "FAQ",
  "faq.1.q": "What is AI Dev Server?",
  "faq.1.a":
    "An immutable Ubuntu 24.04 terminal development environment distributed as a multi-arch Docker image. It preinstalls AI coding CLIs, language toolchains, and Docker client tools, with durable state in named volumes.",
  "faq.2.q": "Why use Docker?",
  "faq.2.a":
    "The image stays immutable while projects and credentials live in volumes. You can recreate the container, pin versions, and keep a consistent toolchain without polluting the host user environment.",
  "faq.3.q": "Which AI coding agents are supported?",
  "faq.3.a":
    "The image preinstalls Claude Code, Codex CLI, OpenCode, Oh My ClaudeCode (OMC), Oh My Codex (OMX), Oh My OpenAgent, and SaladDay cc-switch-cli. Authentication is manual and persists in the active /config generation.",
  "faq.4.q": "Can I run it on a NAS?",
  "faq.4.a":
    "If the NAS provides a Linux Docker Engine, Compose v2, and a usable docker.sock on amd64/arm64, yes — under the same trusted single-user security model.",
  "faq.5.q": "Can I customize the development environment?",
  "faq.5.a":
    "Install project dependencies inside /workspace as usual. Image contents change through reviewed image rebuilds/tags rather than runtime self-updaters.",
  "faq.6.q": "Where is my source code stored?",
  "faq.6.a":
    "Projects live in the workspace named volume mounted at /workspace. Configuration and credentials live under /config generations. data, logs, models, and backups have their own volumes.",
  "faq.7.q": "Is there a browser-based product UI or published localhost app port?",
  "faq.7.a":
    "No. AI Dev Server is terminal-first and does not ship a browser product UI. Compose does not publish an application HTTP port. Enter with scripts/shell or scripts/tmux.",
  "faq.8.q": "Does the container provide its own SSH service?",
  "faq.8.a":
    "No. The image does not run an SSH daemon. Connect to the Docker host first, then use scripts/shell. Use tmux to retain sessions across host disconnects.",
  "faq.9.q": "Is it open source?",
  "faq.9.a": "Yes. The project is licensed under the MIT License.",
  "faq.10.q": "How can I contribute?",
  "faq.10.a":
    "Read CONTRIBUTING.md, keep persistence and security contracts intact, add tests for behavior changes, and open a pull request on GitHub.",
  "cta.title": "Ready to build with AI?",
  "cta.subtitle":
    "Set up your own self-hosted AI development environment today — no account, no subscription, just Docker on a host you trust.",
  "cta.primary": "Get Started",
  "cta.secondary": "Star on GitHub",
  "footer.blurb": "Open source AI development environment. Self-hosted, Docker-native, terminal-first.",
  "footer.license": "License",
  "footer.product": "Product",
  "footer.resources": "Resources",
  "footer.community": "Community",
  "footer.features": "Features",
  "footer.docs": "Documentation",
  "footer.installation": "Installation",
  "footer.configuration": "Configuration",
  "footer.security": "Security",
  "footer.faq": "FAQ",
  "footer.contributing": "Contributing",
  "footer.github": "GitHub",
  "footer.image": "Default image",
  "docs.nav": "Documentation",
  "docs.heading": "Docs",
  "copy": "Copy",
  "copied": "Copied",
  "skip": "Skip to content",
} as const;

type Dictionary = { [K in keyof typeof en]: string };

const zh: Dictionary = {
  "meta.title": "AI Dev Server — 随时随地的 AI 开发环境",
  "meta.description":
    "自托管的不可变 Ubuntu 24.04 终端开发环境，预装 Claude Code、Codex CLI 与多语言工具链，通过 Docker Compose 在 amd64/arm64 上运行。",
  "nav.features": "功能",
  "nav.docs": "文档",
  "nav.github": "GitHub",
  "nav.menuOpen": "打开菜单",
  "nav.menuClose": "关闭菜单",
  "nav.mobile": "移动导航",
  "nav.primary": "主导航",
  "theme.toggle": "切换颜色主题",
  "lang.label": "语言",
  "lang.en": "English",
  "lang.zh": "中文",
  "hero.badge": "开源 · 自托管 · Docker 原生",
  "hero.kicker": "AI 开发环境",
  "hero.titleBefore": "你的 AI 开发环境，",
  "hero.titleAfter": "随时随地。",
  "hero.subtitle":
    "在自托管、不可变的 Ubuntu 24.04 终端环境中运行 Claude Code、Codex CLI 与常用开发工具，支持 amd64 与 arm64。",
  "hero.ctaPrimary": "开始使用",
  "hero.ctaSecondary": "查看 GitHub",
  "mock.caption": "示意性终端界面（非产品截图）",
  "mock.workspace": "/workspace",
  "mock.hostComment": "# 在 Docker 宿主机上",
  "mock.insideComment": "# 容器内以 dev 用户",
  "mock.footerLine": "持久化卷 · docker sock · 多架构镜像",
  "features.title": "用 AI 构建，你需要的都在这里。",
  "features.subtitle": "面向 AI 编程助手与日常开发的 Docker 原生终端环境。",
  "features.1.title": "不可变多架构镜像",
  "features.1.body":
    "基于 Ubuntu 24.04，支持 linux/amd64 与 linux/arm64。升级通过审阅后的镜像标签完成，而不是运行时自更新。",
  "features.2.title": "AI 编程 CLI 就绪",
  "features.2.body":
    "预装 Claude Code、Codex CLI、OpenCode、Oh My ClaudeCode（OMC）、Oh My Codex（OMX）、Oh My OpenAgent 与 SaladDay cc-switch-cli。",
  "features.3.title": "持久化命名卷",
  "features.3.body":
    "项目、凭据、缓存、日志、模型与备份保存在六个命名卷中，容器重建后仍然保留。",
  "features.4.title": "容器内使用 Docker",
  "features.4.body":
    "Docker CLI / Compose / Buildx 通过宿主机 docker.sock 工作。能力很强——因此仅适合可信的单用户主机。",
  "features.5.title": "多语言工具链",
  "features.5.body":
    "镜像内含 Node.js、pnpm、Bun、Python/uv、Go、Rust、OpenJDK、GitHub CLI 以及常用开发工具。",
  "features.6.title": "终端 + tmux 工作流",
  "features.6.body":
    "通过 scripts/shell 或 scripts/tmux 进入。宿主机 SSH 断开后仍可保持会话；镜像不提供容器内 SSH 服务。",
  "showcase.title": "为持久的 AI 编程会话而设计。",
  "showcase.subtitle": "终端优先——以下为示意，并非产品截图。",
  "showcase.1.title": "足以支撑严肃开发",
  "showcase.1.body":
    "把工具链、AI CLI 与项目状态放在一起。重建容器时不必丢掉 /workspace 或 /config。",
  "showcase.2.title": "不必每次重建环境再开始 AI 工作流",
  "showcase.2.body":
    "凭据与工具主目录通过配置代（generation）解析，Claude、Codex 与 gh 在重启后仍可继续使用。",
  "showcase.3.title": "先到宿主机，再进容器 shell",
  "showcase.3.body":
    "没有容器内 SSH 服务。先到达 Docker 宿主机，再使用 scripts/shell 或 scripts/tmux 进入受支持的 dev 身份。",
  "showcase.panel": "// 示意面板",
  "how.title": "工作原理",
  "how.subtitle": "从可信 Docker 主机到可用 AI 开发 shell，只需三步。",
  "how.1.title": "启动",
  "how.1.body": "在具备 Engine、Compose v2 与可用 docker.sock 的 Linux Docker 主机上：",
  "how.2.title": "进入",
  "how.2.body": "以 dev 用户打开受支持的 Zsh 会话（不是 Web 应用地址，也不是 SSH 进容器）：",
  "how.2.code": "scripts/shell\n# 或持久会话：\nscripts/tmux",
  "how.3.title": "开始构建",
  "how.3.body": "按需完成工具登录，然后在 /workspace 中与 AI 编程助手一起开发。",
  "how.3.code": "scripts/exec claude auth login\nscripts/exec codex login --device-auth",
  "agents.title": "带上你常用的 AI 编程助手。",
  "agents.subtitle": "面向镜像内预装的 AI 编程工具。它们是随镜像提供的 CLI，而不是额外的 SaaS 控制台。",
  "agents.1.name": "Claude Code",
  "agents.1.body":
    "预装的智能编程 CLI。使用 scripts/exec claude auth login 登录，状态保存在当前配置代中。",
  "agents.2.name": "Codex CLI",
  "agents.2.body":
    "预装的 OpenAI Codex CLI。无图形服务器上可用 scripts/exec codex login --device-auth 完成设备登录。",
  "agents.3.name": "Oh My ClaudeCode（OMC）",
  "agents.3.body":
    "镜像内含锁定版本的 OMC CLI。项目级插件配置是 /workspace 下按仓库进行的 Claude Code 工作流。",
  "agents.4.name": "Oh My Codex（OMX）",
  "agents.4.body":
    "新配置卷会离线完成用户级 OMX 初始化。项目级配置仍保留在 /workspace 仓库本地。",
  "agents.5.name": "cc-switch-cli",
  "agents.5.body":
    "SaladDay 无头 TUI/可脚本 CLI，用于 Claude 提供方切换——不是同名桌面 GUI。",
  "agents.6.name": "OpenCode",
  "agents.6.body":
    "锁定版本的 OpenCode CLI。使用 scripts/exec opencode 在 TUI 中登录。配置保存在当前配置代。",
  "agents.7.name": "Oh My OpenAgent",
  "agents.7.body":
    "OpenCode Ultimate 插件，首次启动离线注册。用 scripts/exec oh-my-openagent doctor 检查。未安装 Codex Light。",
  "quick.title": "几分钟即可开始。",
  "quick.subtitlePrefix":
    "前提：Linux Docker 主机、Docker Engine、Compose v2、可用 /var/run/docker.sock、amd64 或 arm64。默认镜像：",
  "quick.step1": "1. 克隆",
  "quick.step2": "2. 启动",
  "quick.step3": "3. 进入环境",
  "quick.note":
    "没有发布 Web 应用端口，也没有容器内 SSH 服务。若在远程机器使用，先到达 Docker 宿主机，再执行上述脚本。",
  "quick.docs": "阅读完整文档 →",
  "use.title": "适用场景",
  "use.subtitle": "部署在你已经掌控的主机上。",
  "use.1.title": "个人 AI 开发",
  "use.1.body": "在自己的机器或服务器上，用一个可信容器运行 Claude Code、Codex 与完整工具链。",
  "use.2.title": "远程开发",
  "use.2.body":
    "从其他设备连接到 Docker 宿主机，再用 scripts/shell 或 scripts/tmux 进入。容器本身不暴露 SSH 服务。",
  "use.3.title": "Homelab / NAS",
  "use.3.body":
    "若 NAS 或家庭实验室可运行 Linux Docker 并提供 docker.sock，可在相同安全假设下托管该环境。",
  "use.4.title": "可复现的开发环境",
  "use.4.body": "固定镜像标签，状态放入命名卷，重建容器时不必从零搭建个人工具链。",
  "faq.title": "常见问题",
  "faq.1.q": "什么是 AI Dev Server？",
  "faq.1.a":
    "以多架构 Docker 镜像分发的不可变 Ubuntu 24.04 终端开发环境。预装 AI 编程 CLI、语言工具链与 Docker 客户端工具，状态保存在命名卷中。",
  "faq.2.q": "为什么使用 Docker？",
  "faq.2.a":
    "镜像保持不可变，项目与凭据放在卷中。你可以重建容器、固定版本，并获得一致工具链，而不污染宿主机用户环境。",
  "faq.3.q": "支持哪些 AI 编程工具？",
  "faq.3.a":
    "镜像预装 Claude Code、Codex CLI、OpenCode、Oh My ClaudeCode（OMC）、Oh My Codex（OMX）、Oh My OpenAgent 与 SaladDay cc-switch-cli。认证需手动完成，并持久化在当前 /config 配置代中。",
  "faq.4.q": "可以在 NAS 上运行吗？",
  "faq.4.a":
    "若 NAS 提供 Linux Docker Engine、Compose v2，以及 amd64/arm64 上可用的 docker.sock，可以——前提是遵循同一套可信单用户安全模型。",
  "faq.5.q": "可以自定义开发环境吗？",
  "faq.5.a":
    "可在 /workspace 中按项目安装依赖。镜像内容通过审阅后的重建/标签变更，而不是运行时自我更新。",
  "faq.6.q": "源代码存在哪里？",
  "faq.6.a":
    "项目位于挂载为 /workspace 的 workspace 卷。配置与凭据在 /config 配置代中。data、logs、models、backups 各有独立卷。",
  "faq.7.q": "有没有基于浏览器的产品界面或本地 Web 端口？",
  "faq.7.a":
    "没有。AI Dev Server 以终端为先，不提供浏览器产品界面。Compose 不发布应用 HTTP 端口。请使用 scripts/shell 或 scripts/tmux 进入。",
  "faq.8.q": "容器是否提供自己的 SSH 服务？",
  "faq.8.a":
    "不提供。镜像不运行 SSH 守护进程。请先连接到 Docker 宿主机，再使用 scripts/shell；可用 tmux 在断开后保持会话。",
  "faq.9.q": "是开源的吗？",
  "faq.9.a": "是的，项目采用 MIT 许可证。",
  "faq.10.q": "如何贡献？",
  "faq.10.a":
    "阅读 CONTRIBUTING.md，保持持久化与安全约定，为行为变更补充测试，并在 GitHub 提交拉取请求。",
  "cta.title": "准备好用 AI 构建了吗？",
  "cta.subtitle": "今天就搭建属于你的自托管 AI 开发环境——无需账号，无需订阅，只要你信任的 Docker 主机。",
  "cta.primary": "开始使用",
  "cta.secondary": "在 GitHub 上 Star",
  "footer.blurb": "开源 AI 开发环境。自托管、Docker 原生、终端优先。",
  "footer.license": "许可证",
  "footer.product": "产品",
  "footer.resources": "资源",
  "footer.community": "社区",
  "footer.features": "功能",
  "footer.docs": "文档",
  "footer.installation": "安装",
  "footer.configuration": "配置",
  "footer.security": "安全",
  "footer.faq": "常见问题",
  "footer.contributing": "贡献",
  "footer.github": "GitHub",
  "footer.image": "默认镜像",
  "docs.nav": "文档",
  "docs.heading": "文档",
  "copy": "复制",
  "copied": "已复制",
  "skip": "跳到正文",
};

export type UIKey = keyof typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, zh };

export function t(locale: Locale, key: UIKey): string {
  return dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
}

export function useTranslations(locale: Locale) {
  return (key: UIKey) => t(locale, key);
}