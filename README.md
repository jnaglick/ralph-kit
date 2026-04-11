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
  OPERATOR_INSTRUCT.md
  prompts/
    build.md
    plan.md
    sync.md
  specs/
    001-example-spec.md
```

## Use

1. Source the generated env file.
```bash
source .ralph/env.sh
```
2. Edit `.ralph/specs/*.md`.
3. Optionally edit `.ralph/prompts/build.md`, `.ralph/prompts/plan.md`, and `.ralph/prompts/sync.md` to customize agent behavior.
4. Generate or refresh the plan:
```bash
ralph plan
```
5. Execute build iterations:
```bash
ralph build
```
6. (Optionally) Refresh operator-facing required actions:
```bash
ralph sync
```
7. Preview runtime context without invoking the agent:
```bash
ralph build --dry-run
ralph plan --dry-run
ralph sync --dry-run
```

## Commands

Run these from your project root

- `ralph init`: create `.ralph` starter files in the current directory.
- `ralph`: print usage.
- `ralph build [max-iterations]`: build mode.
- `ralph plan [max-iterations]`: planning mode.
- `ralph sync [max-iterations]`: reconciles the plan and operator instructions with actual project state.
- `ralph [build|plan|sync] [max-iterations] --dry-run`: print resolved runtime context and exit without running iterations.

## Environment Variables

- `RALPH_AGENT_CMD` (required): agent command that reads prompt text from stdin.
- `RALPH_COMPLETION_PROMISE` (optional): defaults to `<promise>DONE</promise>`.

Default `.ralph/env.sh` sets `RALPH_AGENT_CMD` to use Claude.

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

The completion promise must not represent single-task completion. In build mode it should be emitted only for:
- Full completion: no unchecked `[ ]` tasks remain in the plan, spec acceptance criteria are satisfied, and verification commands are passing.
- Operator handoff completion: remaining unchecked tasks are only operator-owned tasks (plus verification tasks blocked on them), and operator instructions are fully updated.

### Operator Instruction Semantics

- `ralph sync` reconciles the plan and operator instructions with actual project state.
- `ralph plan` can reconcile operator-reported completed work from specs and refresh both `.ralph/IMPLEMENTATION_PLAN.md` and `.ralph/OPERATOR_INSTRUCT.md`.
- `ralph build` also updates `.ralph/OPERATOR_INSTRUCT.md` with any human-required steps discovered during implementation.
- When operator action is required, the agent should also add plan tasks that start with `**[Operator]**`.
- The operator should mark those `**[Operator]**` tasks as `[x]` after completing them.
- The agent should add agent-owned follow-up verification tasks immediately below operator tasks to validate operator work.
- Operator instructions should include the acceptance criteria/checks that will be run after operator completion.
- In build mode, if only operator tasks (and agent verification tasks blocked on them) remain, the agent should print the completion promise to hand control back to the operator instead of looping.
- If no operator action is required, `.ralph/OPERATOR_INSTRUCT.md` should explicitly say so.


### Notes

- Planning, build, and sync logs are written to `.ralph/logs/<timestamp>_<mode>_<iteration>_.log`.
- While an agent iteration is running, `.ralph/agent.pid` is written with JSON: `{ pid, mode, startedAt, logFile, note }`. It is removed when the iteration completes.
- On process exit, the CLI does best-effort cleanup of the running agent process tree to avoid lingering child processes.
- `--dry-run` validates setup and prints mode/config context, but does not execute any agent iterations.
