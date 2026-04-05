# BUILD Mode

## Inputs

- Specs: `{{SPECS_GLOB}}`
- Implementation plan: `{{PLAN_FILE}}`
- Operator instructions file: `{{OPERATOR_INSTRUCT_FILE}}`
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

## Operator Updates

1. Update `{{OPERATOR_INSTRUCT_FILE}}` with any actions the human operator must perform before the next `ralph build`.
2. Keep instructions concrete and ordered, and include the acceptance criteria/checks that will be run after operator completion.
3. If operator action is required, add matching task items in `{{PLAN_FILE}}` that start with `**[Operator]**`.
4. Treat `**[Operator]**` plan items as human-owned steps that the operator will mark `[x]` after completing.
5. Immediately below each `**[Operator]**` task, add one or more agent-owned follow-up tasks to verify the operator step was done correctly.
6. If no operator action is required, state that explicitly in `{{OPERATOR_INSTRUCT_FILE}}` and remove stale `**[Operator]**` tasks.

## Iteration Rules

1. Implement only one task in this iteration.
2. Make one commit with a clear message for this iteration.
3. If blocked, document the blocker in the plan and stop.
4. After finishing one task, stop this iteration without printing `{{COMPLETION_PROMISE}}` unless the full job is complete.
5. Print `{{COMPLETION_PROMISE}}` as the final non-empty line only when there are no remaining unchecked `[ ]` tasks in `{{PLAN_FILE}}`, spec requirements and acceptance criteria are fully satisfied, and required verification/check commands are passing.
