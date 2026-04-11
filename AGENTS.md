# Agent Operating Guide

This file defines how an agent should work when modifying this repository (`ralph-kit`), not how the generated `.ralph` runtime behaves.

## Purpose

`ralph-kit` is an npm CLI that installs a global `ralph` binary.

Core product behavior:

- `ralph init` creates a `.ralph/` directory in the current project directory.
- `ralph plan [max-iterations] [--dry-run]` runs planning-mode loop iterations.
- `ralph build [max-iterations] [--dry-run]` runs build-mode loop iterations.
- `ralph sync [max-iterations] [--dry-run]` reconciles the plan and operator instructions with actual project state.
- `ralph` with no arguments prints usage (no implicit build mode).

Design intent:

- Project-local only.
- CWD is always the target workdir.
- Config is always `<cwd>/.ralph`.
- Logs are always `<cwd>/.ralph/logs`.

## Environment Baseline

- Node runtime: use Node 22 via `nvm` when developing locally.
- Package type: ESM (`"type": "module"`).
- Global binary entrypoint: `bin/ralph.js`.

## Source Layout

- `bin/ralph.js`: CLI argument parsing, init scaffolding, loop orchestration, process execution, logging.
- `lib/prompts.js`: prompt template loading + project prompt scaffolding.
- `lib/constants.js`: CLI text/scaffold constants.
- `lib/utils.js`: shared runtime helpers (setup validation, text normalization, timestamping, process cleanup).
- `prompts/build.md`, `prompts/plan.md`, and `prompts/sync.md`: canonical prompt templates scaffolded into project `.ralph/prompts/`.
- `README.md`: user-facing install + usage docs.
- `package.json`: package metadata, bin mapping, publish file list.
- `.gitignore`: ignore logs and generated runtime output.

## Product Invariants (Do Not Break)

1. No target-dir indirection:
- `ralph init` initializes the current directory only.
- Runtime assumes `workdir = process.cwd()`.

2. Fixed config location:
- `configDir = <workdir>/.ralph`.
- No `RALPH_CONFIG_DIR` override behavior in CLI resolution.

3. Fixed log location:
- `logDir = <workdir>/.ralph/logs`.
- No `RALPH_LOG_DIR` override.

4. Required setup signal:
- `RALPH_AGENT_CMD` must be set or command exits with setup error.

5. Completion semantics:
- Loop exits early when the last non-empty output line matches `RALPH_COMPLETION_PROMISE` (default `<promise>DONE</promise>`), either as a literal match or when `parsed.result` trimmed end matches it for JSON output lines.

6. `.ralph` scaffold contents:
- `.ralph/env.sh`
- `.ralph/IMPLEMENTATION_PLAN.md`
- `.ralph/OPERATOR_INSTRUCT.md`
- `.ralph/prompts/build.md`
- `.ralph/prompts/plan.md`
- `.ralph/prompts/sync.md`
- `.ralph/specs/001-example-spec.md`

7. Prompt templates:
- Canonical prompt templates live in-repo under `prompts/build.md`, `prompts/plan.md`, and `prompts/sync.md`.
- `ralph init` scaffolds them to `.ralph/prompts/build.md`, `.ralph/prompts/plan.md`, and `.ralph/prompts/sync.md`.
- Runtime loads prompts from `.ralph/prompts/*.md`, so users can customize prompts per project.

8. CLI entry behavior:
- `ralph` with no subcommand prints usage and exits.
- Loop execution requires explicit `build`, `plan`, or `sync` subcommands.

9. Dry run behavior:
- `--dry-run` is supported on `build`, `plan`, and `sync`.
- Dry run prints resolved runtime context and exits without executing agent iterations.

10. PID file behavior:
- While an agent iteration is running, `.ralph/agent.pid` is written after spawning the child process.
- Contents: `{ pid, mode, startedAt, logFile, note }` (JSON).
- The `note` field contains the kill command to signal the entire process group.
- The file is deleted (best-effort) when the iteration closes or errors.

