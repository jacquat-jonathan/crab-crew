import { atom, read, update } from 'claude-code'
import type { AgentInfo, EngineInterface, Register } from 'claude-code'

import type { CrabAgent, CrabStatus } from '../types'

const PANE = 'crab-crew'
const TITLE = 'Crab Crew'

// Bump the tag when CrabAgent's fields change: it declines what an earlier
// version stored, which outlives a reload.
const agents = atom({ plugin: 'crab-crew', key: 'agents' } as const, [], {
  shape: 'agents-2',
})
// The agent whose conversation the pane shows inline, when the main view
// can't switch to it (the desktop app hosts the session without one).
const opened = atom({ plugin: 'crab-crew', key: 'opened' } as const, null)
// Bumped while the opened agent runs, so its conversation redraws.
const tick = atom({ plugin: 'crab-crew', key: 'tick' } as const, 0)

// ---------- the crab generator: one id, always the same crab ----------

const hash = (text: string, salt: number): number => {
  let h = 0x811c9dc5 ^ salt
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }

  return h >>> 0
}

const pick = <T,>(list: readonly T[], id: string, salt: number): T =>
  list[hash(id, salt) % list.length] as T

const SHELLS = [
  '#E8553E',
  '#F28C28',
  '#E5B820',
  '#4CAF50',
  '#2BB3C0',
  '#3D7DDB',
  '#8E5BD6',
  '#E05EA6',
  '#B5713A',
] as const
// Hats sit between the claws: 5 cells, with their own color.
const HATS = [
  { art: '     ', color: '' },
  { art: ' ▄█▄ ', color: '#3a3a3a' },
  { art: ' ▴▴▴ ', color: '#F5C518' },
  { art: ' ▄▀▄ ', color: '#D33F49' },
  { art: '  ¡  ', color: '#9AA0A6' },
  { art: ' ▁▂▁ ', color: '#5B8DEF' },
] as const
const CLAWS = ['▙▟', '▛▜', '▚▞', '▟▙'] as const
const EYES = ['o', '•', '°', '^', '@', '*'] as const
const LEGS = ['╱╱   ╲╲', '▞▞   ▚▚', '┘┘   └└', '╯╯   ╰╰'] as const

const FIRST = [
  'Pinchy',
  'Clawdia',
  'Sheldon',
  'Snappy',
  'Crabigail',
  'Scuttle',
  'Hermie',
  'Coral',
  'Barnacle',
  'Sandy',
  'Tidepool',
  'Bubbles',
  'Krabby',
  'Shelly',
] as const
const LAST = ['', ' the Bold', ' McClaw', ' Jr.', ' of the Reef', ' Esq.', ' Sidestep'] as const

type Crab = {
  shell: string
  hat: (typeof HATS)[number]
  claw: string
  eye: string
  legs: string
  nickname: string
}

const crabFor = (id: string): Crab => ({
  shell: pick(SHELLS, id, 1),
  hat: pick(HATS, id, 2),
  claw: pick(CLAWS, id, 3),
  eye: pick(EYES, id, 4),
  legs: pick(LEGS, id, 5),
  nickname: pick(FIRST, id, 6) + pick(LAST, id, 7),
})

// ---------- statuses ----------

const BADGE: Record<CrabStatus, { label: string; color: string }> = {
  pending: { label: '◌ starting', color: 'yellow' },
  running: { label: '● running', color: 'green' },
  waiting: { label: '◐ waiting', color: 'yellow' },
  idle: { label: '◌ idle', color: 'gray' },
  completed: { label: '✓ done', color: 'cyan' },
  failed: { label: '✗ failed', color: 'red' },
  killed: { label: '■ stopped', color: 'gray' },
}

const isLive = (status: CrabStatus): boolean =>
  status === 'pending' || status === 'running' || status === 'waiting'

// ---------- keeping the list in step with the engine ----------

const fromInfo = (info: AgentInfo, at: number): CrabAgent => ({
  id: info.id,
  name: info.name,
  description: info.description,
  type: info.type,
  prompt: '',
  status: info.status,
  startedAt: at,
})

