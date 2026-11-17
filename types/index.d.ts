export type CrabStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'idle'
  | 'completed'
  | 'failed'
  | 'killed'

export type CrabAgent = {
  id: string
  name?: string
  description: string
  type: string
  prompt: string
  status: CrabStatus
  startedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'crab-crew': { agents: Shaped<CrabAgent[]> }
  }
}
