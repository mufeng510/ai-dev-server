# AI Dev Server Website

Marketing and documentation site for AI Dev Server.

## Locales

- English (default): `/`, `/docs/...`
- Simplified Chinese: `/zh/`, `/zh/docs/...`

UI strings: `src/i18n/ui.ts`
Docs: `src/content/docs/en` and `src/content/docs/zh`

## Commands

```bash
cd website
npm install
npm run dev
npm run build
```

## Vercel

- Root Directory: `website`
- Build command: `npm run build`
- Output: `dist`
- Optional env: `SITE=https://your-domain`