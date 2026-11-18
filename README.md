# 🦀 Crab Crew

A Claude Code plugin marketplace with two plugins:

| Plugin | What it is |
|---|---|
| [`crab-crew`](plugins/crab-crew) | A pane showing each subagent as a pixel-crab card |
| [`crab-agents`](plugins/crab-agents) | An agent team: `search`, `grep`, `tests` and a `reviewer` gate |

## crab-crew

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
/plugin marketplace add jacquat-jonathan/crab-crew
/plugin install crab-crew@crab-crew
```

When asked, pick the scope (user scope installs it for every session).

From a shell:

```bash
claude plugin marketplace add jacquat-jonathan/crab-crew
claude plugin install crab-crew@crab-crew
```

In the Claude desktop app: click **+** next to the prompt box, then **Plugins** → **Add marketplace** with `jacquat-jonathan/crab-crew`, then **Add plugin**.

## crab-agents

Four subagents, available as `crab-agents:<name>`:

| Agent | Model | Job |
|---|---|---|
| `search` | Haiku | Maps a repository: where things are and how they connect. Read-only. |
| `grep` | Haiku | Finds every definition, call site and string reference of a symbol. Read-only. |
| `tests` | Haiku | Runs the tests the way the repo documents (including its cloud-session notes) and reports. Fixes nothing. |
| `reviewer` | Opus | Gate review of a plan or the real diff. Replies `APPROVE` or `REJECT`. |

The plugin ships a `PreToolUse` hook that limits the `reviewer` agent's Bash to single read-only git commands (`diff`, `log`, `show`, `status`, `rev-parse`, `merge-base`, `ls-files`, `blame`). It needs `node` on the machine and leaves every other agent alone.

```bash
claude plugin install crab-agents@crab-crew
```

## Using the plugins in cloud sessions

Cloud sessions don't see your local `~/.claude`. To get the plugins there, commit this to `.claude/settings.json` in each repository you open in the cloud:

```json
{
  "extraKnownMarketplaces": {
    "crab-crew": {
      "source": { "source": "github", "repo": "jacquat-jonathan/crab-crew" }
    }
  },
  "enabledPlugins": {
    "crab-agents@crab-crew": true,
    "crab-crew@crab-crew": true
  }
}
```

## Notes

- The model is only recorded for subagents started after the mod loads. Older ones still get a card, marked "model unknown".
- Statuses are checked every 2 seconds and whenever a subagent finishes a turn.

## License

MIT
