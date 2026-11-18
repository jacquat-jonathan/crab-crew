#!/usr/bin/env node
// PreToolUse hook for Bash. Only acts when the caller is the crew reviewer agent: it may run a
// single read-only git command, nothing else. Every other caller passes through untouched.
// Exit 2 blocks the call (stderr is the reason); exit 0 lets it run.
// Fails closed: if the input can't be read, the call is blocked, since the caller is unknown.

const REVIEWER_TYPES = new Set(['reviewer', 'crew:reviewer']);
const SUBCOMMANDS = new Set(['diff', 'log', 'show', 'status', 'rev-parse', 'merge-base', 'ls-files', 'blame']);
// Options that run programs, write files, or point git at another config/repository.
// Git accepts unambiguous abbreviations of long options, so any prefix of these is refused too.
const FORBIDDEN_OPTIONS = ['--output', '--ext-diff', '--textconv', '--exec-path', '--git-dir',
  '--work-tree', '--config-env', '--upload-pack', '--receive-pack', '--open-files-in-pager'];
const isForbidden = (arg) => {
  if (!arg.startsWith('--') || arg === '--') return false;
  const name = arg.split('=')[0];
  return FORBIDDEN_OPTIONS.some((opt) => opt.startsWith(name));
};
// Anything that lets the shell do more than run one plain command.
const SHELL_META = /[;&|<>`$(){}\\'"\n\r!*?[\]#]/;

function block(reason) {
  process.stderr.write(`crew reviewer: ${reason}. Only single read-only git commands are allowed ` +
    `(git [-C <path>] [--no-pager] ${[...SUBCOMMANDS].join('|')} ...).\n`);
  process.exit(2);
}

// Returns null when allowed, or the reason it is not.
export function check(command) {
  if (typeof command !== 'string' || command.trim() === '') return 'empty command';
  if (SHELL_META.test(command)) return 'shell operators, quotes and expansions are not allowed';
  const args = command.trim().split(/\s+/);
  if (args.shift() !== 'git') return 'not a git command';
  while (args.length && args[0].startsWith('-')) {
    const opt = args.shift();
    if (opt === '--no-pager') continue;
    if (opt === '-C' && args.length) { args.shift(); continue; }
    return `git option ${opt} is not allowed before the subcommand`;
  }
  const sub = args.shift();
  if (!SUBCOMMANDS.has(sub)) return `git ${sub ?? '(none)'} is not allowed`;
  const bad = args.find(isForbidden);
  if (bad) return `option ${bad} is not allowed`;
  return null;
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => block('hook error'));
}
