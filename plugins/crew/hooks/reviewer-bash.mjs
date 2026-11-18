#!/usr/bin/env node
// PreToolUse hook for Bash. Only acts when the caller is the crew reviewer agent: it may run a
// single read-only git command, nothing else. Every other caller passes through untouched.
// Exit 2 blocks the call (stderr is the reason); exit 0 lets it run.
// Fails closed when the input can't be read or anything throws. It cannot act when node is
// missing or the runtime sends no agent_type: see the README.
import { REVIEWER_TYPES, SUBCOMMANDS, check } from './check.mjs';

function block(reason) {
  process.stderr.write(`crew reviewer: ${reason}. Only single read-only git commands are allowed ` +
    `(git [-C <path>] [--no-pager] ${[...SUBCOMMANDS].join('|')} ...).\n`);
  process.exit(2);
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input;
  try { input = JSON.parse(raw); } catch { block('could not read hook input'); }
  if (!REVIEWER_TYPES.has(input?.agent_type)) process.exit(0);
  if (input.tool_name !== 'Bash') process.exit(0);
  const reason = check(input.tool_input?.command);
  if (reason) block(reason);
  process.exit(0);
}

main().catch(() => block('hook error'));
