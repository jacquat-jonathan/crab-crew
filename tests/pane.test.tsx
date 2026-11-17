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

test('a card shows the model, and opens the conversation in the pane when the main view refuses', async ($, on) => {
  on('agent.list', () => ({ value: [] }))
  on('clock.now', () => ({ value: 1000 }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'a1' }))
  on('ui.view', () => ({ value: { deny: 'the session draws no main view' } }))
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'Find every place the login token is refreshed.', toolUses: [] },
      {
        role: 'assistant',
        text: 'Found it in two files.',
        toolUses: [{ tool_use_id: 'u1', tool: 'Grep', input: { pattern: 'refreshToken' }, text: '2 matches' }],
      },
    ],
  }))

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
    expect((await ui.find({ type: 'Text', text: /claude-haiku-5-5/ }))?.text).toBe('◆ claude-haiku-5-5')
    expect(await ui.find({ type: 'Text', text: /login token is refreshed and list/ })).toBeFalsy()
    await ui.press({ key: 'open-a1' })
    expect((await ui.find({ type: 'Text', text: /Found it in two files/ }))?.text).toBe('Found it in two files.')
    expect(await ui.find({ type: 'Text', text: /2 matches/ })).toBeTruthy()
    await ui.press({ key: 'back' })
    expect(await ui.find({ type: 'Text', text: /Found it in two files/ })).toBeFalsy()
    await ui.unmount()
  }
})
