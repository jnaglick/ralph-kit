# PLANNING Mode

## Inputs

- Specs: `{{SPECS_GLOB}}`
- Current codebase: `{{WORKDIR}}`
- Plan output file: `{{PLAN_FILE}}`
- Operator instructions file: `{{OPERATOR_INSTRUCT_FILE}}`

## Objective

Compare specs to the current codebase and create or refresh `{{PLAN_FILE}}`.
When specs include operator notes about completed external work, reconcile plan state and operator guidance accordingly.

## Rules

1. Prioritize tasks top-to-bottom.
2. Keep tasks small and testable.
3. Use checkbox format exactly: `[ ]` and `[x]`.
4. Include acceptance and verification hints where useful.
5. Do not implement production code in planning mode.
6. Add discovered follow-up tasks directly below related items.
7. Reconcile operator-reported completed work from specs by marking matching plan items complete and removing stale blockers.
8. Refresh `{{OPERATOR_INSTRUCT_FILE}}` with any remaining human-required actions before the next build.
9. Operator instructions must include acceptance criteria/checks that will be run after operator completion.
10. If operator action is required, add matching task items in `{{PLAN_FILE}}` that start with `**[Operator]**`.
11. Treat `**[Operator]**` plan items as human-owned steps that the operator will mark `[x]` after completing.
12. Immediately below each `**[Operator]**` task, add one or more agent-owned follow-up tasks to verify the operator step was done correctly.
13. Structure operator-related plan items so that, while waiting on operator work, remaining tasks are only `**[Operator]**` tasks plus verification tasks blocked on them.
14. If no human action is required, state that explicitly in `{{OPERATOR_INSTRUCT_FILE}}` and remove stale `**[Operator]**` tasks.
15. Print `{{COMPLETION_PROMISE}}` as the final non-empty line after planning updates are complete.
