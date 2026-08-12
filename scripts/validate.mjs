#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const strictTools = args.has("--strict-tools");
const staticOnly = args.has("--static-only");
let failed = false;

function run(label, command, commandArgs, options = {}) {
  const probe = spawnSync(command, ["--version"], { cwd: root, encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    if (options.required || strictTools) {
      console.error(`FAIL ${label}: ${command} is unavailable`);
      failed = true;
    } else console.log(`SKIP ${label}: ${command} is unavailable`);
    return;
  }
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`FAIL ${label}`);
    failed = true;
  } else console.log(`PASS ${label}`);
}

run("version manifest", process.execPath, ["scripts/check-version-manifest.mjs"], { required: true });
if (!staticOnly) run("offline contract tests", process.execPath, ["--test"], { required: true });

const shellFiles = ["entrypoint.sh"]
  .concat(fs.existsSync(path.join(root, "install")) ? fs.readdirSync(path.join(root, "install")).filter((name) => name.endsWith(".sh")).map((name) => `install/${name}`) : [])
  .concat(fs.existsSync(path.join(root, "scripts")) ? fs.readdirSync(path.join(root, "scripts")).filter((name) => name.endsWith(".sh")).map((name) => `scripts/${name}`) : [])
  .filter((name) => fs.existsSync(path.join(root, name)));
if (shellFiles.length) run("shellcheck", "shellcheck", shellFiles);
if (fs.existsSync(path.join(root, "Dockerfile"))) {
  run("Dockerfile version arguments", process.execPath, ["scripts/check-version-manifest.mjs", "--build", "Dockerfile"], { required: true });
  run("hadolint", "hadolint", ["Dockerfile"]);
}
const workflows = fs.existsSync(path.join(root, ".github", "workflows"))
  ? fs.readdirSync(path.join(root, ".github", "workflows")).filter((name) => /\.ya?ml$/.test(name)).map((name) => `.github/workflows/${name}`)
  : [];
if (workflows.length) run("actionlint", "actionlint", workflows);
if (fs.existsSync(path.join(root, "docker-compose.yml"))) CODE_SERVER_PASSWORD=ci-placeholder-not-for-production run("compose config", "docker", ["compose", "config", "--quiet"]);
if (fs.existsSync(path.join(root, "docker-bake.hcl"))) CODE_SERVER_PASSWORD=ci-placeholder-not-for-production run("bake print", "docker", ["buildx", "bake", "--print"]);

if (failed) process.exitCode = 1;
