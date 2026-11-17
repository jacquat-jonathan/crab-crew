import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'crab-crew',
  component: 'Pane',
  requestId: 'crab-crew',
  props: {
    title: 'Crab Crew',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('an empty crew says so', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /No subagents yet/ }))?.text).toBe('No subagents yet')
    await ui.unmount()
  }
})

test('a spawned subagent gets a card with its goal and an open button', async ($, on) => {
  on('agent.list', () => ({ value: [] }))
  on('clock.now', () => ({ value: 1000 }))
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  on('ui.view', () => ({ value: {} }))

  await $.agent.spawn({
    prompt: 'Find every place the login token is refreshed and list the files.',
    description: 'Search auth code',
    subagentType: 'Explore',
    name: 'scout',
    tool_use_id: 't1',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'opus',
    background: true,
    fork: false,
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Search auth code/ }))?.text).toBe('Search auth code')
    expect((await ui.find({ type: 'Text', text: /login token/ }))?.text).toMatch(/^Find every place/)
    expect((await ui.find({ type: 'Text', text: /running/ }))).toBeTruthy()
    await ui.press({ key: 'open-a1' })
    await ui.unmount()
  }
})
