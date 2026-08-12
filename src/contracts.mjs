import fs from "node:fs";

export const REQUIRED_VERSION_KEYS = Object.freeze([
  "UBUNTU_VERSION",
  "UBUNTU_DIGEST",
  "NODE_VERSION",
  "PNPM_VERSION",
  "BUN_VERSION",
  "UV_VERSION",
  "GO_VERSION",
  "RUST_VERSION",
  "JDK_VERSION",
  "CLAUDE_CODE_VERSION",
  "CLAUDE_AMD64_SHA256",
  "CLAUDE_ARM64_SHA256",
  "CODEX_VERSION",
  "CODEX_INSTALLER_SHA256",
  "GH_VERSION",
  "GH_AMD64_SHA256",
  "GH_ARM64_SHA256",
  "OMC_VERSION",
  "OMX_VERSION",
  "CC_SWITCH_VERSION",
  "YQ_VERSION",
  "CC_SWITCH_AMD64_ASSET",
  "CC_SWITCH_AMD64_SHA256",
  "CC_SWITCH_ARM64_ASSET",
  "CC_SWITCH_ARM64_SHA256",
  "CODE_SERVER_VERSION",
  "CODE_SERVER_AMD64_ASSET",
  "CODE_SERVER_AMD64_SHA256",
  "CODE_SERVER_ARM64_ASSET",
  "CODE_SERVER_ARM64_SHA256"
]);

export function parseEnv(text) {
  const values = {};
  for (const [index, sourceLine] of text.split(/\r?\n/).entries()) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(\S+)$/.exec(line);
    if (!match) throw new Error(`invalid env assignment on line ${index + 1}`);
    const [, key, value] = match;
    if (Object.hasOwn(values, key)) throw new Error(`duplicate env key: ${key}`);
    values[key] = value;
  }
  return values;
}

export function loadEnv(path) {
  return parseEnv(fs.readFileSync(path, "utf8"));
}

export function validateVersionManifest(values) {
  const errors = [];
  for (const key of REQUIRED_VERSION_KEYS) {
    if (!values[key]) errors.push(`${key} must be nonempty`);
  }
  if (values.UBUNTU_DIGEST && !/^sha256:[a-f0-9]{64}$/.test(values.UBUNTU_DIGEST)) {
    errors.push("UBUNTU_DIGEST must be an sha256 digest");
  }
  for (const architecture of ["AMD64", "ARM64"]) {
    const asset = values[`CC_SWITCH_${architecture}_ASSET`] ?? "";
    const checksum = values[`CC_SWITCH_${architecture}_SHA256`] ?? "";
    if (values.CC_SWITCH_VERSION && !asset.includes(`v${values.CC_SWITCH_VERSION}`)) {
      errors.push(`CC_SWITCH_${architecture}_ASSET must be version-qualified`);
    }
    if (!asset.includes("musl")) errors.push(`CC_SWITCH_${architecture}_ASSET must select musl`);
    if (!/^[a-f0-9]{64}$/.test(checksum)) errors.push(`CC_SWITCH_${architecture}_SHA256 must be sha256`);
  }
  for (const architecture of ["AMD64", "ARM64"]) {
    const asset = values[`CODE_SERVER_${architecture}_ASSET`] ?? "";
    const checksum = values[`CODE_SERVER_${architecture}_SHA256`] ?? "";
    const archToken = architecture === "AMD64" ? "amd64" : "arm64";
    if (values.CODE_SERVER_VERSION && !asset.includes(`code-server-${values.CODE_SERVER_VERSION}-linux-${archToken}.tar.gz`)) {
      errors.push(`CODE_SERVER_${architecture}_ASSET must be version-qualified linux ${archToken} tarball`);
    }
    if (!/^[a-f0-9]{64}$/.test(checksum)) errors.push(`CODE_SERVER_${architecture}_SHA256 must be sha256`);
  }
  for (const key of ["CLAUDE_AMD64_SHA256", "CLAUDE_ARM64_SHA256", "CODEX_INSTALLER_SHA256", "GH_AMD64_SHA256", "GH_ARM64_SHA256", "CODE_SERVER_AMD64_SHA256", "CODE_SERVER_ARM64_SHA256"]) {
    if (!/^[a-f0-9]{64}$/.test(values[key] ?? "")) errors.push(`${key} must be sha256`);
  }
  return errors;
}

export function missingBuildArguments(values, buildText) {
  return REQUIRED_VERSION_KEYS.filter((key) => key.endsWith("_VERSION") || key.endsWith("_DIGEST") || key.endsWith("_SHA256"))
    .filter((key) => !new RegExp(`\\bARG\\s+${key}(?:\\s|=|$)`, "m").test(buildText));
}

export function parseSemver(value) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/.exec(value);
  if (!match) throw new Error(`invalid semantic version: ${value}`);
  return { raw: value.replace(/^v/, ""), major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ?? null };
}

export function compareStableVersions(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (a.prerelease || b.prerelease) throw new Error("freshness comparison accepts stable versions only");
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return Math.sign(a[key] - b[key]);
  }
  return 0;
}

export function releaseTags(ref, date, shortSha = "") {
  if (ref === "master") return [`edge`, `sha-${shortSha}`];
  const version = parseSemver(ref);
  if (version.prerelease) return [`v${version.raw}`, version.raw];
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return [
    `v${version.raw}`,
    version.raw,
    `${version.major}.${version.minor}`,
    `${version.major}`,
    `${date.getUTCFullYear()}.${month}`,
    "latest"
  ];
}

export function shouldPromote(candidate, current) {
  const parsed = parseSemver(candidate);
  if (parsed.prerelease) return false;
  return current == null || compareStableVersions(candidate, current) > 0;
}

export function redact(value, policy) {
  const keyPatterns = policy.keyPatterns.map((pattern) => new RegExp(pattern, "i"));
  const valuePatterns = policy.valuePatterns.map((pattern) => new RegExp(pattern, "gi"));
  const scrub = (text) => valuePatterns.reduce((result, pattern) => result.replace(pattern, policy.replacement), text);
  if (Array.isArray(value)) return value.map((item) => redact(item, policy));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      keyPatterns.some((pattern) => pattern.test(key)) ? policy.replacement : redact(item, policy)
    ]));
  }
  return typeof value === "string" ? scrub(value) : value;
}
