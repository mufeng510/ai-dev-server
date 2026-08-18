import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(absolutePath), `missing production file: ${relativePath}`);
  return fs.readFileSync(absolutePath, "utf8").replaceAll("\r\n", "\n");
}

function combined(...relativePaths) {
  return relativePaths.map((relativePath) => read(relativePath)).join("\n");
}

function assertOrdered(source, values) {
  let previous = -1;
  for (const value of values) {
    const current = source.indexOf(value, previous + 1);
    assert.notEqual(current, -1, `missing ordered token: ${value}`);
    assert.ok(current > previous, `token is out of order: ${value}`);
    previous = current;
  }
}

function hasCommands(...commands) {
  return commands.every((command) => {
    const result = spawnSync(command, ["--version"], { encoding: "utf8" });
    return !result.error && result.status === 0;
  });
}

test("runtime surface and persistence roots are complete", () => {
  const required = [
    "entrypoint.sh",
    "scripts/ai-dev-runtime",
    "scripts/ai-dev-run",
    "scripts/ai-dev-shell",
    "scripts/ai-dev-idle",
    "scripts/ai-dev-health",
    "scripts/ai-dev-readiness",
    "scripts/ai-dev-doctor",
    "scripts/ai-dev-migrate",
    "scripts/ai-dev-rollback",
    "scripts/ai-dev-migrate-identity",
    "scripts/shell",
    "scripts/tmux",
    "scripts/exec"
  ];
  for (const relativePath of required) assert.ok(fs.existsSync(path.join(root, relativePath)), relativePath);

  const entrypoint = read("entrypoint.sh");
  for (const mountRoot of ["/workspace", "/config", "/data", "/logs", "/models", "/backups"]) {
    assert.match(entrypoint, new RegExp(mountRoot.replace("/", "\\/")), `missing root ${mountRoot}`);
  }
  assert.match(entrypoint, /AI_DEV_ROOTS/);
  assert.match(entrypoint, /flock/);
});

