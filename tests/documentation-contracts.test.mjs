import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replaceAll("\r\n", "\n");
}

test("README warns about Docker Socket root equivalence before Quick Start", () => {
  const readme = read("README.md");
  const warning = readme.indexOf("## Security Warning");
  const quickStart = readme.indexOf("## Quick Start");

  assert.ok(warning >= 0 && warning < quickStart);
  assert.match(readme.slice(warning, quickStart), /docker\.sock/i);
  assert.match(readme.slice(warning, quickStart), /host-root|host root/i);
  assert.match(readme.slice(warning, quickStart), /trusted, single-user/i);
});

test("README exposes the Simplified Chinese guide, which retains the Docker Socket warning", () => {
  const readme = read("README.md");
  const chineseReadme = read("README.zh-CN.md");

  assert.match(readme, /\[简体中文\]\(README\.zh-CN\.md\)/);
  assert.match(chineseReadme, /Docker Socket/);
  assert.match(chineseReadme, /宿主机 root/);
  assert.match(chineseReadme, /docker compose up -d/);
});

test("operator documentation covers the required Milestone 7 surface", () => {
  const requiredFiles = [
    "README.md",
    "README.zh-CN.md",
    "docs/architecture.md",
    "docs/security.md",
    "docs/upgrade.md",
    "docs/troubleshooting.md",
    "docs/development.md",
    "CONTRIBUTING.md"
  ];

  for (const relativePath of requiredFiles) {
    assert.ok(fs.statSync(path.join(root, relativePath)).size > 0, relativePath);
  }

  const documentation = requiredFiles.map(read).join("\n");
  for (const required of [
    "docker.io/jerry0510/ai-dev",
    "scripts/shell",
    "scripts/exec",
    "GitHub CLI",
    "gh auth login",
    "claude auth login",
    "codex login --device-auth",
    "oh-my-claudecode@omc",
    "omx doctor",
    "cc-switch config path",
    "ai-dev-migrate",
    "ai-dev-rollback",
    "ai-dev-migrate-identity",
    "Backup All Volumes",
    "Restore All Volumes",
    "FAQ",
    "License"
  ]) {
    assert.match(documentation, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), required);
  }
});

test("documentation links resolve locally", () => {
  for (const relativePath of ["README.md", "README.zh-CN.md", "CONTRIBUTING.md", ...fs.readdirSync(path.join(root, "docs")).filter((name) => name.endsWith(".md")).map((name) => `docs/${name}`)]) {
    const source = read(relativePath);
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const destination = match[1];
      if (/^(?:https?:|mailto:|#)/.test(destination)) continue;
      const localPath = destination.split("#", 1)[0];
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(relativePath), localPath)), `${relativePath}: ${destination}`);
    }
  }
});
