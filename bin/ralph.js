#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  loadModePrompt,
  projectPromptPath,
  scaffoldProjectPrompts,
  buildRuntimePrompt
} from "../lib/prompts.js";
import {
  DEFAULT_COMPLETION_PROMISE,
  DEFAULT_ENV_SH,
  DEFAULT_FIRST_SPEC,
  DEFAULT_OPERATOR_INSTRUCT,
  DEFAULT_PLAN,
  HELP_TEXT
} from "../lib/constants.js";
import {
  ensureDirectory,
  ensureFile,
  fail,
  normalizeOutputLine,
  signalProcessTree,
  timestampNow
} from "../lib/utils.js";

function usage() {
  console.log(HELP_TEXT);
}

function parseMaxIterations(rest) {
  if (rest.length === 0) {
    return 0;
  }
  if (rest.length === 1 && /^[0-9]+$/.test(rest[0])) {
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
    maxIterations: parseMaxIterations(positional)
  };
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
  fs.writeFileSync(path.join(configDir, "OPERATOR_INSTRUCT.md"), DEFAULT_OPERATOR_INSTRUCT, "utf8");
  fs.writeFileSync(path.join(configDir, "specs", "001-example-spec.md"), DEFAULT_FIRST_SPEC, "utf8");

  console.log(`Initialized ${configDir}`);
  console.log("Next steps:");
  console.log("1. source .ralph/env.sh");
  console.log("2. Optionally edit .ralph/prompts/build.md, .ralph/prompts/plan.md, and .ralph/prompts/sync.md");
  console.log("3. Edit .ralph/specs/001-example-spec.md");
  console.log("4. Run: ralph plan");
  console.log("5. Review .ralph/IMPLEMENTATION_PLAN.md and .ralph/OPERATOR_INSTRUCT.md");
  console.log("6. Run: ralph build");
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
      signalProcessTree(child, "SIGTERM", useProcessGroup);
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
      signalProcessTree(child, "SIGTERM", useProcessGroup);

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
  const operatorInstructFile = path.join(configDir, "OPERATOR_INSTRUCT.md");
  ensureDirectory(specsDir, "Specs directory");
  ensureFile(planFile, "Implementation plan");
  if (!fs.existsSync(operatorInstructFile)) {
    fs.writeFileSync(operatorInstructFile, DEFAULT_OPERATOR_INSTRUCT, "utf8");
  } else {
    ensureFile(operatorInstructFile, "Operator instructions");
  }
  scaffoldProjectPrompts(configDir);

  const logDir = path.join(configDir, "logs");
  fs.mkdirSync(logDir, { recursive: true });

  const context = {
    workdir,
    specsGlob,
    planFile,
    completionPromise,
    operatorInstructFile,
    logDir
  };
  const modePromptPath = projectPromptPath(configDir, mode);
  const modePrompt = loadModePrompt(configDir, mode, context);
  const runtimePrompt = buildRuntimePrompt(mode, context, modePrompt, modePromptPath);

  console.log(`Mode: ${mode}`);
  console.log(`Config dir: ${configDir}`);
  console.log(`Work dir: ${workdir}`);
  console.log(`Log dir: ${logDir}`);
  console.log(`Prompt file: ${modePromptPath}`);
  console.log(`Operator instructions file: ${operatorInstructFile}`);
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

  if (args[0] === "sync") {
    const options = parseRunOptions(args.slice(1));
    await runLoop("sync", options.maxIterations, options);
    return;
  }

  usage();
  process.exit(1);
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
