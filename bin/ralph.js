#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const {
  loadModePrompt,
  projectPromptPath,
  scaffoldProjectPrompts
} = require("../lib/prompts");

const DEFAULT_COMPLETION_PROMISE = "<promise>DONE</promise>";

const DEFAULT_ENV_SH = `#!/usr/bin/env bash
# Source this file before running ralph commands.

# Claude default: add project .ralph dir access and bypass interactive permission prompts.
export RALPH_AGENT_CMD='claude -p --permission-mode bypassPermissions --add-dir "$PWD/.ralph"'

# Optional override:
# export RALPH_COMPLETION_PROMISE='${DEFAULT_COMPLETION_PROMISE}'
`;

const DEFAULT_PLAN = `# Implementation Plan

## Prioritized Tasks

- [ ] (Planning mode) Derive prioritized implementation tasks from \`specs/*.md\`.

## Notes

- Keep tasks small and testable.
- Add follow-up tasks directly below related items.
`;

const DEFAULT_FIRST_SPEC = `# Spec: Example Feature

## Goal

Implement a small vertical slice end-to-end.

## Requirements

- Add \`GET /health\` returning \`{ "ok": true }\`.
- Add automated test coverage.
- Update docs with a usage example.

## Acceptance Criteria

- The test command passes with endpoint coverage.
- Lint and type checks pass.
- Docs mention the endpoint and include a sample response.
`;

