# BUILD Mode

## Inputs

- Specs: `{{SPECS_GLOB}}`
- Implementation plan: `{{PLAN_FILE}}`
- Operator instructions file: `{{OPERATOR_INSTRUCT_FILE}}`
- Agent scratchpad file: `{{SCRATCHPAD_FILE}}`
- Target repository: `{{WORKDIR}}`

## Core Behavior

1. Read all specs, the implementation plan, and `{{SCRATCHPAD_FILE}}` first.
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

## Scratchpad Updates

1. Treat `{{SCRATCHPAD_FILE}}` as persistent memory for future iterations.
2. Reuse relevant existing notes before re-investigating the same area.
3. Add concise notes for findings that will accelerate or de-risk future unchecked tasks (exact file paths, contracts, constraints, commands, and pitfalls).
4. Correct or remove notes that are stale or disproven by current changes.
5. Keep notes factual and action-oriented; do not store transient logs or speculative brainstorming.

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
3. Never attempt to perform `**[Operator]**` tasks yourself.
4. If blocked, document the blocker in the plan and add any reusable blocker context to `{{SCRATCHPAD_FILE}}`, then stop.
5. Before ending the iteration, ensure `{{PLAN_FILE}}`, `{{OPERATOR_INSTRUCT_FILE}}`, and `{{SCRATCHPAD_FILE}}` are updated for the work performed.
6. After finishing one task, stop this iteration without printing `{{COMPLETION_PROMISE}}` unless one of the completion conditions below is met.
7. Print `{{COMPLETION_PROMISE}}` as the final non-empty line when either condition is true:
   - Full completion: there are no remaining unchecked `[ ]` tasks in `{{PLAN_FILE}}`, spec requirements and acceptance criteria are fully satisfied, and required verification/check commands are passing.
   - Operator handoff completion: the remaining unchecked tasks are only `**[Operator]**` tasks and/or agent verification tasks that are blocked on unchecked `**[Operator]**` tasks, and both `{{OPERATOR_INSTRUCT_FILE}}` and `{{PLAN_FILE}}` are fully updated with concrete operator steps plus acceptance criteria/checks.
8. In operator handoff completion state, do not continue looping on repeated blocked checks; return control to the human by printing `{{COMPLETION_PROMISE}}`.
