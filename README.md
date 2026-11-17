# 🦀 Crab Crew

A Claude Code mod that adds a **Crab Crew** pane on the right side of the screen, with one card for every subagent in your session.

Each card shows:

- a **pixel-art crab** generated from the agent's id. Shell color, hat, claws, eyes and legs vary, and the same agent always gets the same crab
- the agent's **name**, or a crab nickname such as "Barnacle McClaw" when it has none
- a **status badge** (● running, ✓ done, ✗ failed, ◌ idle, ■ stopped) and the agent type
- the **goal**: the short task description, then a 2-line preview of the prompt it was given

Click **▸ open** on a card to switch the main view to that subagent's full session. **← Main** at the top of the pane takes you back. If you close the pane, `/crabs` reopens it.

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

- Prompt previews are only captured for subagents started after the mod loads. Older ones still get a card.
- Statuses are checked every 2 seconds and whenever a subagent finishes a turn.

## License

MIT
