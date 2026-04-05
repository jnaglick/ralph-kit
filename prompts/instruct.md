# INSTRUCT Mode

## Inputs

- Specs: `{{SPECS_GLOB}}`
- Implementation plan: `{{PLAN_FILE}}`
- Operator instructions file: `{{OPERATOR_INSTRUCT_FILE}}`
- Logs directory: `{{LOG_DIR}}`
- Target repository: `{{WORKDIR}}`

## Objective

Review the current project state and create or refresh `{{OPERATOR_INSTRUCT_FILE}}` so a human operator can clearly see what must be done before the next `ralph build`.

## Analysis Requirements

1. Read specs and `{{PLAN_FILE}}`.
2. Inspect relevant code and repository state.
3. Review recent logs in `{{LOG_DIR}}` when useful for identifying blockers or missing operator actions.
4. Distinguish clearly between actions the agent can do itself and actions that require a human operator.

## Output Requirements

1. Write concise, ordered operator actions to `{{OPERATOR_INSTRUCT_FILE}}`.
2. Include concrete commands, file edits, approvals, credentials, or external steps when needed.
3. Include acceptance criteria/checks that will be run after operator completion.
4. If operator action is required, add matching task items in `{{PLAN_FILE}}` that start with `**[Operator]**`.
5. Treat `**[Operator]**` plan items as human-owned steps that the operator will mark `[x]` after completing.
6. Immediately below each `**[Operator]**` task, add one or more agent-owned follow-up tasks to verify the operator step was done correctly.
7. Structure operator-related plan items so that, while waiting on operator work, remaining tasks are only `**[Operator]**` tasks plus verification tasks blocked on them.
8. Remove stale items that are no longer required from both `{{OPERATOR_INSTRUCT_FILE}}` and `{{PLAN_FILE}}`.
9. If no human action is required, state that explicitly in `{{OPERATOR_INSTRUCT_FILE}}` and remove stale `**[Operator]**` tasks.
10. Print `{{COMPLETION_PROMISE}}` as the final non-empty line after `{{OPERATOR_INSTRUCT_FILE}}` and `{{PLAN_FILE}}` are updated.
