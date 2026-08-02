#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compareStableVersions, parseSemver } from "../src/contracts.mjs";

function argsOf(argv) {
  const result = { dryRun: false, immutableOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dry-run") {
      result.dryRun = true;
      continue;
    }
    if (argv[index] === "--immutable-only") {
      result.immutableOnly = true;
      continue;
    }
    if (!argv[index].startsWith("--") || index + 1 >= argv.length) {
      throw new Error(`invalid argument: ${argv[index]}`);
    }
    result[argv[index].slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}

function run(command, argv, { allowFailure = false, capture = true } = {}) {
  const result = spawnSync(command, argv, { encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
  if (result.status !== 0 && !allowFailure) throw new Error(`${command} ${argv.join(" ")} failed`);
  return result;
}

function inspectDigest(reference) {
  const result = run("docker", ["buildx", "imagetools", "inspect", reference, "--format", "{{json .Manifest.Digest}}"], { allowFailure: true });
  if (result.status !== 0) {
    const diagnostic = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
    if (/manifest unknown|not found/i.test(diagnostic)) return null;
    throw new Error(`registry inspection failed for ${reference}`);
  }
  return result.stdout.trim().replace(/^"|"$/g, "");
}

function appendEvent(path, context, event, details = {}) {
  let sequence = 1;
  if (fs.existsSync(path)) {
    for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean)) {
      const previous = JSON.parse(line);
      if (previous.correlation !== context.correlation || !Number.isSafeInteger(previous.sequence) || previous.sequence < 1) {
        throw new Error("existing release event ledger has an incompatible correlation or sequence");
      }
      sequence = Math.max(sequence, previous.sequence + 1);
    }
  }
  const record = {
    schema: 1,
    sequence,
    timestamp: new Date().toISOString(),
    repository: context.repository,
    runId: context.runId,
    runAttempt: context.runAttempt,
    repositoryId: context.repositoryId,
    correlation: context.correlation,
    event,
    ...details
  };
  fs.appendFileSync(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
}

function gitStableTags() {
  run("git", ["fetch", "--force", "--tags", "origin"], { capture: false });
  const result = run("git", ["tag", "--list", "v*"]);
  return result.stdout.split(/\r?\n/).filter(Boolean).flatMap((tag) => {
    try {
      const version = parseSemver(tag);
      return version.prerelease ? [] : [{ tag, version }];
    } catch {
      // Unrelated non-semver v* tags do not participate in channel freshness.
      return [];
    }
  });
}

function highest(tags, predicate) {
  return tags.filter(predicate).map(({ version }) => version.raw).sort(compareStableVersions).at(-1) ?? null;
}

function tagMonth(tag) {
  const result = run("git", ["for-each-ref", "--format=%(creatordate:iso-strict)", `refs/tags/${tag}`]);
  const date = new Date(result.stdout.trim());
  if (Number.isNaN(date.valueOf())) throw new Error(`cannot determine release month for ${tag}`);
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function attach(image, tag, digest, dryRun, context, events) {
  const target = `${image}:${tag}`;
  const existing = inspectDigest(target);
  if (existing === digest) {
    appendEvent(events, context, "tag_reconciled", { tag, digest, result: "already-current" });
    return;
  }
  if (dryRun) {
    appendEvent(events, context, "tag_reconciled", { tag, digest, previousDigest: existing, result: "dry-run" });
    return;
  }
  run("docker", ["buildx", "imagetools", "create", "--tag", target, `${image}@${digest}`], { capture: false });
  const observed = inspectDigest(target);
  if (observed !== digest) throw new Error(`post-write digest verification failed for ${target}`);
  appendEvent(events, context, "tag_reconciled", { tag, digest, previousDigest: existing, result: "updated" });
}

function main() {
  const args = argsOf(process.argv.slice(2));
  for (const key of ["image", "digest", "ref", "date", "events"]) {
    if (!args[key]) throw new Error(`--${key} is required`);
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(args.digest)) {
    throw new Error("--digest must be an OCI sha256 digest");
  }
  const context = {
    repository: process.env.GITHUB_REPOSITORY ?? "local/local",
    repositoryId: process.env.GITHUB_REPOSITORY_ID ?? "local",
    runId: process.env.GITHUB_RUN_ID ?? "local",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "1"
  };
  context.correlation = `${context.repositoryId}/${context.runId}/${context.runAttempt}`;
  const policy = run(process.execPath, [fileURLToPath(new URL("release-policy.mjs", import.meta.url)), "plan", "--ref", args.ref, "--sha", process.env.GITHUB_SHA ?? "000000000000", "--date", args.date]);
  const plan = JSON.parse(policy.stdout);
  appendEvent(args.events, context, "reconciliation_started", { ref: args.ref, digest: args.digest, kind: plan.kind });

  const sourceDigest = inspectDigest(`${args.image}@${args.digest}`);
  if (!args.dryRun && sourceDigest !== args.digest) throw new Error("candidate digest cannot be re-fetched from the registry");

  for (const tag of plan.immutableTags) {
    const existing = inspectDigest(`${args.image}:${tag}`);
    if (existing && existing !== args.digest) throw new Error(`immutable tag ${tag} already points to another digest`);
    attach(args.image, tag, args.digest, args.dryRun, context, args.events);
  }
  if (args.immutableOnly) {
    appendEvent(args.events, context, "immutable_reconciliation_completed", { ref: args.ref, digest: args.digest });
  } else if (plan.kind === "master") {
    attach(args.image, "edge", args.digest, args.dryRun, context, args.events);
  } else if (plan.kind === "stable") {
    // Freshly fetch Git tags inside the serialized promotion job. Each channel is
    // independently reconciled and verified; registry tag movement is not atomic.
    const tags = gitStableTags();
    const candidate = parseSemver(plan.version);
    const releaseDate = new Date(args.date);
    const month = `${releaseDate.getUTCFullYear()}.${String(releaseDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const channelMaxima = new Map([
      [`${candidate.major}.${candidate.minor}`, highest(tags, ({ version }) => version.major === candidate.major && version.minor === candidate.minor)],
      [`${candidate.major}`, highest(tags, ({ version }) => version.major === candidate.major)],
      [month, highest(tags, ({ tag }) => tagMonth(tag) === month)],
      ["latest", highest(tags, () => true)]
    ]);
    for (const tag of plan.movingTags) {
      const freshest = channelMaxima.get(tag);
      if (freshest !== plan.version) {
        appendEvent(args.events, context, "promotion_skipped", { tag, candidate: plan.version, freshest });
        continue;
      }
      attach(args.image, tag, args.digest, args.dryRun, context, args.events);
    }
  }
  appendEvent(args.events, context, "reconciliation_completed", { ref: args.ref, digest: args.digest });
}

try {
  main();
} catch (error) {
  console.error(`release-reconcile: ${error.message}`);
  process.exitCode = 1;
}
