#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { loadEnv, missingBuildArguments, validateVersionManifest } from "../src/contracts.mjs";

const root = path.resolve(import.meta.dirname, "..");
const values = loadEnv(path.join(root, "versions.env"));
const errors = validateVersionManifest(values);
const buildOption = process.argv.indexOf("--build");
if (buildOption !== -1) {
  const buildPath = process.argv[buildOption + 1];
  if (!buildPath) errors.push("--build requires a path");
  else {
    const missing = missingBuildArguments(values, fs.readFileSync(path.resolve(root, buildPath), "utf8"));
    errors.push(...missing.map((key) => `${key} is not declared as an ARG in ${buildPath}`));
  }
}
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`OK: versions.env (${Object.keys(values).length} pinned values)`);
}

