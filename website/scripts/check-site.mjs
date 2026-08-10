import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const failures = [];

function fail(msg) {
  failures.push(msg);
}

function exists(p) {
  return fs.existsSync(p);
}

function read(p) {
  return fs.readFileSync(p, "utf8");
}

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

const requiredRoutes = [
  "index.html",
  "docs/index.html",
  "docs/installation/index.html",
  "docs/docker/index.html",
  "docs/configuration/index.html",
  "docs/agents/index.html",
  "docs/security/index.html",
  "docs/faq/index.html",
  "docs/troubleshooting/index.html",
];

for (const route of requiredRoutes) {
  if (!exists(path.join(dist, route))) fail(`missing route: ${route}`);
}

const htmlFiles = walk(dist).filter((f) => f.endsWith(".html"));
const allHtml = htmlFiles.map((f) => read(f)).join("\n");
const home = exists(path.join(dist, "index.html")) ? read(path.join(dist, "index.html")) : "";
const security = exists(path.join(dist, "docs/security/index.html"))
  ? read(path.join(dist, "docs/security/index.html"))
  : "";

// T4
if (!home.includes("docker compose up -d")) fail("T4: home missing docker compose up -d");
if (!home.includes("scripts/shell")) fail("T4: home missing scripts/shell");

// T5 agents
for (const name of ["Claude Code", "Codex CLI", "Oh My ClaudeCode", "Oh My Codex", "cc-switch"]) {
  if (!allHtml.includes(name) && !allHtml.includes(name.replace("Oh My ClaudeCode", "OMC"))) {
    // allow OMC/OMX short forms already present via long names mostly
    if (!allHtml.includes(name)) fail(`T5: missing agent mention: ${name}`);
  }
}

// T6 security
const secOk =
  /host-root/i.test(security) &&
  /trusted single-user/i.test(security);
if (!secOk) fail("T6: security page missing host-root / trusted single-user wording");

// T7
if (!allHtml.includes("MIT")) fail("T7: MIT missing");
if (!allHtml.includes("github.com/mufeng510/ai-dev-server")) fail("T7: GitHub URL missing");

// T8 theme contract in source
const layout = read(path.join(root, "src/layouts/Layout.astro"));
const theme = read(path.join(root, "src/components/ThemeToggle.astro"));
if (!layout.includes("ai-dev-theme") || !theme.includes("ai-dev-theme")) fail("T8: ai-dev-theme key missing");
if (!/(light|dark|system)/.test(theme)) fail("T8: theme modes missing");
if (!layout.includes("localStorage.getItem")) fail("T8: FOUC boot script missing");

// T9 mobile menu
const mobile = read(path.join(root, "src/components/MobileMenu.astro"));
if (!mobile.includes("button") || !mobile.includes("Escape")) fail("T9: mobile menu button/Escape missing");

// T10 copy
const codeBlock = read(path.join(root, "src/components/CodeBlock.astro"));
if (!codeBlock.includes("Copied")) fail("T10: CodeBlock missing Copied state");

// T13 claim policy — affirmative bans site-wide (allow explicit denials)
function stripDenialSentences(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/[^.?!]*(?:\bno\b|\bnot\b|\bdoes not\b|\bdo not\b|\bwithout\b|\brather than\b)[^.?!]*[.?!]/gi, " ");
}
const siteClaims = stripDenialSentences(allHtml);
const banned = [
  /\bbrowser IDE\b/i,
  /\bweb IDE\b/i,
  /\bweb terminal product\b/i,
  /\bopen the web interface\b/i,
  /\bofficial integration\b/i,
  /\bSSH into the container\b/i,
  /\bbuilt-in SSH server\b/i,
];
for (const re of banned) {
  if (re.test(siteClaims)) fail(`T13: forbidden affirmative claim: ${re}`);
}
if (/http:\/\/localhost:\d+/i.test(siteClaims)) fail("T13: localhost app URL claim");

// T14
if (!allHtml.includes("docker.io/jerry0510/ai-dev:latest")) fail("T14: default image missing");

// T15
const css = read(path.join(root, "src/styles/global.css"));
if (!css.includes("prefers-reduced-motion")) fail("T15: reduced-motion missing");

// T16 SEO home
for (const needle of [
  "<title>",
  'name="description"',
  'rel="canonical"',
  'property="og:title"',
  'property="og:image"',
  'name="twitter:card"',
]) {
  if (!home.includes(needle)) fail(`T16: home missing ${needle}`);
}

// T17 sitemap/robots
const distFiles = walk(dist).map((f) => path.relative(dist, f).replace(/\\/g, "/"));
if (!distFiles.some((f) => f.includes("sitemap"))) fail("T17: sitemap missing");
if (!distFiles.some((f) => f.endsWith("robots.txt"))) fail("T17: robots.txt missing");

// T18 mock label
if (!/Illustrative terminal mockup|mockup \(not a product screenshot\)/i.test(home)) {
  fail("T18: mock illustration label missing");
}

// T19 scripts
const pkg = JSON.parse(read(path.join(root, "package.json")));
for (const s of ["dev", "build", "preview"]) {
  if (!pkg.scripts?.[s]) fail(`T19: package.json missing script ${s}`);
}

// T20 volumes
for (const vol of ["workspace", "config", "data", "logs", "models", "backups"]) {
  if (!allHtml.includes(vol)) fail(`T20: missing volume mention ${vol}`);
}

// T3 static config
const astroConfig = read(path.join(root, "astro.config.mjs"));
if (!astroConfig.includes("output: \"static\"") && !astroConfig.includes("output: 'static'")) {
  fail("T3: output static not set");
}

// T11 basic internal link check from home + docs index
function checkLinks(html, fileLabel) {
  const re = /href="(\/[^"#?]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (href.startsWith("/#") || href === "/") {
      if (href === "/" || href.startsWith("/#")) continue;
    }
    let target;
    if (href === "/docs" || href === "/docs/") target = path.join(dist, "docs/index.html");
    else if (href.endsWith("/")) target = path.join(dist, href.slice(1), "index.html");
    else target = path.join(dist, href.slice(1), "index.html");
    // also try direct file
    const alt = path.join(dist, href.slice(1));
    const altHtml = `${alt}.html`;
    if (href.includes("#")) continue;
    if (href === "/") continue;
    if (!(exists(target) || exists(alt) || exists(altHtml) || exists(path.join(dist, href.slice(1), "index.html")))) {
      // fragment-only already skipped; allow /#features style already skipped by regex
      if (!href.includes("github.com")) fail(`T11: dead link ${href} from ${fileLabel}`);
    }
  }
}
if (home) checkLinks(home, "home");
const docsIndex = path.join(dist, "docs/index.html");
if (exists(docsIndex)) checkLinks(read(docsIndex), "docs");

// public assets
if (!exists(path.join(root, "public/favicon.svg"))) fail("favicon.svg missing");
if (!exists(path.join(root, "public/og-image.png"))) fail("og-image.png missing");

if (failures.length) {
  console.error("check-site failed:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log(`check-site passed (${htmlFiles.length} html files)`);
