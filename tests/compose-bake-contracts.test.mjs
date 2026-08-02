import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadEnv } from "../src/contracts.mjs";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replaceAll("\r\n", "\n");
}

function block(source, start, nextPattern) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing block: ${start}`);
  const remainder = source.slice(startIndex + start.length);
  const endMatch = remainder.match(nextPattern);
  return endMatch ? remainder.slice(0, endMatch.index) : remainder;
}

test("Compose defines the production service without requiring an env file", () => {
  const compose = read("docker-compose.yml");
  const service = block(compose, "  ai-dev:\n", /^\S/m);

  assert.match(service, /image: \$\{AI_DEV_IMAGE:-docker\.io\/jerry0510\/ai-dev:latest\}/);
  assert.match(service, /restart: unless-stopped/);
  assert.match(service, /working_dir: \/workspace/);
  assert.match(service, /PUID: \$\{PUID:-1000\}/);
  assert.match(service, /PGID: \$\{PGID:-1000\}/);
  assert.match(service, /TZ: \$\{TZ:-UTC\}/);
  assert.match(service, /test: \["CMD", "\/usr\/local\/bin\/ai-dev-health"\]/);
  assert.doesNotMatch(service, /^\s+(?:ports|expose|env_file):/m);
});

test("Compose mounts exactly six named persistence volumes and the raw socket read-write", () => {
  const compose = read("docker-compose.yml");
  const expected = new Map([
    ["workspace", "/workspace"],
    ["config", "/config"],
    ["data", "/data"],
    ["logs", "/logs"],
    ["models", "/models"],
    ["backups", "/backups"]
  ]);

  for (const [volume, mountPath] of expected) {
    assert.match(compose, new RegExp(`^\\s+- ${volume}:${mountPath}$`, "m"));
  }
  assert.match(compose, /^\s+- \/var\/run\/docker\.sock:\/var\/run\/docker\.sock:rw$/m);

  const declarations = block(compose, "volumes:\n", /$(?![\s\S])/);
  assert.deepEqual(
    [...declarations.matchAll(/^  ([a-z]+):$/gm)].map((match) => match[1]).sort(),
    [...expected.keys()].sort()
  );
});

test("Compose drops default capabilities and does not add privileges or a second init process", () => {
  const compose = read("docker-compose.yml");
  assert.match(compose, /^\s+cap_drop:\s*\n\s+- ALL$/m);
  for (const capability of ["CHOWN", "DAC_OVERRIDE", "FOWNER", "SETGID", "SETUID"]) {
    assert.match(compose, new RegExp(`^\\s+- ${capability}$`, "m"));
  }
  for (const forbidden of ["privileged", "init", "network_mode", "pid", "ipc"]) {
    assert.doesNotMatch(compose, new RegExp(`^\\s+${forbidden}:`, "m"));
  }
});

test("Bake exposes the required build targets and platform contract", () => {
  const bake = read("docker-bake.hcl");
  for (const target of ["general", "image", "test", "validate"]) {
    assert.match(bake, new RegExp(`target "${target}" \\{`));
  }
  assert.match(bake, /platforms\s*=\s*\["linux\/amd64", "linux\/arm64"\]/);
  assert.match(bake, /tags\s*=\s*\["\$\{REGISTRY\}\/\$\{IMAGE\}:\$\{TAG\}"\]/);
  assert.match(bake, /cache-from\s*=\s*\[CACHE_FROM\]/);
  assert.match(bake, /cache-to\s*=\s*\[CACHE_TO\]/);
  assert.match(read("examples/docker-bake.gha.hcl"), /type=gha/);
});

test("Bake passes every immutable version input with the manifest value", () => {
  const bake = read("docker-bake.hcl");
  const versions = loadEnv(path.join(root, "versions.env"));

  for (const [key, value] of Object.entries(versions)) {
    assert.match(bake, new RegExp(`variable "${key}" \\{ default = "${value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}" \\}`));
    assert.match(bake, new RegExp(`^\\s+${key}\\s+= ${key}$`, "m"));
  }
});

test("Bake includes required OCI image labels", () => {
  const bake = read("docker-bake.hcl");
  for (const label of ["title", "description", "source", "revision", "version", "created", "licenses"]) {
    assert.match(bake, new RegExp(`org\\.opencontainers\\.image\\.${label}`));
  }
});
