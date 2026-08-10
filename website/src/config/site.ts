/** Marketing site constants. Canonical URL for SEO comes from Astro `site` (env SITE). */
export const siteConfig = {
  name: "AI Dev Server",
  shortName: "ai-dev",
  tagline: "Your AI Development Environment, Anywhere.",
  description:
    "Self-hosted immutable Ubuntu 24.04 terminal development environment with Claude Code, Codex CLI, and multi-language toolchains — run via Docker Compose on amd64 and arm64.",
  /** Fallback only when Astro.site is unavailable at build time. Prefer env SITE in astro.config.mjs. */
  fallbackUrl: "https://ai-dev-server.vercel.app",
  github: "https://github.com/mufeng510/ai-dev-server",
  image: "docker.io/jerry0510/ai-dev:latest",
  license: "MIT",
  copyrightYear: 2026,
  ogImage: "/og-image.png",
  nav: [
    { label: "Features", href: "/#features" },
    { label: "Docs", href: "/docs" },
    { label: "GitHub", href: "https://github.com/mufeng510/ai-dev-server", external: true },
  ],
  footer: {
    product: [
      { label: "Features", href: "/#features" },
      { label: "Documentation", href: "/docs" },
      { label: "GitHub", href: "https://github.com/mufeng510/ai-dev-server", external: true },
    ],
    resources: [
      { label: "Installation", href: "/docs/installation" },
      { label: "Configuration", href: "/docs/configuration" },
      { label: "Security", href: "/docs/security" },
      { label: "FAQ", href: "/docs/faq" },
      { label: "Contributing", href: "https://github.com/mufeng510/ai-dev-server/blob/main/CONTRIBUTING.md", external: true },
    ],
    community: [
      { label: "GitHub", href: "https://github.com/mufeng510/ai-dev-server", external: true },
    ],
  },
} as const;

export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
};