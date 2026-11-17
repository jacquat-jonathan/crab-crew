import { atom, read, update } from 'claude-code'
import type { AgentInfo, EngineInterface, Register } from 'claude-code'

import type { CrabAgent, CrabStatus } from '../types'

const PANE = 'crab-crew'
const TITLE = 'Crab Crew'

// Bump the tag when CrabAgent's fields change: it declines what an earlier
// version stored, which outlives a reload.
const agents = atom({ plugin: 'crab-crew', key: 'agents' } as const, [], {
  shape: 'agents-1',
})

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
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Crab Crew pane opened.' }
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
        status: 'running',
        startedAt: now,
      }
      await update($, agents, list => {
        const known = list.find(one => one.id === id)
        if (known) {
          return list.map(one =>
            one.id === id ? { ...one, prompt: one.prompt || e.prompt, status: 'running' as const } : one,
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
    const viewed = e.props.view.agentId
    const sorted = [...list].sort((a, b) => b.startedAt - a.startedAt)
    const live = list.filter(agent => isLive(agent.status)).length
    // Card inner width: frame 2, padding 2, crab 11, gap 1.
    const textWidth = Math.max(12, e.props.bodyColumns - 16)
    const previewLength = textWidth * 2 - 1

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor>
            {list.length === 0
              ? 'No subagents yet'
              : `${list.length} crab${list.length === 1 ? '' : 's'} · ${live} at work`}
          </Text>
          {viewed !== undefined && (
            <Button key="back" variant="primary" onPress={() => void $.ui.view({})}>
              ← Main
            </Button>
          )}
        </Box>
        {list.length === 0 && (
          <Text dimColor wrap="wrap">
            When Claude starts a subagent, its crab shows up here. Click one to open its session.
          </Text>
        )}
        {sorted.map(agent => {
          const crab = crabFor(agent.id)
          const badge = BADGE[agent.status] ?? BADGE.running
          const isViewed = agent.id === viewed
          const preview = agent.prompt.replace(/\s+/g, ' ').trim()
          const shown =
            preview.length > previewLength ? `${preview.slice(0, previewLength - 1)}…` : preview
          const title = agent.name ?? crab.nickname

          return (
            <Box
              key={`card-${agent.id}`}
              flexDirection="row"
              gap={1}
              paddingX={1}
              borderStyle={isViewed ? 'double' : 'round'}
              borderColor={isViewed ? crab.shell : 'gray'}
              hover={{ borderColor: crab.shell }}
            >
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
              <Box flexDirection="column" flexGrow={1} flexShrink={1}>
                <Button
                  key={`open-${agent.id}`}
                  plain
                  onPress={() => void $.ui.view(isViewed ? {} : { agentId: agent.id })}
                >
                  <Text bold color={crab.shell}>
                    {title}
                  </Text>
                  <Text dimColor>{isViewed ? '  ◂ back' : '  ▸ open'}</Text>
                </Button>
                <Text>
                  <Text color={badge.color}>{badge.label}</Text>
                  <Text dimColor>{` · ${agent.type}`}</Text>
                </Text>
                <Text bold wrap="truncate-end">
                  {agent.description || 'Untitled task'}
                </Text>
                {shown !== '' && (
                  <Text dimColor wrap="wrap">
                    {shown}
                  </Text>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    )
  })
}