## Code Change Guidelines

### Keep behavior explicit

- Favor straightforward logic over abstractions.
- Keep CLI parsing and error paths easy to audit.
- Preserve exact setup/error messaging unless changing behavior intentionally.

### Keep prompts deterministic

- If you edit prompt-loading behavior or canonical prompt templates, keep:
  - single-task iteration behavior in build mode,
  - plan-only behavior in planning mode,
  - checkbox format guidance (`[ ]`, `[x]`),
  - explicit completion-promise final-line requirement.

### Avoid hidden runtime dependencies

- Do not require files outside project root for normal operation.
- Do not require global config files for core functionality.

## Validation Checklist (Run Before Finishing)

Use Node 22:

```bash
source ~/.nvm/nvm.sh
nvm use 22
```

1. Syntax checks:

```bash
node --check bin/ralph.js
node --check lib/prompts.js
node --check lib/constants.js
node --check lib/utils.js
```

2. CLI help:

```bash
node bin/ralph.js
node bin/ralph.js --help
```

3. Init in a clean temp project:

```bash
TMP=$(mktemp -d)
mkdir -p "$TMP/demo"
cd "$TMP/demo"
node /absolute/path/to/ralph/bin/ralph.js init
find .ralph -maxdepth 3 -type f | sort
```

Expected files:
- `.ralph/env.sh`
- `.ralph/IMPLEMENTATION_PLAN.md`
- `.ralph/OPERATOR_INSTRUCT.md`
- `.ralph/prompts/build.md`
- `.ralph/prompts/plan.md`
- `.ralph/prompts/sync.md`
- `.ralph/specs/001-example-spec.md`

4. Loop smoke test with dummy completion agent:

```bash
source .ralph/env.sh
export RALPH_AGENT_CMD='printf "<promise>DONE</promise>\n"'
node /absolute/path/to/ralph/bin/ralph.js plan 1
```

Expected:
- exits successfully,
- detects completion in iteration 1,
- writes a log under `.ralph/logs`.

5. Dry-run smoke test:

```bash
node /absolute/path/to/ralph/bin/ralph.js build --dry-run
node /absolute/path/to/ralph/bin/ralph.js sync --dry-run
```

Expected:
- prints runtime context,
- does not execute any iteration,
- does not require prompt completion output.

6. Packability check:

```bash
npm pack --dry-run
```

Confirm expected tarball contents:
- `package.json`
- `bin/ralph.js`
- `lib/constants.js`
- `lib/prompts.js`
- `lib/utils.js`
- `README.md`

## Documentation Requirements

When behavior changes, update `README.md` in the same change set.

At minimum, docs must stay accurate for:
- command usage,
- explicit subcommand requirement (`build`/`plan`/`sync`) and dry-run behavior,
- required env vars,
- fixed `.ralph` path model,
- completion semantics.

## Common Failure Modes

1. `RALPH_AGENT_CMD` missing:
- CLI should fail fast with setup error.

2. Agent command exits non-zero:
- CLI should fail and point to iteration log path.

3. Empty or malformed max-iteration args:
- CLI should print usage/error and exit non-zero.

4. Running `ralph` without a subcommand:
- CLI should print usage and exit without starting iterations.

5. Existing non-empty `.ralph` on `init`:
- CLI should refuse overwrite.

## Release Notes Checklist

__ONLY__ publish a release when explicitly told to do so.

Before publishing:

1. Update version in `package.json`.
2. Run full validation checklist above.
3. Run `npm pack --dry-run`.
4. Optionally install tarball locally and verify global binary:

```bash
npm i -g ./ralph-kit-<version>.tgz
ralph --help
```

5. Publish only after docs and behavior match.

## Non-Goals

- Supporting arbitrary external config directories.
- Multi-repo orchestration from one invocation.
- Hidden mutable state outside `<cwd>/.ralph`.
