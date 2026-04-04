# ralph-kit

My ralph loop cli (https://ghuntley.com/loop/)

## Install

```bash
npm i -g ralph-kit
```

This installs a global binary named `ralph`.

## Initialize A Project

From your project root:

```bash
ralph init
```

This creates:

```text
.ralph/
  env.sh
  IMPLEMENTATION_PLAN.md
  prompts/
    build.md
    plan.md
  specs/
    001-example-spec.md
```

## Use

1. Source the generated env file.
```bash
source .ralph/env.sh
```
2. Edit `.ralph/specs/*.md`.
3. Optionally edit `.ralph/prompts/build.md` and `.ralph/prompts/plan.md` to customize agent behavior.
4. Generate or refresh the plan:
```bash
ralph plan
```
5. Execute build iterations:
```bash
ralph build
```
6. Preview what would run without invoking the agent:
```bash
ralph build --dry-run
ralph plan --dry-run
```

## Commands

Run these from your project root

- `ralph init`: create `.ralph` starter files in the current directory.
- `ralph`: print usage.
- `ralph build [max-iterations]`: build mode.
- `ralph plan [max-iterations]`: planning mode.
- `ralph [build|plan] [max-iterations] --dry-run`: print resolved runtime context and exit without running iterations.

## Environment Variables

- `RALPH_AGENT_CMD` (required): agent command that reads prompt text from stdin.
- `RALPH_COMPLETION_PROMISE` (optional): defaults to `<promise>DONE</promise>`.

Default `.ralph/env.sh` sets:

- `RALPH_AGENT_CMD` to Claude print mode with `--permission-mode bypassPermissions` and `--add-dir "$PWD/.ralph"`.

## Operators Manual

### Build Iteration Semantics

One build iteration is one full invocation of `RALPH_AGENT_CMD`.

For each iteration, `ralph` does this:

1. Builds the runtime prompt and sends it to the agent on stdin.
2. Streams agent output to console and iteration log file.
3. Waits for the agent command to exit.
4. Starts the next iteration unless a stop condition is met.

Stop conditions are:

1. Agent exits non-zero.
2. Max iterations is reached when using `ralph build <n>`.
3. The final non-empty output line exactly matches `RALPH_COMPLETION_PROMISE`.

### Task Selection And Completion

Build mode is agent-driven by prompt instructions. The prompt tells the agent to do one highest-priority unchecked plan task per iteration, but the CLI does not enforce plan-step counting itself.

The completion promise must represent full completion, not single-task completion. In build mode that means no unchecked `[ ]` tasks remain in the plan, spec acceptance criteria are satisfied, and verification commands are passing.


### Notes

- Planning and build logs are written to `ralph_<mode>_iter_<n>_<timestamp>.log`.
- On process exit, the CLI does best-effort cleanup of the running agent process tree to avoid lingering child processes.
- `--dry-run` validates setup and prints mode/config context, but does not execute any agent iterations.
