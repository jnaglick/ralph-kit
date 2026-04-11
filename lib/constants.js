export const DEFAULT_COMPLETION_PROMISE = "<promise>DONE</promise>";

export const DEFAULT_ENV_SH = `#!/usr/bin/env bash
# Source this file before running ralph commands.

# Claude default: add project .ralph dir access and bypass interactive permission prompts.
CLAUDE_AGENT_CMD='claude -p --permission-mode bypassPermissions --add-dir "$PWD/.ralph"'

# Codex default: add project .ralph dir access and never ask for approval, but run in a sandbox with full access to the system. Adjust sandbox level as needed.
CODEX_AGENT_CMD='codex --ask-for-approval never --sandbox danger-full-access --add-dir "$PWD/.ralph" exec'

export RALPH_AGENT_CMD="$CLAUDE_AGENT_CMD"

# Optional override:
# export RALPH_COMPLETION_PROMISE='${DEFAULT_COMPLETION_PROMISE}'
`;

export const DEFAULT_PLAN = `# Implementation Plan

## Prioritized Tasks

- [ ] (Planning mode) Derive prioritized implementation tasks from \`specs/*.md\`.

## Notes

- Keep tasks small and testable.
- Add follow-up tasks directly below related items.
`;

export const DEFAULT_FIRST_SPEC = `# Spec: Example Feature

## Goal

Implement a small vertical slice end-to-end.

## Requirements

- Add \`GET /health\` returning \`{ "ok": true }\`.
- Add automated test coverage.
- Update docs with a usage example.

## Acceptance Criteria

- The test command passes with endpoint coverage.
- Lint and type checks pass.
- Docs mention the endpoint and include a sample response.
`;

export const DEFAULT_OPERATOR_INSTRUCT = `# Operator Instructions

This file is for actions that require a human operator between ralph runs.
Update this file in build/plan/sync mode and keep it current.

## Required Before Next Build

- No operator action required.

## Notes

- Keep items concrete and executable.
- Include the acceptance criteria/checks that will be run after the operator completes each step.
- Remove stale items once they are no longer needed.
`;

export const HELP_TEXT = `Usage:
  ralph init
  ralph build [max-iterations] [--dry-run]
  ralph plan [max-iterations] [--dry-run]
  ralph sync [max-iterations] [--dry-run]
  ralph -h | --help

Commands:
  init
    Initialize .ralph in the current directory.

  build [max-iterations] [--dry-run]
    Run build-mode loop iterations.

  plan [max-iterations] [--dry-run]
    Run planning-mode loop iterations.

  sync [max-iterations] [--dry-run]
    Run operator-instruction refresh loop iterations.

Arguments:
  max-iterations
    Non-negative integer. Omit for unlimited iterations.

Options:
  --dry-run
    Validate setup and print runtime context without running iterations.
  -h, --help
    Show this help message.

Environment:
  RALPH_AGENT_CMD (required)
    Command used to run the agent each iteration.
  RALPH_COMPLETION_PROMISE (optional)
    Completion marker checked against the final non-empty output line.
    Default: ${DEFAULT_COMPLETION_PROMISE}

Examples:
  ralph init
  ralph plan 1
  ralph build 5
  ralph sync 1
  ralph build --dry-run`;
