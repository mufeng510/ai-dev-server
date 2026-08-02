#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";

const args = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || value == null) throw new Error(`invalid argument: ${key}`);
  args[key.slice(2)] = value;
}
for (const key of ["output", "event", "digest", "ref"]) if (!args[key]) throw new Error(`--${key} is required`);
if (!/^sha256:[0-9a-f]{64}$/.test(args.digest)) throw new Error("--digest must be an OCI sha256 digest");

const repositoryId = process.env.GITHUB_REPOSITORY_ID ?? "local";
const runId = process.env.GITHUB_RUN_ID ?? "local";
const runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? "1";
const correlation = `${repositoryId}/${runId}/${runAttempt}`;
let sequence = 1;
if (fs.existsSync(args.output)) {
  for (const line of fs.readFileSync(args.output, "utf8").split(/\r?\n/).filter(Boolean)) {
    const previous = JSON.parse(line);
    if (previous.correlation !== correlation || !Number.isSafeInteger(previous.sequence) || previous.sequence < 1) {
      throw new Error("existing release event ledger has an incompatible correlation or sequence");
    }
    sequence = Math.max(sequence, previous.sequence + 1);
  }
}

const record = {
  schema: 1,
  sequence,
  timestamp: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY ?? "local/local",
  repositoryId,
  runId,
  runAttempt,
  correlation,
  event: args.event,
  ref: args.ref,
  digest: args.digest
};
fs.appendFileSync(args.output, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
