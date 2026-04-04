"use strict";

function buildPrompt(context) {
  return `# BUILD Mode

## Inputs

- Specs: \`${context.specsGlob}\`
- Implementation plan: \`${context.planFile}\`
- Target repository: \`${context.workdir}\`

## Core Behavior

1. Read all specs and the implementation plan first.
2. Pick exactly one highest-priority unchecked task.
3. Search the codebase before assuming anything is missing.
4. Keep changes minimal and coherent.

## Backpressure

Run relevant check commands for the target repository and keep fixing until green.
Common examples include:

\`\`\`sh
npm test
npm run lint
npm run typecheck
cargo test
pytest -q
\`\`\`

## Plan Updates

1. Mark completed tasks in \`${context.planFile}\`.
2. Add follow-up tasks directly below related items.
3. Keep tasks small and testable.

## Iteration Rules

1. Implement only one task in this iteration.
2. Make one commit with a clear message for this iteration.
3. If blocked, document the blocker in the plan and stop.
4. Print \`${context.completionPromise}\` as the final non-empty line only when all tasks and acceptance criteria are complete.
`;
}

function planPrompt(context) {
  return `# PLANNING Mode

## Inputs

- Specs: \`${context.specsGlob}\`
- Current codebase: \`${context.workdir}\`
- Plan output file: \`${context.planFile}\`

## Objective

Compare specs to the current codebase and create or refresh \`${context.planFile}\`.

## Rules

1. Prioritize tasks top-to-bottom.
2. Keep tasks small and testable.
3. Use checkbox format exactly: \`[ ]\` and \`[x]\`.
4. Include acceptance and verification hints where useful.
5. Do not implement production code in planning mode.
6. Add discovered follow-up tasks directly below related items.
7. Print \`${context.completionPromise}\` as the final non-empty line after planning is complete.
`;
}

module.exports = {
  buildPrompt,
  planPrompt
};
