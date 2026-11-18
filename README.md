# 🦀 Crab Crew

A Claude Code mod that adds a **Crab Crew** pane on the right side of the screen, with one card for every subagent in your session.

Each card shows:

- a **pixel-art crab** generated from the agent's id. Shell color, hat, claws, eyes and legs vary, and the same agent always gets the same crab
- the agent's **name**, or a crab nickname such as "Barnacle McClaw" when it has none
- a **status badge** (● running, ✓ done, ✗ failed, ◌ idle, ■ stopped) and the agent type
- the **goal**: the short task description
- the **model** the subagent runs on (for example `◆ claude-haiku-5-5`)

Click **▸ open conversation** on a card to see that subagent's session. In the terminal, the main view switches to it (**← Main** takes you back). In the desktop app, where the main view can't be switched by a mod, the pane itself shows the conversation: the task, the replies and each tool call with its result, refreshed every 2 seconds while the subagent runs. **← All crabs** takes you back. If you close the pane, `/crabs` reopens it.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install crab-crew --marketplace jacquat-jonathan/crab-crew
```

Answer `y` to add the marketplace, then press Enter to pick the scope (user scope installs it for every session).

From a shell:

```bash
claude plugin install crab-crew --marketplace jacquat-jonathan/crab-crew
```

In the Claude desktop app: click **+** next to the prompt box, then **Plugins** → **Add marketplace** with `jacquat-jonathan/crab-crew`, then **Add plugin**.

## Notes

- The model is only recorded for subagents started after the mod loads. Older ones still get a card, marked "model unknown".
- Statuses are checked every 2 seconds and whenever a subagent finishes a turn.
- The pane needs a surface that draws plugin panes. A cloud session viewed from the desktop app attaches none, so there the pane can't be shown and `/crabs` says so. For cloud sessions use the Crab Crew page instead (below). The crew agents still work.

## Crab Crew page (cloud sessions)

`app/index.html` is a claude.ai artifact that shows the same crabs for your cloud sessions, wherever you view them. It reads your sessions through the Claude Code Remote connector (`list_sessions`, `list_events`), follows your most recently active session by default, and refreshes every 4 seconds. Open it beside the chat in the Claude app, or pin it to the sidebar. Republish it with Claude's Artifact tool, declaring the `mcp` capability for those two tools.

## Crew agents (second plugin)

This marketplace also ships `crew`, a set of subagents that work in any repository, in a terminal, the desktop app or a cloud session:

| Agent | Model | Does |
| --- | --- | --- |
| `crew:search` | Haiku | Maps a repo: where things are and how they connect. Read-only. |
| `crew:grep` | Haiku | Finds every definition, call site and string reference of a symbol. Read-only. |
| `crew:tests` | Haiku | Runs tests the way the repo documents them, and reports real failures apart from known environment-only ones. |
| `crew:reviewer` | Opus | Review gate: reads the real diff with git and replies `APPROVE` or `REJECT`. |

The agents hold no repo-specific commands. They read the target repo's `CLAUDE.md` (and the files it points to) for its layout, test commands and, in a cloud session (`CLAUDE_CODE_REMOTE=true`), its "Claude Code cloud sessions" section: setup such as `PATH` exports, steps to replace, and tests that fail only because of the environment. To teach them a new repo, document those in its `CLAUDE.md`.

`crew:reviewer` may run Bash only for single read-only git commands (`diff`, `log`, `show`, `status`, `rev-parse`, `merge-base`, `ls-files`, `blame`). The plugin's `PreToolUse` hook enforces this and blocks options that run programs or write files (`-c`, `--output`, `--ext-diff`, `--textconv`, `--git-dir`, ...). Other agents and the main conversation are not affected. Tests: `node --test plugins/crew/hooks/reviewer-bash.test.mjs`.

The hook is a guard rail, not a sandbox. It blocks the call when its input can't be read or it errors, but it does nothing when:

- `node` is not on `PATH` (the hook can't start, and only exit code 2 blocks a call);
- Claude Code sends no `agent_type`, since the reviewer then can't be told apart from the main conversation;
- the reviewed repo's own git config or attributes run programs (`diff.external`, textconv drivers, `core.fsmonitor`). Point the reviewer only at repos you trust.

Install it at user scope so every session gets it:

```
/plugin install crew@crab-crew
```

## License

MIT
