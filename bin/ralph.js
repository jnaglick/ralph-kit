#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { buildPrompt, planPrompt } = require("../lib/prompts");

const DEFAULT_COMPLETION_PROMISE = "<promise>DONE</promise>";

function usage() {
  console.log(`Usage:
  ralph init
  ralph
  ralph <max-iterations>
  ralph build
  ralph build <max-iterations>
  ralph plan
  ralph plan <max-iterations>
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

  const envSh = `#!/usr/bin/env bash
# Source this file before running ralph commands.

# Claude default: add project .ralph dir access and bypass interactive permission prompts.
export RALPH_AGENT_CMD='claude -p --permission-mode bypassPermissions --add-dir "$PWD/.ralph"'

# Optional override:
# export RALPH_COMPLETION_PROMISE='${DEFAULT_COMPLETION_PROMISE}'
`;

  const plan = `# Implementation Plan

## Prioritized Tasks

- [ ] (Planning mode) Derive prioritized implementation tasks from \`specs/*.md\`.

## Notes

- Keep tasks small and testable.
- Add follow-up tasks directly below related items.
`;

  const spec = `# Spec: Example Feature

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

  fs.writeFileSync(path.join(configDir, "env.sh"), envSh, "utf8");
  fs.chmodSync(path.join(configDir, "env.sh"), 0o755);
  fs.writeFileSync(path.join(configDir, "IMPLEMENTATION_PLAN.md"), plan, "utf8");
  fs.writeFileSync(path.join(configDir, "specs", "001-example-spec.md"), spec, "utf8");

  console.log(`Initialized ${configDir}`);
  console.log("Next steps:");
  console.log("1. source ./.ralph/env.sh");
  console.log("2. Edit ./.ralph/specs/001-example-spec.md");
  console.log("3. Run: ralph plan 1");
  console.log("4. Review ./.ralph/IMPLEMENTATION_PLAN.md and edit if needed");
  console.log("5. Run: ralph");
}

function buildRuntimePrompt(mode, context) {
  const modePrompt = mode === "build" ? buildPrompt(context) : planPrompt(context);
  return `Ralph runtime context:
- Mode: ${mode}
- Work dir: ${context.workdir}
- Specs path: ${context.specsGlob}
- Plan path: ${context.planFile}
- Plan update path: ${context.planFile}
- Completion rule: final non-empty output line must exactly match ${context.completionPromise}

${modePrompt}
`;
}

function runAgentIteration({ agentCmd, runtimePrompt, workdir, logFile, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(agentCmd, {
      cwd: workdir,
      env,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

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
        if (line.trim() !== "") {
          lastNonEmptyLine = line.trimEnd();
        }
      }
    }

    child.stdout.on("data", ingest);
    child.stderr.on("data", ingest);

    child.on("error", (err) => {
      logStream.end(() => reject(err));
    });

    child.on("close", (code, signal) => {
      if (carry.trim() !== "") {
        lastNonEmptyLine = carry.trimEnd();
      }
      logStream.end(() => {
        resolve({
          code: code === null ? 1 : code,
          signal,
          lastNonEmptyLine
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

async function runLoop(mode, maxIterations) {
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

  const logDir = path.join(configDir, "logs");
  fs.mkdirSync(logDir, { recursive: true });

  const context = {
    workdir,
    specsGlob,
    planFile,
    completionPromise
  };
  const runtimePrompt = buildRuntimePrompt(mode, context);

  console.log(`Mode: ${mode}`);
  console.log(`Config dir: ${configDir}`);
  console.log(`Work dir: ${workdir}`);
  console.log(`Log dir: ${logDir}`);
  if (maxIterations > 0) {
    console.log(`Max iterations: ${maxIterations}`);
  } else {
    console.log("Max iterations: unlimited");
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
    const result = await runAgentIteration({
      agentCmd,
      runtimePrompt,
      workdir,
      logFile,
      env: childEnv
    });

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
    await runLoop("build", 0);
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
    await runLoop("plan", parseMax(args.slice(1)));
    return;
  }

  if (args[0] === "build") {
    await runLoop("build", parseMax(args.slice(1)));
    return;
  }

  if (args.length === 1 && isUint(args[0])) {
    await runLoop("build", Number(args[0]));
    return;
  }

  usage();
  process.exit(1);
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
