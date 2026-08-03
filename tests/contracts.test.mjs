import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  REQUIRED_VERSION_KEYS,
  compareStableVersions,
  loadEnv,
  missingBuildArguments,
  parseEnv,
  redact,
  releaseTags,
  shouldPromote,
  validateVersionManifest
} from "../src/contracts.mjs";

const root = path.resolve(import.meta.dirname, "..");
const contracts = JSON.parse(fs.readFileSync(path.join(root, "config/contracts.json"), "utf8"));
const versions = loadEnv(path.join(root, "versions.env"));

test("version manifest contains valid immutable inputs", () => {
  assert.deepEqual(validateVersionManifest(versions), []);
  assert.equal(versions.CC_SWITCH_VERSION, "5.9.3");
  assert.match(versions.CC_SWITCH_AMD64_ASSET, /^cc-switch-cli-v5\.9\.3-linux-x64-musl\.tar\.gz$/);
  assert.match(versions.CC_SWITCH_ARM64_ASSET, /^cc-switch-cli-v5\.9\.3-linux-arm64-musl\.tar\.gz$/);
  assert.equal(versions.CC_SWITCH_AMD64_SHA256, "a581ec26efda795182949243665ea725d42029c58bb4b9137d0708b255a4fb91");
  assert.equal(versions.CC_SWITCH_ARM64_SHA256, "b733f613b32bbb37af3fedd4703c3431da12d346e94bc55af791b134545ebd07");
});

test("version parser rejects duplicates, empty values, and shell syntax", () => {
  assert.throws(() => parseEnv("A=1\nA=2\n"), /duplicate/);
  assert.throws(() => parseEnv("A=\n"), /invalid/);
  assert.throws(() => parseEnv("export A=1\n"), /invalid/);
});

test("build argument validator reports every missing external pin", () => {
  const complete = REQUIRED_VERSION_KEYS
    .filter((key) => key.endsWith("_VERSION") || key.endsWith("_DIGEST") || key.endsWith("_SHA256"))
    .map((key) => `ARG ${key}`)
    .join("\n");
  assert.deepEqual(missingBuildArguments(versions, complete), []);
  assert.ok(missingBuildArguments(versions, "ARG NODE_VERSION").includes("CC_SWITCH_VERSION"));
});

test("Dockerfile forwards yq checksums to both language installer phases", () => {
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8").replaceAll("\r\n", "\n");
  const installBlock = dockerfile.slice(dockerfile.indexOf('bash /usr/local/libexec/ai-dev-install/install-languages.sh install') - 800);
  assert.match(installBlock, /YQ_AMD64_SHA256="\$\{YQ_AMD64_SHA256\}"/);
  assert.match(installBlock, /YQ_ARM64_SHA256="\$\{YQ_ARM64_SHA256\}"/);
});

test("architecture assets cover exactly amd64 and arm64", () => {
  assert.deepEqual(Object.keys(contracts.architectures).sort(), ["amd64", "arm64"]);
  for (const mapping of Object.values(contracts.architectures)) {
    assert.ok(versions[mapping.ccSwitchAssetKey]);
    assert.match(versions[mapping.ccSwitchChecksumKey], /^[a-f0-9]{64}$/);
  }
});

test("persistence map contains every declared root once", () => {
  const expected = ["/backups", "/config", "/data", "/logs", "/models", "/workspace"];
  assert.deepEqual(contracts.persistence.map(({ path: mountPath }) => mountPath).sort(), expected);
  assert.equal(new Set(contracts.persistence.map(({ volume }) => volume)).size, 6);
});

test("state machines make lock, validation, commit, and completion ordering explicit", () => {
  for (const steps of Object.values(contracts.stateMachines)) {
    assert.equal(steps[0], "lock");
    assert.equal(steps.at(-1), steps === contracts.stateMachines.initialization ? "ready" : "complete");
  }
  const migration = contracts.stateMachines.configurationMigration;
  assert.ok(migration.indexOf("validate-stage") < migration.indexOf("commit-pointer"));
  const identity = contracts.stateMachines.identityMigration;
  assert.ok(identity.indexOf("verify-ownership") < identity.indexOf("commit-identity"));
});

test("release tag sets distinguish master, stable, and prerelease", () => {
  const date = new Date("2026-07-30T00:00:00Z");
  assert.deepEqual(releaseTags("master", date, "abc1234"), ["edge", "sha-abc1234"]);
  assert.deepEqual(releaseTags("v1.2.3", date), ["v1.2.3", "1.2.3", "1.2", "1", "2026.07", "latest"]);
  assert.deepEqual(releaseTags("v1.2.4-rc.1", date), ["v1.2.4-rc.1", "1.2.4-rc.1"]);
});

test("freshness rejects prereleases, equal versions, and older races", () => {
  assert.equal(compareStableVersions("1.10.0", "1.9.9"), 1);
  assert.equal(shouldPromote("1.2.4-rc.1", "1.2.3"), false);
  assert.equal(shouldPromote("1.2.3", "1.2.3"), false);
  assert.equal(shouldPromote("1.2.2", "1.2.3"), false);
  assert.equal(shouldPromote("1.2.4", "1.2.3"), true);
});

test("redaction removes secret keys and sentinel values recursively", () => {
  const input = {
    token: "literal",
    context: ["safe", "Authorization: Bearer abcdefghijklmnop", { api_key: "literal" }],
    ssh: "-----BEGIN OPENSSH PRIVATE KEY-----"
  };
  const output = redact(input, contracts.redaction);
  assert.equal(output.token, "[REDACTED]");
  assert.equal(output.context[0], "safe");
  assert.doesNotMatch(JSON.stringify(output), /abcdefghijklmnop|literal|BEGIN OPENSSH/);
});
