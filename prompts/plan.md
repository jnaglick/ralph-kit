# PLANNING Mode

## Inputs

- Specs: `{{SPECS_GLOB}}`
- Current codebase: `{{WORKDIR}}`
- Plan output file: `{{PLAN_FILE}}`

## Objective

Compare specs to the current codebase and create or refresh `{{PLAN_FILE}}`.

## Rules

1. Prioritize tasks top-to-bottom.
2. Keep tasks small and testable.
3. Use checkbox format exactly: `[ ]` and `[x]`.
4. Include acceptance and verification hints where useful.
5. Do not implement production code in planning mode.
6. Add discovered follow-up tasks directly below related items.
7. Print `{{COMPLETION_PROMISE}}` as the final non-empty line after planning is complete.
