import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const workflowPath = ".github/workflows/docker.yml";
const policyPath = "scripts/release-policy.mjs";

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replaceAll("\r\n", "\n");
}

function fixture(name) {
  return JSON.parse(read(`tests/fixtures/${name}`));
}

function runPolicy(...args) {
  const result = spawnSync(process.execPath, [policyPath, ...args], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function yamlBlock(source, heading, indent = 2) {
  const prefix = `${" ".repeat(indent)}${heading}:`;
  const start = source.indexOf(`${prefix}\n`);
  assert.notEqual(start, -1, `missing YAML block: ${heading}`);
  const remainder = source.slice(start + prefix.length + 1);
  const next = remainder.search(new RegExp(`^${" ".repeat(indent)}[^ \\n][^\\n]*:$`, "m"));
  return next === -1 ? remainder : remainder.slice(0, next);
}

function allActionReferences(workflow) {
  return [...workflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)\s*$/gm)].map((match) => match[1]);
}

test("workflow runs for pull requests, master, and semantic version tags only", () => {
  const workflow = read(workflowPath);
  const trigger = yamlBlock(workflow, "on", 0);

  assert.match(trigger, /^  pull_request:/m);
  assert.match(trigger, /^  push:/m);
  assert.match(trigger, /branches:\s*(?:\[\s*master\s*\]|\n\s+-\s*master)/);
  assert.match(trigger, /tags:\s*(?:\[\s*["']?v\*\.\*\.\*["']?\s*\]|\n\s+-\s*["']?v\*\.\*\.\*["']?)/);
  assert.doesNotMatch(trigger, /workflow_run|schedule|pull_request_target/);
});

test("release policy emits the exact tag sets for master, stable, and prerelease refs", () => {
  for (const scenario of fixture("release-events.json")) {
    const result = runPolicy(
      "plan",
      "--ref", scenario.ref,
      "--sha", scenario.shortSha.padEnd(40, "0"),
      "--date", scenario.date
    );
    const publicTags = result.kind === "master"
      ? result.candidateTags
      : [...result.immutableTags, ...result.movingTags];
    assert.deepEqual(publicTags, scenario.tags, scenario.name);
  }
});

test("release policy rejects prerelease, equal, and older candidates for stable promotion", () => {
  for (const [candidate, current, expected] of [
    ["1.2.4-rc.1", "1.2.3", false],
    ["1.2.3", "1.2.3", false],
    ["1.2.2", "1.2.3", false],
    ["1.10.0", "1.9.9", true]
  ]) {
    assert.equal(
      runPolicy("freshness", "--candidate", candidate, "--current", current).promote,
      expected,
      `${candidate} against ${current}`
    );
  }
});

test("release event ledgers keep one correlation and monotonic sequence", () => {
  const directory = fs.mkdtempSync(path.join(root, "tests", ".release-events-"));
  const output = path.join(directory, "release-events.jsonl");
  const env = {
    ...process.env,
    GITHUB_REPOSITORY: "example/ai-dev",
    GITHUB_REPOSITORY_ID: "42",
    GITHUB_RUN_ID: "84",
    GITHUB_RUN_ATTEMPT: "2"
  };
  const invoke = (event) => spawnSync(process.execPath, ["scripts/release-event.mjs", "--output", output, "--event", event, "--digest", `sha256:${"a".repeat(64)}`, "--ref", "v1.2.3"], { cwd: root, env, encoding: "utf8" });
  try {
    assert.equal(invoke("candidate_pushed").status, 0);
    assert.equal(invoke("tag_reconciled").status, 0);
    const records = fs.readFileSync(output, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(records.map((record) => record.sequence), [1, 2]);
    assert.deepEqual([...new Set(records.map((record) => record.correlation))], ["42/84/2"]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("serialized promotion leaves every moving channel on the newer digest in either completion order", () => {
  const race = fixture("promotion-races.json");

  for (const schedule of race.schedules) {
    const channels = structuredClone(race.initial);
    for (const candidateName of schedule) {
      const candidate = race.candidates[candidateName];
      for (const channel of Object.keys(channels)) {
        const decision = runPolicy(
          "freshness",
          "--candidate", candidate.version,
          "--current", channels[channel].version
        );
        if (decision.promote) channels[channel] = structuredClone(candidate);
      }
    }
    assert.deepEqual(channels, race.expected, `completion order: ${schedule.join(", ")}`);
  }
});

test("release reconciliation refuses to overwrite an immutable tag with another digest", () => {
  const reconcile = read("scripts/release-reconcile.mjs");

  assert.match(reconcile, /existing\s*&&\s*existing\s*!==\s*args\.digest/);
  assert.match(reconcile, /immutable tag \$\{tag\} already points to another digest/);
  assert.match(reconcile, /`\$\{args\.image\}@\$\{args\.digest\}`/);
  assert.match(reconcile, /manifest unknown|not found/i);
  assert.match(reconcile, /cannot inspect registry reference|registry inspection failed/i);
});

test("stable promotion is serialized without cancelling an in-flight freshness check", () => {
  const promotion = yamlBlock(read(workflowPath), "promote-stable");
  const reconcile = read("scripts/release-reconcile.mjs");

  assert.match(promotion, /^\s+group:\s*dockerhub-stable-promotion\s*$/m);
  assert.match(promotion, /^\s+cancel-in-progress:\s*false\s*$/m);
  assert.match(promotion, /release-policy\.mjs\s+freshness|release-reconcile\.mjs/);
  assert.doesNotMatch(promotion, /git fetch/);
  assert.match(reconcile, /run\("git", \["fetch", "--force", "--tags", "origin"\]/);
});

test("immutable publication cannot move stable channels before serialized promotion", () => {
  const workflow = read(workflowPath);
  const publication = yamlBlock(workflow, "publish-immutable");
  const reconcile = read("scripts/release-reconcile.mjs");

  assert.match(publication, /--immutable-only/);
  assert.match(reconcile, /immutable-only/);
  assert.match(reconcile, /immutableOnly/);
  assert.match(
    reconcile,
    /if \(args\.immutableOnly\)[\s\S]*else if \(plan\.kind === "master"\)[\s\S]*else if \(plan\.kind === "stable"\)/
  );
  assert.doesNotMatch(reconcile, /stablePromotion/);
});

test("native amd64 and arm64 jobs gate publication by the candidate digest", () => {
  const workflow = read(workflowPath);
  const amd64 = yamlBlock(workflow, "native-amd64");
  const arm64 = yamlBlock(workflow, "native-arm64");
  const publication = `${yamlBlock(workflow, "publish-immutable")}\n${yamlBlock(workflow, "promote-stable")}`;

  assert.match(amd64, /runs-on:\s*ubuntu-24\.04\s*$/m);
  assert.match(arm64, /runs-on:\s*ubuntu-24\.04-arm\s*$/m);
  assert.doesNotMatch(`${amd64}\n${arm64}`, /self-hosted/i);
  for (const nativeJob of [amd64, arm64]) {
    assert.match(nativeJob, /needs\.build-candidate\.outputs\.digest/);
    assert.match(nativeJob, /@\$\{\{[^}]*digest[^}]*\}\}/);
    assert.doesNotMatch(nativeJob, /setup-qemu|qemu-user|binfmt/i);
  }
  assert.match(publication, /native-amd64/);
  assert.match(publication, /native-arm64/);
  assert.match(publication, /needs\.build-candidate\.outputs\.digest/);
});

test("native capability gate rejects an emulated host and validates offline state", () => {
  const gate = read("scripts/release-native-gate.sh");
  assert.match(gate, /uname -m/);
  assert.match(gate, /host_arch/);
  assert.match(gate, /runner is %s, expected native/);
  assert.match(gate, /cc-switch auth status --json/);
  assert.doesNotMatch(gate, /cc-switch auth status --json[^\n]*\|\| true/);
  assert.match(gate, /omx setup/);
  assert.match(gate, /Results: \[0-9\]\+ passed/);
  assert.match(gate, /better-sqlite3/);
  assert.match(gate, /omc config >\/dev\/null/);
  assert.match(gate, /tmux/);
  assert.match(gate, /flock/);
});

test("QEMU smoke testing is supplemental and cannot replace native gates", () => {
  const workflow = read(workflowPath);
  const qemu = yamlBlock(workflow, "qemu-smoke");
  const publication = `${yamlBlock(workflow, "publish-immutable")}\n${yamlBlock(workflow, "promote-stable")}`;

  assert.match(qemu, /setup-qemu|qemu/i);
  assert.doesNotMatch(publication, /needs:\s*qemu-smoke\b/);
  assert.match(publication, /native-amd64/);
  assert.match(publication, /native-arm64/);
});

test("pull request image gate exercises the entrypoint lifecycle", () => {
  const workflow = read(workflowPath);
  const pullRequest = yamlBlock(workflow, "pr-amd64");
  const lifecycle = read("scripts/ci-lifecycle-gate.sh");
  assert.match(pullRequest, /ci-lifecycle-gate\.sh ai-dev:test/);
  assert.match(lifecycle, /wait_healthy/);
  assert.match(lifecycle, /docker restart/);
  assert.match(lifecycle, /identity mismatch unexpectedly started/);
  assert.match(lifecycle, /--user dev/);
});

test("workflow actions are immutable SHA pins and permissions are least privilege", () => {
  const workflow = read(workflowPath);
  const actions = allActionReferences(workflow);
  assert.ok(actions.length > 0, "workflow must use pinned actions");
  for (const reference of actions) {
    assert.match(reference, /^[^@\s]+@[a-f0-9]{40}$/, reference);
  }

  const rootPermissions = yamlBlock(workflow, "permissions", 0);
  const rootEntries = [...rootPermissions.matchAll(/^  ([a-z-]+):\s*(read|write|none)\s*$/gm)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(Object.fromEntries(rootEntries), { contents: "read" });

  const evidence = yamlBlock(workflow, "release-evidence");
  assert.match(evidence, /^\s+contents:\s*read\s*$/m);
  assert.match(evidence, /^\s+id-token:\s*write\s*$/m);
  assert.match(evidence, /^\s+attestations:\s*write\s*$/m);
  assert.doesNotMatch(workflow, /^\s+(?:packages|actions|checks|deployments|issues|pull-requests|security-events|statuses):\s*write\s*$/m);
});

test("Docker Hub credentials are sourced only from the two scoped GitHub secrets", () => {
  const workflow = read(workflowPath);
  const secretNames = [...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]);

  assert.deepEqual([...new Set(secretNames)].sort(), ["DOCKERHUB_TOKEN", "DOCKERHUB_USERNAME"]);
  assert.doesNotMatch(workflow, /^\s*(?:password|token):\s*(?!\$\{\{\s*secrets\.)[^\n]+$/mi);
});

test("release evidence retains SBOM, provenance, artifact attestation, and operation identity", () => {
  const workflow = read(workflowPath);
  const bake = read("docker-bake.hcl");
  const build = yamlBlock(workflow, "build-candidate");
  const evidence = yamlBlock(workflow, "release-evidence");

  assert.match(build, /docker buildx bake image/);
  assert.match(build, /--metadata-file bake-metadata\.json/);
  assert.match(build, /containerimage\.digest/);
  assert.match(bake, /type=sbom/);
  assert.match(bake, /type=provenance,mode=max/);
  assert.match(workflow, /actions\/attest-build-provenance@[a-f0-9]{40}/);
  assert.match(workflow, /release-events\.jsonl/);
  assert.match(evidence, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(evidence, /needs\.publish-immutable\.result\s*==\s*["']success["']/);
  assert.match(evidence, /needs\.promote-stable\.result\s*==\s*["'](?:success|skipped)["']/);
  assert.match(evidence, /retention-days:\s*[1-9][0-9]*/);
  assert.match(workflow, /github\.repository_id/);
  assert.match(workflow, /github\.run_id/);
  assert.match(workflow, /github\.run_attempt/);
  assert.match(bake, /org\.opencontainers\.image\.(?:release[._]operation|operation[._]id)/);
  assert.match(workflow, /needs\.build-candidate\.outputs\.digest/);
});

test("release candidate delegates build configuration to the Bake target", () => {
  const build = yamlBlock(read(workflowPath), "build-candidate");
  assert.match(build, /docker buildx bake image/);
  assert.match(build, /env[\s\\]+REGISTRY=docker\.io/);
  assert.doesNotMatch(build, /docker\/build-push-action/);
  assert.doesNotMatch(build, /--set\s+(?:REGISTRY|IMAGE|TAG|CACHE_FROM|CACHE_TO|SOURCE_REPOSITORY|REVISION|CREATED|OPERATION_ID|OUTPUT)=/);
  assert.match(read("docker-bake.hcl"), /variable "OUTPUT"/);
});

test("reconciliation ledgers are retained after a failed registry write", () => {
  const workflow = read(workflowPath);
  for (const job of ["publish-immutable", "promote-stable"]) {
    const block = yamlBlock(workflow, job);
    assert.match(block, /actions\/upload-artifact@[a-f0-9]{40}[\s\S]*?if:\s*always\(\)/);
  }
});
