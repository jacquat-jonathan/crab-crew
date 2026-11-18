// Rules for the crew reviewer's Bash: a single read-only git command, nothing else.

export const REVIEWER_TYPES = new Set(['reviewer', 'crew:reviewer']);
export const SUBCOMMANDS = new Set(['diff', 'log', 'show', 'status', 'rev-parse', 'merge-base', 'ls-files', 'blame']);
// Options that run programs, write files, or point git at another config/repository.
// Git accepts unambiguous abbreviations of long options, so any prefix of these is refused too.
const FORBIDDEN_OPTIONS = ['--output', '--ext-diff', '--textconv', '--exec-path', '--git-dir',
  '--work-tree', '--config-env', '--upload-pack', '--receive-pack', '--open-files-in-pager'];
// Real options that happen to be prefixes of a forbidden one; git matches them exactly.
const ALLOWED_EXACT = new Set(['--text']);
const isForbidden = (arg) => {
  if (!arg.startsWith('--') || arg === '--') return false;
  const name = arg.split('=')[0];
  if (ALLOWED_EXACT.has(name)) return false;
  return FORBIDDEN_OPTIONS.some((opt) => opt.startsWith(name));
};
// Anything that lets the shell do more than run one plain command.
const SHELL_META = /[;&|<>`$(){}\\'"\n\r!*?[\]#]/;

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

