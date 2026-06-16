export interface GameState {
  health: number
  hunger: number
  thirst: number
  wood: number
  stone: number
  turn: number
  isGameOver: boolean
  logs: LogEntry[]
  turnHistory: TurnRecord[]
}

export interface TurnRecord {
  turn: number
  action: ActionType
  actionName: string
  statsBefore: StatsSnapshot
  statsAfter: StatsSnapshot
  event: RandomEvent | null
  actionEffects: ActionEffect
}

export interface StatsSnapshot {
  health: number
  hunger: number
  thirst: number
  wood: number
  stone: number
}

export interface TurningPoint {
  turn: number
  description: string
  severity: 'critical' | 'major' | 'minor'
}

export interface FatalChain {
  startTurn: number
  endTurn: number
  events: string[]
  totalHealthLoss: number
}

export interface ResourcePath {
  turn: number
  action: string
  health: number
  hunger: number
  thirst: number
  wood: number
  stone: number
}

export interface GameOverSummary {
  turningPoints: TurningPoint[]
  lastActions: TurnRecord[]
  fatalChains: FatalChain[]
  resourcePath: ResourcePath[]
  deathCause: string
}

export interface LogEntry {
  id: number
  text: string
  type: 'action' | 'event' | 'system' | 'good' | 'bad'
  turn: number
}

export interface RandomEvent {
  id: string
  text: string
  type: 'good' | 'bad' | 'neutral'
  effects: {
    health?: number
    hunger?: number
    thirst?: number
    wood?: number
    stone?: number
  }
}

export type ActionType = 'gatherWood' | 'gatherStone' | 'hunt' | 'drink'

export interface ActionEffect {
  health?: number
  hunger?: number
  thirst?: number
  wood?: number
  stone?: number
}
