# Agent Operating Guide

This file defines how an agent should work when modifying this repository (`ralph-kit`), not how the generated `.ralph` runtime behaves.

## Purpose

`ralph-kit` is an npm CLI that installs a global `ralph` binary.

Core product behavior:

- `ralph init` creates a `.ralph/` directory in the current project directory.
- `ralph plan [max-iterations]` runs planning-mode loop iterations.
- `ralph build [max-iterations]` and `ralph [max-iterations]` run build-mode loop iterations.

Design intent:

- Project-local only.
- CWD is always the target workdir.
- Config is always `<cwd>/.ralph`.
- Logs are always `<cwd>/.ralph/logs`.

## Environment Baseline

- Node runtime: use Node 22 via `nvm` when developing locally.
- Package type: CommonJS.
- Global binary entrypoint: `bin/ralph.js`.

## Source Layout

- `bin/ralph.js`: CLI argument parsing, init scaffolding, loop orchestration, process execution, logging.
- `lib/prompts.js`: embedded build/plan prompt templates.
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
- Loop exits early only when the last non-empty output line equals `RALPH_COMPLETION_PROMISE` (default `<promise>DONE</promise>`).

6. `.ralph` scaffold contents:
- `.ralph/env.sh`
- `.ralph/IMPLEMENTATION_PLAN.md`
- `.ralph/specs/001-example-spec.md`

7. Internal prompts:
- `AGENTS.md`, `PROMPT_build.md`, `PROMPT_plan.md` are not scaffolded into `.ralph`.
- Prompt behavior is embedded in `lib/prompts.js`.

## Code Change Guidelines

### Keep behavior explicit

- Favor straightforward logic over abstractions.
- Keep CLI parsing and error paths easy to audit.
- Preserve exact setup/error messaging unless changing behavior intentionally.

### Keep prompts deterministic

- If you edit `lib/prompts.js`, keep:
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
```

2. CLI help:

```bash
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

5. Packability check:

```bash
npm pack --dry-run
```

Confirm expected tarball contents:
- `package.json`
- `bin/ralph.js`
- `lib/prompts.js`
- `README.md`

## Documentation Requirements

When behavior changes, update `README.md` in the same change set.

At minimum, docs must stay accurate for:
- command usage,
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

4. Existing non-empty `.ralph` on `init`:
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
