# AI Dev Server Website

Marketing and documentation site for [AI Dev Server](https://github.com/mufeng510/ai-dev-server).

## Stack

- Astro (static output)
- TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- MDX content collections

## Local development

```bash
cd website
npm install
npm run dev
```

## Build

```bash
cd website
npm install
npm run build
```

`npm run build` runs `astro build` and `scripts/check-site.mjs` acceptance checks.

## Vercel

- Repository: `mufeng510/ai-dev-server`
- **Root Directory:** `website`
- Build command: `npm run build`
- Output directory: `dist`
- Optional environment variable: `SITE=https://your-production-domain` (drives canonical URLs, Open Graph, sitemap, and robots.txt)

No GitHub Actions workflow is required for website deploy when Vercel is connected directly to the repo.

## Product copy rules

Do not describe AI Dev Server as a browser IDE or claim a published localhost app port. Entry is `docker compose up -d` then `scripts/shell` / `scripts/tmux`.