const sync = async ($: EngineInterface): Promise<void> => {
  const listed = await $.agent.list()
  const now = await $.clock.now()
  await update($, agents, list => {
    let isChanged = false
    const byId = new Map(listed.map(info => [info.id, info]))
    const next = list.map(agent => {
      const info = byId.get(agent.id)
      if (!info) return agent
      byId.delete(agent.id)
      if (info.status === agent.status && info.name === agent.name) return agent
      isChanged = true

      return { ...agent, status: info.status, name: info.name ?? agent.name }
    })
    for (const info of byId.values()) {
      isChanged = true
      next.push(fromInfo(info, now))
    }

    return isChanged ? next.slice(-100) : list
  })
  const shown = await read($, opened)
  if (shown !== null) {
    const info = listed.find(one => one.id === shown)
    if (info && isLive(info.status)) await update($, tick, n => n + 1)
  }
}

const short = (text: string, length: number): string => {
  const flat = text.replace(/\s+/g, ' ').trim()

  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat
}

const toolLabel = (input: Record<string, unknown>): string => {
  for (const value of Object.values(input)) {
    if (typeof value === 'string' && value.trim() !== '') return short(value, 60)
  }

  return ''
}

// ---------- the hooks ----------

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'crabs',
      description: 'Open the Crab Crew pane: every subagent as a crab card',
    })
    void $.ui.open({ id: PANE, title: TITLE })
    await sync($)
    // Statuses change inside the subagents' own loops; check them every 2s.
    $.clock.every(2000, () => {
      void sync($)
    })

    return started
  })

  on('command.run', { command: 'crabs' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    if (opened.isPlaced) return { text: 'Crab Crew pane opened.' }

    // Say why instead of claiming success: e.g. a cloud session viewed from the desktop app
    // attaches no surface that draws a plugin's panes.
    return { text: `Crab Crew pane can't be shown here: ${opened.reason}` }
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    const id = spawned.agentId
    if (id !== undefined) {
      const now = await $.clock.now()
      const agent: CrabAgent = {
        id,
        name: e.name,
        description: e.description,
        type: e.subagentType,
        prompt: e.prompt,
        model: spawned.model,
        status: 'running',
        startedAt: now,
      }
      await update($, agents, list => {
        const known = list.find(one => one.id === id)
        if (known) {
          return list.map(one =>
            one.id === id
              ? { ...one, prompt: one.prompt || e.prompt, model: spawned.model, status: 'running' as const }
              : one,
          )
        }

        return [...list, agent].slice(-100)
      })
    }

    return spawned
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) await sync($)

    return done
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, agents)
    const shownId = await read($, opened)
    const viewed = e.props.view.agentId
    const textWidth = Math.max(12, e.props.bodyColumns - 16)

    const crabArt = (crab: Crab) => (
      <Box flexDirection="column" width={11} flexShrink={0}>
        <Text mono>
          {' '}
          <Text color={crab.shell}>{crab.claw}</Text>
          <Text color={crab.hat.color || undefined}>{crab.hat.art}</Text>
          <Text color={crab.shell}>{crab.claw}</Text>{' '}
        </Text>
        <Text mono color={crab.shell}>
          {' ▀▄█'}
          <Text color="white" backgroundColor={crab.shell} bold>
            {crab.eye}
          </Text>
          {'█'}
          <Text color="white" backgroundColor={crab.shell} bold>
            {crab.eye}
          </Text>
          {'█▄▀ '}
        </Text>
        <Text mono color={crab.shell}>
          {'  ▐█████▌  '}
        </Text>
        <Text mono color={crab.shell} dimColor>
          {`  ${crab.legs}  `}
        </Text>
      </Box>
    )

    const headline = (agent: CrabAgent, crab: Crab) => {
      const badge = BADGE[agent.status] ?? BADGE.running

      return (
        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
          <Text bold color={crab.shell}>
            {agent.name ?? crab.nickname}
          </Text>
          <Text>
            <Text color={badge.color}>{badge.label}</Text>
            <Text dimColor>{` · ${agent.type}`}</Text>
          </Text>
          <Text bold wrap="truncate-end">
            {agent.description || 'Untitled task'}
          </Text>
          <Text dimColor wrap="truncate-end">
            {`◆ ${agent.model ?? 'model unknown'}`}
          </Text>
        </Box>
      )
    }

    // ----- one agent's conversation, drawn inside the pane -----
    const agent = shownId === null ? undefined : list.find(one => one.id === shownId)
    if (agent !== undefined) {
      await read($, tick)
      const crab = crabFor(agent.id)
      const found = await $.session.messages({ agentId: agent.id })
      const messages = 'deny' in found ? [] : found.slice(-40)
      const room = Math.max(40, (e.props.bodyColumns - 4) * 6)

      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row">
            <Button key="back" variant="primary" onPress={() => void update($, opened, () => null)}>
              ← All crabs
            </Button>
          </Box>
          <Box flexDirection="row" gap={1} paddingX={1} borderStyle="double" borderColor={crab.shell}>
            {crabArt(crab)}
            {headline(agent, crab)}
          </Box>
          {'deny' in found && (
            <Text dimColor wrap="wrap">
              {`Can't read this crab's conversation: ${found.deny}`}
            </Text>
          )}
          {messages.length === 0 && !('deny' in found) && <Text dimColor>No messages yet.</Text>}
          {messages.map((message, index) => (
            <Box key={`m-${index}`} flexDirection="column">
              {message.text.trim() !== '' && (
                <Box flexDirection="column">
                  <Text bold color={message.role === 'assistant' ? crab.shell : 'gray'}>
                    {message.role === 'assistant' ? `🦀 ${agent.name ?? crab.nickname}` : index === 0 ? '▸ Task' : '▸ Input'}
                  </Text>
                  <Text wrap="wrap">{short(message.text, room)}</Text>
                </Box>
              )}
              {message.toolUses.map(use => (
                <Box key={use.tool_use_id} flexDirection="column">
                  <Text wrap="truncate-end">
                    <Text color={use.isError ? 'red' : 'yellow'}>{'⚙ '}</Text>
                    <Text bold>{use.tool}</Text>
                    <Text dimColor>{` ${toolLabel(use.input)}`}</Text>
                  </Text>
                  {use.text !== undefined && use.text.trim() !== '' && (
                    <Text dimColor wrap="wrap">
                      {`  ⎿ ${short(use.text, Math.max(40, textWidth * 2))}`}
                    </Text>
                  )}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      )
    }

    // ----- the crew: one card per agent -----
    const sorted = [...list].sort((a, b) => b.startedAt - a.startedAt)
    const live = list.filter(one => isLive(one.status)).length

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor>
            {list.length === 0
              ? 'No subagents yet'
              : `${list.length} crab${list.length === 1 ? '' : 's'} · ${live} at work`}
          </Text>
          {viewed !== undefined && (
            <Button key="main" variant="primary" onPress={() => void $.ui.view({})}>
              ← Main
            </Button>
          )}
        </Box>
        {list.length === 0 && (
          <Text dimColor wrap="wrap">
            When Claude starts a subagent, its crab shows up here. Click one to open its session.
          </Text>
        )}
        {sorted.map(one => {
          const crab = crabFor(one.id)
          const isViewed = one.id === viewed
          const open = async () => {
            if (isViewed) {
              await $.ui.view({})
              return
            }
            // Switch the main view where the surface has one; otherwise show
            // the conversation right here in the pane.
            const shown = await $.ui.view({ agentId: one.id })
            if (shown.deny !== undefined) {
              $.ui.log(`crab-crew: main view refused (${shown.deny}); opening inline`, { to: 'debug' })
              await update($, opened, () => one.id)
            }
          }

          return (
            <Box
              key={`card-${one.id}`}
              flexDirection="column"
              paddingX={1}
              borderStyle={isViewed ? 'double' : 'round'}
              borderColor={isViewed ? crab.shell : 'gray'}
              hover={{ borderColor: crab.shell }}
            >
              <Box flexDirection="row" gap={1}>
                {crabArt(crab)}
                {headline(one, crab)}
              </Box>
              <Button key={`open-${one.id}`} plain dimColor onPress={() => void open()}>
                {isViewed ? '◂ back to main' : '▸ open conversation'}
              </Button>
            </Box>
          )
        })}
      </Box>
    )
  })
}