function usage() {
  console.log(`Usage:
  ralph init
  ralph build [max-iterations] [--dry-run]
  ralph plan [max-iterations] [--dry-run]
  ralph -h | --help`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isUint(value) {
  return /^[0-9]+$/.test(value);
}

function parseMax(rest) {
  if (rest.length === 0) {
    return 0;
  }
  if (rest.length === 1 && isUint(rest[0])) {
    return Number(rest[0]);
  }
  fail("Error: max iterations must be a non-negative integer.");
}

function parseRunOptions(rest) {
  let dryRun = false;
  const positional = [];

  for (const token of rest) {
    if (token === "--dry-run") {
      if (dryRun) {
        fail("Error: --dry-run can only be provided once.");
      }
      dryRun = true;
      continue;
    }
    positional.push(token);
  }

  return {
    dryRun,
    maxIterations: parseMax(positional)
  };
}

function timestampNow() {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}_${hh}${mm}${ss}`;
}

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

function normalizeOutputLine(line) {
  return stripAnsi(line).trim();
}

function signalAgentProcessTree(child, signal, useProcessGroup) {
  if (!child || typeof child.pid !== "number" || child.pid <= 0) {
    return;
  }

  if (useProcessGroup) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall through to direct child signal.
    }
  }

  try {
    child.kill(signal);
  } catch {
    // Ignore process already exited / signal errors.
  }
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`Setup error: ${label} not found: ${filePath}`);
  }
}

function ensureDirectory(dirPath, label) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    fail(`Setup error: ${label} does not exist: ${dirPath}`);
  }
}

function initCommand() {
  const targetRoot = process.cwd();
  ensureDirectory(targetRoot, "Target directory");

  const configDir = path.join(targetRoot, ".ralph");
  if (fs.existsSync(configDir)) {
    const existing = fs.readdirSync(configDir);
    if (existing.length > 0) {
      fail(`Refusing to overwrite existing directory: ${configDir}`);
    }
  }

  fs.mkdirSync(path.join(configDir, "specs"), { recursive: true });
  scaffoldProjectPrompts(configDir);

  fs.writeFileSync(path.join(configDir, "env.sh"), DEFAULT_ENV_SH, "utf8");
  fs.chmodSync(path.join(configDir, "env.sh"), 0o755);
  fs.writeFileSync(path.join(configDir, "IMPLEMENTATION_PLAN.md"), DEFAULT_PLAN, "utf8");
  fs.writeFileSync(path.join(configDir, "specs", "001-example-spec.md"), DEFAULT_FIRST_SPEC, "utf8");

  console.log(`Initialized ${configDir}`);
  console.log("Next steps:");
  console.log("1. source .ralph/env.sh");
  console.log("2. Optionally edit .ralph/prompts/build.md and .ralph/prompts/plan.md");
  console.log("3. Edit .ralph/specs/001-example-spec.md");
  console.log("4. Run: ralph plan 1");
  console.log("5. Review .ralph/IMPLEMENTATION_PLAN.md and edit if needed");
  console.log("6. Run: ralph build");
}

function buildRuntimePrompt(mode, context, modePrompt, modePromptPath) {
  return `Ralph runtime context:
- Mode: ${mode}
- Work dir: ${context.workdir}
- Specs path: ${context.specsGlob}
- Plan path: ${context.planFile}
- Plan update path: ${context.planFile}
- Prompt file: ${modePromptPath}
- Completion rule: final non-empty output line must exactly match ${context.completionPromise}

${modePrompt}
`;
}

function runAgentIteration({ agentCmd, runtimePrompt, workdir, logFile, env }) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const useProcessGroup = process.platform !== "win32";

    const child = spawn(agentCmd, {
      cwd: workdir,
      env,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
      detached: useProcessGroup
    });
    const onParentExit = () => {
      signalAgentProcessTree(child, "SIGTERM", useProcessGroup);
    };
    process.once("exit", onParentExit);

    const logStream = fs.createWriteStream(logFile, { flags: "w" });
    let lastNonEmptyLine = "";
    let carry = "";

    function ingest(chunk) {
      const text = chunk.toString("utf8");
      process.stdout.write(text);
      logStream.write(text);

      carry += text.replace(/\r/g, "\n");
      const lines = carry.split("\n");
      carry = lines.pop() || "";
      for (const line of lines) {
        const normalizedLine = normalizeOutputLine(line);
        if (normalizedLine !== "") {
          lastNonEmptyLine = normalizedLine;
        }
      }
    }

    child.stdout.on("data", ingest);
    child.stderr.on("data", ingest);

    child.on("error", (err) => {
      process.removeListener("exit", onParentExit);
      logStream.end(() => reject(err));
    });

    child.on("close", (code, signal) => {
      process.removeListener("exit", onParentExit);

      const normalizedCarry = normalizeOutputLine(carry);
      if (normalizedCarry !== "") {
        lastNonEmptyLine = normalizedCarry;
      }

      // Best-effort cleanup for agent descendants that survive shell exit.
      signalAgentProcessTree(child, "SIGTERM", useProcessGroup);

      logStream.end(() => {
        resolve({
          code: code === null ? 1 : code,
          signal,
          lastNonEmptyLine,
          durationMs: Date.now() - startedAt
        });
      });
    });

    child.stdin.on("error", () => {
      // Ignore EPIPE from tools that close stdin early.
    });
    child.stdin.write(runtimePrompt);
    child.stdin.end();
  });
}

async function runLoop(mode, maxIterations, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const cwd = process.cwd();
  const workdir = cwd;
  const configDir = path.join(workdir, ".ralph");
  const completionPromise = process.env.RALPH_COMPLETION_PROMISE || DEFAULT_COMPLETION_PROMISE;
  const agentCmd = process.env.RALPH_AGENT_CMD;

  if (!agentCmd || agentCmd.trim() === "") {
    fail("Setup error: RALPH_AGENT_CMD is not set. Export it before running this command.");
  }

  ensureDirectory(configDir, "CONFIG_DIR");
  ensureDirectory(workdir, "WORKDIR");

  const specsDir = path.join(configDir, "specs");
  const specsGlob = path.join(specsDir, "*.md");
  const planFile = path.join(configDir, "IMPLEMENTATION_PLAN.md");
  ensureDirectory(specsDir, "Specs directory");
  ensureFile(planFile, "Implementation plan");
  scaffoldProjectPrompts(configDir);

  const logDir = path.join(configDir, "logs");
  fs.mkdirSync(logDir, { recursive: true });

  const context = {
    workdir,
    specsGlob,
    planFile,
    completionPromise
  };
  const modePromptPath = projectPromptPath(configDir, mode);
  const modePrompt = loadModePrompt(configDir, mode, context);
  const runtimePrompt = buildRuntimePrompt(mode, context, modePrompt, modePromptPath);

  console.log(`Mode: ${mode}`);
  console.log(`Config dir: ${configDir}`);
  console.log(`Work dir: ${workdir}`);
  console.log(`Log dir: ${logDir}`);
  console.log(`Prompt file: ${modePromptPath}`);
  if (maxIterations > 0) {
    console.log(`Max iterations: ${maxIterations}`);
  } else {
    console.log("Max iterations: unlimited");
  }
  console.log(`Dry run: ${dryRun ? "enabled" : "disabled"}`);

  if (dryRun) {
    console.log("Dry run summary:");
    console.log(`Agent command: ${agentCmd}`);
    console.log(`Completion promise: ${completionPromise}`);
    console.log("No agent iterations were executed.");
    return;
  }

  const childEnv = {
    ...process.env,
    RALPH_CONFIG_DIR: configDir,
    RALPH_WORKDIR: workdir,
    RALPH_COMPLETION_PROMISE: completionPromise
  };

  let iteration = 0;
  while (true) {
    if (maxIterations > 0 && iteration >= maxIterations) {
      console.log(`Reached max iterations (${maxIterations}).`);
      break;
    }

    iteration += 1;
    const ts = timestampNow();
    const logFile = path.join(logDir, `ralph_${mode}_iter_${iteration}_${ts}.log`);
    const maxLabel = maxIterations > 0 ? `/${maxIterations}` : "";
    console.log(`\n=== Iteration ${iteration}${maxLabel} (${mode}) ===`);
    console.log(`Log file: ${logFile}`);

    const result = await runAgentIteration({
      agentCmd,
      runtimePrompt,
      workdir,
      logFile,
      env: childEnv
    });
    const durationSeconds = (result.durationMs / 1000).toFixed(1);
    console.log(`\nIteration ${iteration} completed in ${durationSeconds}s.`);

    if (result.code !== 0) {
      if (result.signal) {
        fail(`Agent command terminated by signal ${result.signal}. See: ${logFile}`);
      }
      fail(`Agent command exited with code ${result.code}. See: ${logFile}`);
    }

    if (result.lastNonEmptyLine === completionPromise) {
      console.log(`Detected completion promise in iteration ${iteration}.`);
      break;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    usage();
    return;
  }

  if (args[0] === "-h" || args[0] === "--help") {
    usage();
    return;
  }

  if (args[0] === "init") {
    if (args.length !== 1) {
      usage();
      process.exit(1);
    }
    initCommand();
    return;
  }

  if (args[0] === "plan") {
    const options = parseRunOptions(args.slice(1));
    await runLoop("plan", options.maxIterations, options);
    return;
  }

  if (args[0] === "build") {
    const options = parseRunOptions(args.slice(1));
    await runLoop("build", options.maxIterations, options);
    return;
  }

  usage();
  process.exit(1);
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
