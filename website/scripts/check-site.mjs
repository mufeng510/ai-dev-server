import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const failures = [];
const fail = (msg) => failures.push(msg);
const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, "utf8");
function walk(dir) {
  const out = [];
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

if (!exists(dist)) fail("dist/ missing — run astro build first");

const docSlugs = ["", "installation", "docker", "configuration", "agents", "security", "faq", "troubleshooting"];
function docRoute(locale, slug) {
  const base = locale === "zh" ? "zh/docs" : "docs";
  if (!slug) return path.join(dist, base, "index.html");
  return path.join(dist, base, slug, "index.html");
}

// routes
if (!exists(path.join(dist, "index.html"))) fail("missing EN home");
if (!exists(path.join(dist, "zh", "index.html"))) fail("missing ZH home");
for (const slug of docSlugs) {
  if (!exists(docRoute("en", slug))) fail(`missing EN docs route: ${slug || "index"}`);
  if (!exists(docRoute("zh", slug))) fail(`missing ZH docs route: ${slug || "index"}`);
}

const htmlFiles = walk(dist).filter((f) => f.endsWith(".html"));
const allHtml = htmlFiles.map((f) => read(f)).join("\n");
const enHome = exists(path.join(dist, "index.html")) ? read(path.join(dist, "index.html")) : "";
const zhHome = exists(path.join(dist, "zh", "index.html")) ? read(path.join(dist, "zh", "index.html")) : "";
const enSec = exists(docRoute("en", "security")) ? read(docRoute("en", "security")) : "";
const zhSec = exists(docRoute("zh", "security")) ? read(docRoute("zh", "security")) : "";

// quickstart both locales
for (const [label, html] of [["en", enHome], ["zh", zhHome]]) {
  if (!html.includes("docker compose up -d")) fail(`${label} home missing docker compose up -d`);
  if (!html.includes("scripts/shell")) fail(`${label} home missing scripts/shell`);
}

// agents
for (const name of ["Claude Code", "Codex CLI", "OpenCode", "Oh My OpenAgent", "Grok Build", "cc-switch"]) {
  if (!allHtml.includes(name)) fail(`missing agent mention: ${name}`);
}

// security both
if (!/host-root/i.test(enSec) || !/trusted single-user/i.test(enSec)) fail("EN security missing host-root/trusted single-user");
if (!/宿主机 root|等同于.*root/i.test(zhSec) || !/可信.*单用户|单用户/i.test(zhSec)) fail("ZH security missing root/single-user wording");

// MIT + github
if (!allHtml.includes("MIT")) fail("MIT missing");
if (!allHtml.includes("github.com/mufeng510/ai-dev-server")) fail("GitHub URL missing");

// theme
const layout = read(path.join(root, "src/layouts/Layout.astro"));
const theme = read(path.join(root, "src/components/ThemeToggle.astro"));
if (!layout.includes("ai-dev-theme") || !theme.includes("ai-dev-theme")) fail("ai-dev-theme key missing");

// mobile + copy
const mobile = read(path.join(root, "src/components/MobileMenu.astro"));
if (!mobile.includes("Escape")) fail("mobile Escape missing");
const codeBlock = read(path.join(root, "src/components/CodeBlock.astro"));
if (!codeBlock.includes("copied") && !codeBlock.includes("Copied") && !codeBlock.includes("已复制")) fail("CodeBlock copied state missing");

// language switcher
if (!enHome.includes('hreflang="zh-CN"') && !enHome.includes(">中文<")) fail("EN home missing language switcher cues");
if (!zhHome.includes('hreflang="en"') && !zhHome.includes(">English<")) fail("ZH home missing language switcher cues");
if (!enHome.includes('hreflang="x-default"')) fail("EN home missing hreflang x-default");
if (!zhHome.includes('hreflang="x-default"')) fail("ZH home missing hreflang x-default");
if (!enHome.includes('lang="en"') && !enHome.includes("lang=\"en\"")) {
  // html lang
}
if (!/<html[^>]*lang="en"/i.test(enHome)) fail("EN home html lang not en");
if (!/<html[^>]*lang="zh-CN"/i.test(zhHome)) fail("ZH home html lang not zh-CN");

// claim policy bilingual
function stripDenial(html, locale) {
  let text = html.replace(/<[^>]+>/g, " ");
  if (locale === "zh") {
    text = text.replace(/[^。！？\n]*(?:不|没|非|未|而非|不是|没有)[^。！？\n]*[。！？\n]/g, " ");
  } else {
    text = text.replace(/[^.?!]*(?:\bno\b|\bnot\b|\bdoes not\b|\bdo not\b|\bwithout\b|\brather than\b)[^.?!]*[.?!]/gi, " ");
  }
  return text;
}
const enBanned = [/\bbrowser IDE\b/i, /\bweb IDE\b/i, /\bweb terminal product\b/i, /\bopen the web interface\b/i, /\bofficial integration\b/i, /\bSSH into the container\b/i, /\bbuilt-in SSH server\b/i];
const zhBanned = [/浏览器\s*IDE/i, /网页\s*IDE/i, /官方集成/i, /SSH\s*进入容器/i, /内置\s*SSH\s*服务/i, /内置 SSH 守护/i];
const enClaims = stripDenial(enHome + enSec, "en");
const zhClaims = stripDenial(zhHome + zhSec, "zh");
for (const re of enBanned) if (re.test(enClaims)) fail(`EN affirmative claim: ${re}`);
for (const re of zhBanned) if (re.test(zhClaims)) fail(`ZH affirmative claim: ${re}`);
if (/http:\/\/localhost:\d+/i.test(enClaims) || /http:\/\/localhost:\d+/i.test(zhClaims)) fail("localhost app URL claim");

// default image + volumes
if (!allHtml.includes("docker.io/jerry0510/ai-dev:latest")) fail("default image missing");
for (const vol of ["workspace", "config", "data", "logs", "models", "backups"]) {
  if (!allHtml.includes(vol)) fail(`missing volume ${vol}`);
}

// SEO home
for (const needle of ["<title>", 'name="description"', 'rel="canonical"', 'property="og:title"', 'property="og:image"', 'name="twitter:card"']) {
  if (!enHome.includes(needle)) fail(`EN home missing ${needle}`);
  if (!zhHome.includes(needle)) fail(`ZH home missing ${needle}`);
}

// sitemap/robots
const distFiles = walk(dist).map((f) => path.relative(dist, f).replace(/\\/g, "/"));
if (!distFiles.some((f) => f.includes("sitemap"))) fail("sitemap missing");
if (!distFiles.some((f) => f.endsWith("robots.txt"))) fail("robots.txt missing");
const sitemapText = distFiles.filter((f) => f.includes("sitemap")).map((f) => read(path.join(dist, f))).join("\n");
if (!sitemapText.includes("/zh")) fail("sitemap missing /zh routes");

// mock labels
if (!/Illustrative terminal mockup|mockup \(not a product screenshot\)/i.test(enHome)) fail("EN mock label missing");
if (!/示意性终端|非产品截图/.test(zhHome)) fail("ZH mock label missing");

// package scripts + static
const pkg = JSON.parse(read(path.join(root, "package.json")));
for (const s of ["dev", "build", "preview"]) if (!pkg.scripts?.[s]) fail(`missing script ${s}`);
const astroConfig = read(path.join(root, "astro.config.mjs"));
if (!astroConfig.includes("output: \"static\"") && !astroConfig.includes("output: 'static'")) fail("output static missing");
if (!astroConfig.includes("locales") || !astroConfig.includes("\"zh\"")) fail("astro i18n locales missing");

// i18n source present
if (!exists(path.join(root, "src/i18n/ui.ts"))) fail("ui.ts missing");
if (!exists(path.join(root, "src/i18n/utils.ts"))) fail("utils.ts missing");

// basic internal link check
function checkLinks(html, fileLabel) {
  const re = /href="(\/[^"#?]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (href.startsWith("/#") || href === "/") continue;
    let target;
    if (href.endsWith("/")) target = path.join(dist, href.slice(1), "index.html");
    else target = path.join(dist, href.slice(1), "index.html");
    const alt = path.join(dist, href.slice(1));
    const altHtml = `${alt}.html`;
    if (!(exists(target) || exists(alt) || exists(altHtml))) {
      // allow only if github external already excluded by regex
      fail(`dead link ${href} from ${fileLabel}`);
    }
  }
}
if (enHome) checkLinks(enHome, "en-home");
if (zhHome) checkLinks(zhHome, "zh-home");

if (failures.length) {
  console.error("check-site failed:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log(`check-site passed (${htmlFiles.length} html files, en+zh)`);