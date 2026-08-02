#!/usr/bin/env node
import process from "node:process";
import { parseSemver, shouldPromote } from "../src/contracts.mjs";

function argumentsOf(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--") || index + 1 >= argv.length) throw new Error(`invalid argument: ${item}`);
    values[item.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

function required(values, key) {
  if (!values[key]) throw new Error(`--${key} is required`);
  return values[key];
}

function releasePlan(ref, sha, date) {
  if (ref === "master") {
    if (!/^[a-f0-9]{7,40}$/.test(sha)) throw new Error("--sha must be a lowercase Git SHA");
    return {
      kind: "master",
      version: null,
      candidateTags: ["edge", `sha-${sha.slice(0, 12)}`],
      immutableTags: [`sha-${sha.slice(0, 12)}`],
      movingTags: ["edge"]
    };
  }

  const version = parseSemver(ref);
  const immutableTags = [`v${version.raw}`, version.raw];
  if (version.prerelease) {
    return { kind: "prerelease", version: version.raw, candidateTags: immutableTags, immutableTags, movingTags: [] };
  }
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const movingTags = [`${version.major}.${version.minor}`, `${version.major}`, `${date.getUTCFullYear()}.${month}`, "latest"];
  return { kind: "stable", version: version.raw, candidateTags: [...immutableTags, ...movingTags], immutableTags, movingTags };
}

function main() {
  const [command, ...argv] = process.argv.slice(2);
  const values = argumentsOf(argv);
  if (command === "plan") {
    const ref = required(values, "ref");
    const date = new Date(required(values, "date"));
    if (Number.isNaN(date.valueOf())) throw new Error("--date must be an ISO-8601 date");
    process.stdout.write(`${JSON.stringify(releasePlan(ref, values.sha ?? "", date))}\n`);
    return;
  }
  if (command === "freshness") {
    const candidate = required(values, "candidate");
    process.stdout.write(`${JSON.stringify({ candidate, current: values.current ?? null, promote: shouldPromote(candidate, values.current ?? null) })}\n`);
    return;
  }
  throw new Error("usage: release-policy.mjs <plan|freshness> [options]");
}

try {
  main();
} catch (error) {
  console.error(`release-policy: ${error.message}`);
  process.exitCode = 2;
}