test("generation resolver fails closed and exports every tool state root", () => {
  const runtime = read("scripts/ai-dev-runtime");
  const runner = read("scripts/ai-dev-run");

  assert.match(runner, /umask 077/);
  assert.match(runner, /id -u/);
  assert.match(runner, /refusing .*root/i);
  assertOrdered(runner, ["ai_dev_export_generation", "exec \"$@\""]);

  assert.match(runtime, /active-generation/);
  assert.match(runtime, /\[ ! -f .*AI_DEV_POINTER/);
  assert.match(runtime, /\[ -L .*AI_DEV_POINTER/);
  assert.match(runtime, /ai_dev_safe_generation_id/);
  assert.match(runtime, /readlink -f/);
  assert.match(runtime, /active generation pointer is missing[^\n]+\n\s+return 1/);
  assertOrdered(runtime, [
    "ai_dev_resolve_generation",
    "HOME=",
    "USER=dev",
    "LOGNAME=dev",
    "CLAUDE_CONFIG_DIR=",
    "CODEX_HOME=",
    "OMC_STATE_DIR=",
    "CC_SWITCH_CONFIG_DIR=",
    "GH_CONFIG_DIR=",
    "CODE_SERVER_USER_DATA_DIR=",
    "CODE_SERVER_EXTENSIONS_DIR=",
    "OPENCODE_CONFIG_DIR=",
    "OMO_DISABLE_POSTHOG=1",
    "OMO_SEND_ANONYMOUS_TELEMETRY=0"
  ]);
  assert.match(runtime, /for required in claude codex omc cc-switch git ssh zsh gh code-server opencode omo opencode-data grok/);
});

test("supported shell and exec paths always route through ai-dev-run", () => {
  const shell = read("scripts/shell");
  const exec = read("scripts/exec");
  const containerShell = read("scripts/ai-dev-shell");

  assert.match(shell, /docker compose exec --user dev ai-dev ai-dev-shell/);
  assert.match(exec, /docker compose exec --user dev ai-dev ai-dev-run/);
  const tmux = read("scripts/tmux");
  assert.match(tmux, /docker compose exec --user dev ai-dev ai-dev-run tmux new -As dev/);
  assert.match(containerShell, /id -u dev/);
  assert.match(containerShell, /Docker Socket group access/);
  assert.match(containerShell, /exec ai-dev-run zsh -l/);
});

test("idle supervises always-on code-server with required password and generation paths", () => {
  const idle = read("scripts/ai-dev-idle");
  const health = read("scripts/ai-dev-health");
  const entrypoint = read("entrypoint.sh");

  assert.match(idle, /CODE_SERVER_PASSWORD/);
  assert.match(idle, /code-server/);
  assert.match(idle, /--bind-addr/);
  assert.match(idle, /0\.0\.0\.0:8080/);
  assert.match(idle, /CODE_SERVER_USER_DATA_DIR|user-data-dir/);
  assert.match(idle, /CODE_SERVER_EXTENSIONS_DIR|extensions-dir/);
  assert.match(idle, /--disable-update-check/);
  assert.doesNotMatch(idle, /PASSWORD=changeme|password123/i);
  // Event context keys must stay on the runtime allowlist or startup aborts.
  assert.doesNotMatch(idle, /ai_dev_event[^\n]*bind_addr/);
  assert.match(idle, /ai_dev_event "\$\{operation_id\}" code-server\.started info code-server-started/);

  assert.match(health, /code-server-not-running/);
  assert.match(health, /code-server-port-closed|8080/);
  assert.match(entrypoint, /code-server/);
  assert.match(entrypoint, /for cache in[^\n]*code-server/);
});

test("image lifecycle keeps root bootstrap and drops the final workload through tini and gosu", () => {
  const dockerfile = read("Dockerfile");
  const entrypoint = read("entrypoint.sh");

  assert.match(dockerfile, /USER root/);
  assert.match(dockerfile, /ENTRYPOINT\s+\["tini",\s*"-g",\s*"--",\s*"\/usr\/local\/bin\/entrypoint\.sh"\]/);
  assert.match(dockerfile, /CMD\s+\["\/usr\/local\/bin\/ai-dev-idle"\]/);
  assert.match(entrypoint, /exec gosu dev:dev ai-dev-run "\$@"/);
  assert.match(entrypoint, /ai-dev-migrate\|ai-dev-rollback\|ai-dev-migrate-identity/);
  assert.match(dockerfile, /DISABLE_UPDATES=1/);
  assert.match(dockerfile, /XDG_CACHE_HOME=\/data\/cache/);
  assert.match(entrypoint, /install -d -o "\$\{PUID\}" -g "\$\{PGID\}" -m 0700 "\/data\/cache\/\$\{cache\}"/);
});

test("bootstrap does not automate identity, authentication, providers, proxy, sync, or updates", () => {
  const runtimeSources = combined(
    "entrypoint.sh",
    "scripts/ai-dev-runtime",
    "scripts/ai-dev-run",
    "scripts/ai-dev-readiness",
    "scripts/ai-dev-doctor"
  );

  for (const forbidden of [
    /claude\s+(?:auth\s+)?login/i,
    /codex\s+login(?!\s+status)/i,
    /cc-switch\s+auth\s+login/i,
    /cc-switch\s+provider\s+(?:add|remove|set|update)/i,
    /cc-switch\s+proxy\s+(?:enable|start)/i,
    /cc-switch\s+sync/i,
    /(?:claude|codex|omc|omx|cc-switch|opencode|oh-my-openagent|oh-my-opencode|omo-agent-toolkit|grok)\s+(?:self-)?update/i,
    /ssh-keygen/i,
    /git\s+config\s+(?:--global\s+)?user\.(?:name|email)/i
  ]) {
    assert.doesNotMatch(runtimeSources, forbidden);
  }
});

test("cc-switch state and identity mismatches are protected fail-closed", () => {
  const entrypoint = read("entrypoint.sh");
  const identityMigration = read("scripts/ai-dev-migrate-identity");

  assert.match(entrypoint, /cc-switch/);
  assert.match(entrypoint, /0700/);
  assert.match(entrypoint, /0600/);
  assert.match(entrypoint, /PUID/);
  assert.match(entrypoint, /PGID/);
  assert.match(entrypoint, /identity[- ]mismatch/i);
  assertOrdered(entrypoint, ["identity mismatch", "startup_operation=", "/data/cache/${cache}"]);
  assert.match(entrypoint, /chown root:dev "\$\{AI_DEV_CONFIG_ROOT\}"/);
  assert.match(entrypoint, /chown root:root "\$\{AI_DEV_IDENTITY\}"/);
  assert.match(entrypoint, /for root in \/workspace \/data \/logs \/models \/backups/);
  assert.doesNotMatch(entrypoint, /chown\s+(?:-[^\s]*R[^\s]*|--recursive)\b/);
  assertOrdered(identityMigration, ["flock", "source", "backup", "chown", "ai_dev_atomic_write"]);
  assert.match(identityMigration, /AI_DEV_RUNTIME_UID="\$\{target_uid\}"/);
  assert.match(identityMigration, /chown root:dev "\$\{AI_DEV_CONFIG_ROOT\}"/);
});

test("normal startup never recursively changes ownership and OMX setup is deterministic", () => {
  const entrypoint = read("entrypoint.sh");

  assert.doesNotMatch(entrypoint, /chown\s+(?:-[^\s]*R[^\s]*|--recursive)\b/);
  assert.doesNotMatch(entrypoint, /chown -h[^\n]*(?:2>\/dev\/null|\|\| true)/);
  assert.doesNotMatch(entrypoint, /(?:omx-initialized|schema-version)" 2>\/dev\/null \|\| true/);
  assert.match(entrypoint, /read_generation_state/);
  assert.match(entrypoint, /generation state file is a symlink/);
  assert.match(entrypoint, /generation state path is not a regular file/);
  assert.match(entrypoint, /generation state file cannot be read/);
  assert.match(entrypoint, /\.codex-omx-staging/);
  assert.match(entrypoint, /both OMX staging and live state exist/);
  assert.match(entrypoint, /omx setup --scope user --install-mode legacy --mcp none --team-mode enabled/);
  assert.match(entrypoint, /npm_config_offline=true/);
  assertOrdered(entrypoint, ["omx setup", "omx doctor", "mv \"${omx_staging}\"", "omx-initialized", "ai_dev_commit_pointer"]);
  assert.match(entrypoint, /omx-migration-required/);
  assert.match(entrypoint, /ai_dev_register_opencode_omo/);
  assert.match(entrypoint, /opencode-omo-initialized/);
  assert.match(entrypoint, /opencode-omo-migration-required/);
  assert.doesNotMatch(entrypoint, /--platform=codex/);
  assert.doesNotMatch(entrypoint, /oh-my-openagent doctor/);
  const runtime = read("scripts/ai-dev-runtime");
  assert.match(runtime, /ai_dev_register_opencode_omo/);
  assert.match(runtime, /String\.fromCharCode\(10\)/);
  assert.doesNotMatch(runtime, /JSON\.stringify\(cfg,\s*null,\s*2\)\s*\+\s*"\s*$/m);

  assert.match(entrypoint, /recovery\.completed/);
  assert.match(entrypoint, /0 failed/);
});

test("official native installers remain pinned and noninteractive", () => {
  const installer = read("install/install-ai-tools.sh");
  assert.match(installer, /https:\/\/github\.com\/anthropics\/claude-code\/releases\/download/);
  assert.match(installer, /CLAUDE_RELEASE_BASE_URL/);
  assert.match(installer, /claude-linux-x64\.tar\.gz/);
  assert.match(installer, /claude-linux-arm64\.tar\.gz/);
  assert.match(installer, /\$CLAUDE_RELEASE_BASE_URL\/v\$CLAUDE_CODE_VERSION\/\$claude_asset/);
  assertOrdered(installer, [
    'fetch "$CLAUDE_RELEASE_BASE_URL/v$CLAUDE_CODE_VERSION/$claude_asset" "$archive"',
    'verify_sha256 "$archive" "$claude_checksum"',
    'tar -xzf "$archive" -C "$extract_dir"',
    'single_extracted_file "$extract_dir" claude'
  ]);
  assert.match(installer, /CLAUDE_AMD64_SHA256/);
  assert.match(installer, /CLAUDE_ARM64_SHA256/);
  assert.match(installer, /Claude Code version verification failed/);
  assert.match(installer, /https:\/\/chatgpt\.com\/codex\/install\.sh/);
  assert.match(installer, /verify_sha256 "\$installer" "\$CODEX_INSTALLER_SHA256"/);
  assert.match(installer, /CODEX_NON_INTERACTIVE=1/);
  assert.match(installer, /CODEX_RELEASE="\$CODEX_VERSION"/);
  assert.match(installer, /--release "\$CODEX_VERSION"/);
  assert.doesNotMatch(installer, /api\.github\.com\/repos\/openai\/codex/);
  assert.match(installer, /https:\/\/github\.com\/anomalyco\/opencode\/releases\/download/);
  assert.match(installer, /OPENCODE_RELEASE_BASE_URL/);
  assert.match(installer, /opencode-linux-x64\.tar\.gz/);
  assert.match(installer, /opencode-linux-arm64\.tar\.gz/);
  assert.match(installer, /oh-my-openagent@\$OMO_VERSION/);
  assert.doesNotMatch(installer, /opencode\.ai\/install/);
  assert.doesNotMatch(installer, /omo-ai@beta/);
  assert.doesNotMatch(installer, /lazycodex-ai/);
  assert.doesNotMatch(installer, /--platform=codex/);
  assert.match(installer, /https:\/\/x\.ai\/cli/);
  assert.match(installer, /GROK_RELEASE_BASE_URL/);
  assert.match(installer, /grok-\$\{GROK_VERSION\}-linux-x86_64/);
  assert.match(installer, /grok-\$\{GROK_VERSION\}-linux-aarch64/);
  assert.doesNotMatch(installer, /x\.ai\/cli\/install\.sh/);
});

test("readiness and doctor validate active cc-switch state and report auth only", () => {
  const probes = combined("entrypoint.sh", "scripts/ai-dev-readiness", "scripts/ai-dev-doctor");
  assert.match(probes, /cc-switch config path/);
  assert.match(probes, /Config dir:\[\[:space:\]\]\*/);
  assert.match(probes, /cc-switch config validate/);
  assert.match(probes, /claude auth status --json/);
  assert.match(probes, /codex login status/);
  assert.match(probes, /gh auth status/);
  assert.match(probes, /gh-auth=/);
  assert.match(probes, /GH_CONFIG_DIR/);
  assert.doesNotMatch(probes, /claude\s+(?:auth\s+)?login|codex\s+login(?!\s+status)|cc-switch\s+auth\s+login|gh\s+auth\s+login/im);
});

test("migration and rollback preserve a single atomic generation pointer commit", () => {
  const migration = read("scripts/ai-dev-migrate");
  const rollback = read("scripts/ai-dev-rollback");
  const runtime = read("scripts/ai-dev-runtime");

  assert.match(migration, /flock/);
  assert.match(migration, /ai_dev_generation_hash/);
  assert.match(migration, /AI_DEV_BACKUP_ROOT/);
  assert.doesNotMatch(rollback, /previous-generation" 2>\/dev\/null \|\| true/);
  assert.match(rollback, /previous generation record/);
  assert.match(migration, /recovery\.started/);
  assert.match(migration, /recovery\.completed/);
  assert.match(rollback, /recovery\.started/);
  assert.match(rollback, /recovery\.completed/);
  assert.match(runtime, /ai_dev_probe_generation_tools/);
  for (const tool of ["claude", "codex", "omc", "omx", "cc-switch", "opencode", "oh-my-openagent", "grok", "gh", "git", "ssh", "zsh"]) {
    assert.match(runtime, new RegExp(`${tool}.*--version|${tool} version|${tool} config validate`));
  }
  assert.match(migration, /ai_dev_probe_generation_tools/);
  assert.match(rollback, /ai_dev_probe_generation_tools/);
  assert.match(migration, /staged OMX setup failed/);
  assert.match(migration, /staged OMX doctor reported failed checks/);
  assertOrdered(migration, ["omx setup", "omx doctor", "omx-initialized", "ai_dev_probe_generation_tools", "ai_dev_commit_pointer"]);
  assert.match(runtime, /printf 'D\\0/);
  assert.match(runtime, /printf 'F\\0/);
  assert.match(runtime, /printf 'L\\0/);
  assert.match(runtime, /unsupported generation entry type/);
  assert.match(runtime, /chown root:root "\$\{AI_DEV_POINTER\}"/);
  assert.match(runtime, /ai_dev_event_once/);
  assertOrdered(migration, ["config-migration.started", "ai_dev_commit_pointer", "config-migration.committed", "config-migration.completed"]);
  assertOrdered(rollback, ["rollback.started", "ai_dev_commit_pointer", "rollback.committed", "rollback.completed"]);
  assertOrdered(migration, ["config-migration.completed", "operation.completed", "rm -f \"${journal}\""]);
  assertOrdered(rollback, ["rollback.completed", "operation.completed", "rm -f \"${journal}\""]);
  assertOrdered(read("scripts/ai-dev-migrate-identity"), ["identity-migration.completed", "operation.completed", "rm -f \"${journal}\""]);
  assertOrdered(runtime, ["ai_dev_sync_path \"${temporary}\"", "mv -f", "ai_dev_sync_path \"${directory}\""]);
});

test("health uses stable local reason codes and remains authentication independent", () => {
  const health = read("scripts/ai-dev-health");
  const doctor = read("scripts/ai-dev-doctor");

  for (const reason of [
    "healthy",
    "initialization-incomplete",
    "corrupt-generation",
    "identity-missing",
    "mount-inaccessible",
    "executable-missing",
    "workload-not-running",
    "docker-socket-missing"
  ]) assert.match(health, new RegExp(reason));
  assert.doesNotMatch(health, /login|auth|provider|network/i);
  assert.match(health, /health\.transition/);
  assert.match(health, /health-transition\.journal/);
  assert.match(health, /health-transition\.lock/);
  assert.doesNotMatch(doctor, /--version 2>\/dev\/null/);
  assert.match(doctor, /version check failed/);
});

test("event outbox enforces schema, ordering, durable sinks, dedup keys, and redaction", () => {
  const runtime = read("scripts/ai-dev-runtime");
  const lifecycle = combined(
    "entrypoint.sh",
    "scripts/ai-dev-idle",
    "scripts/ai-dev-migrate",
    "scripts/ai-dev-rollback",
    "scripts/ai-dev-migrate-identity"
  );

  for (const field of ["schema_version", "timestamp", "event", "operation_id", "sequence", "severity", "reason_code", "context"]) {
    assert.match(runtime, new RegExp(`${field}:`));
  }
  assert.match(runtime, /%010d\.json/);
  assert.match(runtime, /\.sequence\.lock/);
  assert.match(runtime, /events\/cursors/);
  assert.match(runtime, /event context key is not allowlisted/);
  assert.match(runtime, /redact|REDACTED|secret/i);
  assertOrdered(runtime, ["ai_dev_sync_path \"${temporary}\"", "mv \"${temporary}\"", "ai_dev_sync_path \"${outbox}\"", "ai_dev_replay_events"]);
  assert.match(runtime, /cursors\/stdout/);
  assert.match(runtime, /cursors\/events-jsonl/);
  assert.match(runtime, /ai_dev_apply_runtime_owner "\$\{replay_lock\}"/);
  assert.match(runtime, /events\.jsonl/);
  assert.match(runtime, /operation\.completed.*operation\.failed|terminal/i);
  assert.match(runtime, /event outbox contains an invalid record/);
  assert.doesNotMatch(runtime, /sha256sum 2>\/dev\/null/);

  assertOrdered(lifecycle, ["startup.started", "startup.completed"]);
  assertOrdered(read("scripts/ai-dev-idle"), ["workload.ready", "signal.received", "shutdown.started", "shutdown.completed", "operation.completed"]);
});

test("generation resolution works against an isolated offline config root", { skip: !hasCommands("bash") }, () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-dev-runtime-"));
  try {
    const configRoot = path.join(temporaryRoot, "config");
    const generation = path.join(configRoot, "generations", "test-generation");
    fs.mkdirSync(path.join(generation, "cc-switch"), { recursive: true });
    fs.writeFileSync(path.join(configRoot, "active-generation"), "test-generation\n", { mode: 0o600 });
    const runtimePath = path.join(root, "scripts", "ai-dev-runtime");
    const command = [
      "set -e",
      `AI_DEV_CONFIG_ROOT=${JSON.stringify(configRoot)}`,
      `. ${JSON.stringify(runtimePath)}`,
      "ai_dev_export_generation",
      "printf '%s\\n' \"$CLAUDE_CONFIG_DIR\" \"$CODEX_HOME\" \"$OMC_STATE_DIR\" \"$CC_SWITCH_CONFIG_DIR\" \"$GH_CONFIG_DIR\" \"$OPENCODE_CONFIG_DIR\""
    ].join("; ");
    const result = spawnSync("bash", ["-c", command], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const portable = (value) => value.replaceAll("\\", "/");
    assert.deepEqual(
      result.stdout.trim().split("\n").map(portable),
      ["claude", "codex", "omc", "cc-switch", "gh", "opencode"].map((name) => portable(path.join(generation, name)))
    );

    fs.rmSync(path.join(configRoot, "active-generation"));
    const sentinel = path.join(temporaryRoot, "must-not-run");
    const failClosed = spawnSync("bash", ["-c", `${command}; touch ${JSON.stringify(sentinel)}`], { encoding: "utf8" });
    assert.notEqual(failClosed.status, 0);
    assert.equal(fs.existsSync(sentinel), false);

    const conditional = [
      "set -e",
      `AI_DEV_CONFIG_ROOT=${JSON.stringify(configRoot)}`,
      `. ${JSON.stringify(runtimePath)}`,
      `if ai_dev_resolve_generation; then touch ${JSON.stringify(sentinel)}; fi`
    ].join("; ");
    const conditionalFailure = spawnSync("bash", ["-c", conditional], { encoding: "utf8" });
    assert.equal(conditionalFailure.status, 0, conditionalFailure.stderr);
    assert.equal(fs.existsSync(sentinel), false);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("generation hash is deterministic, type-aware, and content-sensitive", { skip: !hasCommands("bash", "sha256sum", "find", "sort", "stat", "readlink") }, (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-dev-generation-hash-"));
  try {
    const generation = path.join(temporaryRoot, "generation");
    fs.mkdirSync(path.join(generation, "nested"), { recursive: true });
    fs.writeFileSync(path.join(generation, "nested", "config"), "one\n");
    try {
      fs.symlinkSync("nested/config", path.join(generation, "current"));
    } catch (error) {
      if (error?.code === "EPERM") {
        t.skip("symbolic-link creation is not permitted on this host");
        return;
      }
      throw error;
    }
    const runtimePath = path.join(root, "scripts", "ai-dev-runtime");
    const hashCommand = `. ${JSON.stringify(runtimePath)}; ai_dev_generation_hash ${JSON.stringify(generation)}`;
    const first = spawnSync("bash", ["-c", hashCommand], { encoding: "utf8" });
    const second = spawnSync("bash", ["-c", hashCommand], { encoding: "utf8" });
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.match(first.stdout.trim(), /^[0-9a-f]{64}$/);
    assert.equal(first.stdout, second.stdout);
    fs.writeFileSync(path.join(generation, "nested", "config"), "two\n");
    const changed = spawnSync("bash", ["-c", hashCommand], { encoding: "utf8" });
    assert.equal(changed.status, 0, changed.stderr);
    assert.notEqual(changed.stdout, first.stdout);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("event writer persists ordered redacted records and rejects a second terminal", { skip: !hasCommands("bash", "jq", "flock") }, () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-dev-events-"));
  try {
    const configRoot = path.join(temporaryRoot, "config");
    const logRoot = path.join(temporaryRoot, "logs");
    const runtimePath = path.join(root, "scripts", "ai-dev-runtime");
    const setup = [
      "set -e",
      `AI_DEV_CONFIG_ROOT=${JSON.stringify(configRoot)}`,
      `AI_DEV_LOG_ROOT=${JSON.stringify(logRoot)}`,
      `. ${JSON.stringify(runtimePath)}`
    ].join("; ");
    const write = spawnSync("bash", ["-c", `${setup}; ai_dev_event test-operation workload.ready info workload-ready generation sk-abcdefghijk; ai_dev_event test-operation operation.completed info operation-completed`], { encoding: "utf8" });
    assert.equal(write.status, 0, write.stderr);

    const outbox = path.join(configRoot, "events", "outbox", "test-operation");
    const records = fs.readdirSync(outbox).filter((name) => /^\d{10}\.json$/.test(name)).sort();
    assert.deepEqual(records, ["0000000001.json", "0000000002.json"]);
    const parsed = records.map((name) => JSON.parse(fs.readFileSync(path.join(outbox, name), "utf8")));
    assert.deepEqual(parsed.map(({ sequence, event }) => [sequence, event]), [[1, "workload.ready"], [2, "operation.completed"]]);
    assert.equal(parsed[0].context.generation, "[REDACTED]");
    assert.equal(fs.readFileSync(path.join(logRoot, "events.jsonl"), "utf8").trim().split("\n").length, 2);
    assert.equal(fs.readFileSync(path.join(configRoot, "events", "cursors", "events-jsonl", "test-operation"), "utf8").trim(), "2");

    const duplicate = spawnSync("bash", ["-c", `${setup}; ai_dev_event test-operation operation.failed error failed`], { encoding: "utf8" });
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /logical terminal/);
    assert.equal(fs.readdirSync(outbox).filter((name) => /^\d{10}\.json$/.test(name)).length, 2);

    const malformedOutbox = path.join(configRoot, "events", "outbox", "malformed-operation");
    fs.mkdirSync(malformedOutbox, { recursive: true });
    fs.writeFileSync(path.join(malformedOutbox, "0000000001.json"), "not-json\n");
    const malformed = spawnSync("bash", ["-c", `${setup}; ai_dev_event malformed-operation operation.completed error failed`], { encoding: "utf8" });
    assert.notEqual(malformed.status, 0);
    assert.match(malformed.stderr, /event outbox contains an invalid record/);
    assert.equal(fs.readdirSync(malformedOutbox).filter((name) => /^\d{10}\.json$/.test(name)).length, 1);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
