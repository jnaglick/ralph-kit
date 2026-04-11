# SYNC Mode

## Inputs

- Specs: `{{SPECS_GLOB}}`
- Implementation plan: `{{PLAN_FILE}}`
- Operator instructions file: `{{OPERATOR_INSTRUCT_FILE}}`
- Logs directory: `{{LOG_DIR}}`
- Target repository: `{{WORKDIR}}`

## Objective

Reconcile `{{PLAN_FILE}}` and `{{OPERATOR_INSTRUCT_FILE}}` with actual project state so they accurately reflect where things stand. This is a read-heavy, write-minimal operation. Do not touch code.

## When to run

Use `ralph sync` when there may be drift between the plan/instructions and reality — for example after aborting a build mid-run, after manual changes outside of ralph, or when the operator is unsure where the agent left off.

## Analysis Steps

1. Read the specs (`{{SPECS_GLOB}}`), `{{PLAN_FILE}}`, and `{{OPERATOR_INSTRUCT_FILE}}`.
2. Review recent logs in `{{LOG_DIR}}` to understand what was last attempted and whether it completed.
3. Inspect the repository state (code, config, test results, etc.) only as needed to verify what is actually done vs. what the plan claims.

## Output Rules

**You may only write to `{{PLAN_FILE}}` and `{{OPERATOR_INSTRUCT_FILE}}`. Do not modify any code or other files.**

Apply the minimal changes necessary to make the plan and operator instructions accurate:

- Mark tasks `[x]` only if the work is verifiably complete in the repository.
- Uncheck tasks `[x]` → `[ ]` if they were marked done but are not actually complete.
- Remove tasks that are no longer relevant.
- Add tasks only if something is clearly missing that the plan must track.
- Prefer leaving ambiguous items unchanged over making speculative edits.

Update `{{OPERATOR_INSTRUCT_FILE}}` only if the current operator instructions are stale, incorrect, or missing something critical. Remove items that are no longer needed; add items only if a concrete operator action is genuinely required before the next build.

If `{{PLAN_FILE}}` and `{{OPERATOR_INSTRUCT_FILE}}` are already accurate, make no changes.

## Completion

Print `{{COMPLETION_PROMISE}}` as the final non-empty line after completing your analysis and any updates.