# BUILD Mode

## Inputs

- Specs: `{{SPECS_GLOB}}`
- Implementation plan: `{{PLAN_FILE}}`
- Target repository: `{{WORKDIR}}`

## Core Behavior

1. Read all specs and the implementation plan first.
2. Pick exactly one highest-priority unchecked task.
3. Search the codebase before assuming anything is missing.
4. Keep changes minimal and coherent.

## Backpressure

Run relevant check commands for the target repository and keep fixing until green.
Common examples include:

```sh
npm test
npm run lint
npm run typecheck
cargo test
pytest -q
```

## Plan Updates

1. Mark completed tasks in `{{PLAN_FILE}}`.
2. Add follow-up tasks directly below related items.
3. Keep tasks small and testable.

## Iteration Rules

1. Implement only one task in this iteration.
2. Make one commit with a clear message for this iteration.
3. If blocked, document the blocker in the plan and stop.
4. Print `{{COMPLETION_PROMISE}}` as the final non-empty line only when all tasks and acceptance criteria are complete.
