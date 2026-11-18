// PreToolUse guard for the reviewer agent: only single read-only git commands.
// Every other agent (and the main session) passes through untouched.
import { readFileSync } from 'node:fs'

const ALLOWED = ['diff', 'log', 'show', 'status', 'rev-parse', 'merge-base', 'ls-files', 'blame']

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const agent = String(input.agent_type ?? '')
if (agent !== 'reviewer' && !agent.endsWith(':reviewer')) process.exit(0)

const command = String(input.tool_input?.command ?? '').trim()

function verdict() {
  // One command only: no chaining, pipes, redirects, substitution or newlines.
  if (/[;&|<>`$\n\r\\]/.test(command)) return 'only a single git command is allowed (no ; & | < > ` $ or newlines)'
  const words = command.split(/\s+/)
  if (words[0] !== 'git') return 'only git commands are allowed'
  let i = 1
  // Allow `git -C <path>` before the subcommand, nothing else.
  while (words[i] === '-C') i += 2
  if (!words[i]) return 'missing git subcommand'
  const sub = words[i]
  if (!ALLOWED.includes(sub)) return `git ${sub} is not allowed; use one of: ${ALLOWED.join(', ')}`
  // Options that write files or run external programs.
  if (words.slice(i + 1).some(w => /^--(output|ext-diff|textconv)(=|$)/.test(w) || w === '-o'))
    return 'options that write files or run external tools are not allowed'
  return null
}

const reason = verdict()
if (reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `reviewer: ${reason}`,
    },
  }))
}
process.exit(0)
