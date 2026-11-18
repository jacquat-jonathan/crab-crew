// Run with: node --test plugins/crew/hooks/reviewer-bash.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { check } from './check.mjs';
import { mkdtempSync, symlinkSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK = fileURLToPath(new URL('./reviewer-bash.mjs', import.meta.url));
const run = (stdin, hook = HOOK) => spawnSync(process.execPath, [hook], { input: stdin, encoding: 'utf8' });
const call = (agent_type, command) =>
  run(JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', agent_type, tool_input: { command } }));

test('allows single read-only git commands', () => {
  for (const cmd of [
    'git diff',
    'git -C /home/user/repo diff main...HEAD',
    'git --no-pager -C ../repo log --oneline -20',
    'git show HEAD~1 --stat',
    'git diff --cached -- src/app.ts',
    'git diff --output-indicator-new=+ HEAD^',
    'git status',
    'git merge-base origin/main HEAD',
    'git blame src/lib.rs',
    'git diff --text HEAD',
  ]) assert.equal(check(cmd), null, cmd);
});

test('refuses anything else', () => {
  for (const cmd of [
    '', 'cat file', 'rm -rf x', 'FOO=1 git diff',
    'git push', 'git checkout main', 'git commit -m x', 'git',
    'git diff; rm x', 'git diff && touch x', 'git diff | sh', 'git diff > out',
    'git diff $(touch x)', 'git diff `touch x`', 'git diff\ntouch x',
    'git -c core.pager=sh diff', 'git -c diff.external=x diff', '--git-dir=x',
    'git --git-dir=/tmp/x diff', 'git --work-tree=/ status', 'git --exec-path=/tmp log',
    'git diff --output=x', 'git log --output x', 'git diff --outp=x', 'git diff --ext-diff',
    'git diff --ext', 'git log -p --textconv', 'git -C',
  ]) assert.notEqual(check(cmd), null, JSON.stringify(cmd));
});

test('blocks the reviewer, plugin-scoped or not', () => {
  for (const agent of ['reviewer', 'crew:reviewer']) {
    const r = call(agent, 'git diff --output=/tmp/x');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--output/);
    assert.equal(call(agent, 'git diff main...HEAD').status, 0);
  }
});

test('leaves other callers alone', () => {
  assert.equal(call(undefined, 'rm -rf build').status, 0);
  assert.equal(call('crew:tests', 'npm test && echo ok').status, 0);
  // Known limit: without agent_type the caller can't be told apart from the main conversation.
  assert.equal(call(undefined, 'cat /etc/passwd').status, 0);
  assert.equal(run(JSON.stringify({ tool_name: 'Bash', agent_type: 'crew:reviewer', tool_input: {} })).status, 2);
});

test('fails closed on unreadable input', () => {
  assert.equal(run('not json').status, 2);
  assert.equal(run('').status, 2);
});

test('still enforces when run from a path with a space or through a symlink', () => {
  const dir = mkdtempSync(join(tmpdir(), 'crew hook '));
  const real = join(dir, 'real dir');
  mkdirSync(real);
  for (const f of ['reviewer-bash.mjs', 'check.mjs']) copyFileSync(new URL(`./${f}`, import.meta.url), join(real, f));
  symlinkSync(real, join(dir, 'link'));
  const stdin = JSON.stringify({ tool_name: 'Bash', agent_type: 'crew:reviewer', tool_input: { command: 'cat x' } });
  for (const hook of [join(real, 'reviewer-bash.mjs'), join(dir, 'link', 'reviewer-bash.mjs')]) {
    assert.equal(run(stdin, hook).status, 2, hook);
  }
});
