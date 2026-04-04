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
  specs/
    001-example-spec.md
```

## Use

1. Source the generated env file.
```bash
source .ralph/env.sh
```
2. Edit `.ralph/specs/*.md`.
3. Generate or refresh the plan:
```bash
ralph plan
```
4. Execute build iterations:
```bash
ralph build
```

## Commands

Run these from your project root

- `ralph init`: create `.ralph` starter files in the current directory.
- `ralph build [max-iterations]`: build mode.
- `ralph plan [max-iterations]`: planning mode.

## Environment Variables

- `RALPH_AGENT_CMD` (required): agent command that reads prompt text from stdin.
- `RALPH_COMPLETION_PROMISE` (optional): defaults to `<promise>DONE</promise>`.

Default `.ralph/env.sh` sets:

- `RALPH_AGENT_CMD` to Claude print mode with `--permission-mode bypassPermissions` and `--add-dir "$PWD/.ralph"`.

## Notes

- The loop stops early only when the final non-empty output line exactly matches the completion promise.
- Planning and build logs are written to `ralph_<mode>_iter_<n>_<timestamp>.log`.
