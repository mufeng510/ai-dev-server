import type { APIRoute } from "astro";

const getSite = (site: URL | undefined) => (site ? site.href.replace(/\/$/, "") : "https://ai-dev-server.vercel.app");

export const GET: APIRoute = ({ site }) => {
  const base = getSite(site);
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap-index.xml\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};