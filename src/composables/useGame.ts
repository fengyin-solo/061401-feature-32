import { ref, computed } from 'vue'
import type { GameState, LogEntry, RandomEvent, ActionType, ActionEffect, TurnRecord, StatsSnapshot, GameOverSummary, TurningPoint, FatalChain, ResourcePath } from '@/types/game'
import { randomEvents } from '@/data/events'

const STORAGE_KEY_HIGH_SCORE = 'survival_game_high_score'
const MAX_STAT = 100

const actionEffects: Record<ActionType, ActionEffect> = {
  gatherWood: {
    health: -5, hunger: 5, thirst: 3, wood: 10, stone: 0 },
  gatherStone: {
    health: -8, hunger: 6, thirst: 4, wood: 0, stone: 8 },
  hunt: {
    health: 15, hunger: -20, thirst: 5, wood: -5, stone: 0 },
  drink: {
    health: 0, hunger: 2, thirst: -25, wood: -3, stone: 0 },
}

const actionNames: Record<ActionType, string> = {
  gatherWood: '采集木头',
  gatherStone: '采集石头',
  hunt: '打猎',
  drink: '喝水',
}

function takeSnapshot(state: GameState): StatsSnapshot {
  return {
    health: state.health,
    hunger: state.hunger,
    thirst: state.thirst,
    wood: state.wood,
    stone: state.stone,
  }
}

export function useGame() {
  const state = ref<GameState>({
    health: 80,
    hunger: 30,
    thirst: 30,
    wood: 10,
    stone: 5,
    turn: 0,
    isGameOver: false,
    logs: [],
    turnHistory: [],
  })

  const highScore = ref<number>(0)
  let logIdCounter = 0

  const canAct = computed(() => !state.value.isGameOver)

  const gameOverSummary = computed<GameOverSummary>(() => {
    const history = state.value.turnHistory
    if (history.length === 0) {
      return { turningPoints: [], lastActions: [], fatalChains: [], resourcePath: [], deathCause: '' }
    }

    const turningPoints = computeTurningPoints(history)
    const lastActions = history.slice(-3)
    const fatalChains = computeFatalChains(history)
    const resourcePath = computeResourcePath(history)
    const deathCause = computeDeathCause(state.value)

    return { turningPoints, lastActions, fatalChains, resourcePath, deathCause }
  })

  function computeTurningPoints(history: TurnRecord[]): TurningPoint[] {
    const points: TurningPoint[] = []
    for (const record of history) {
      if (!record.event || record.event.type !== 'bad') continue
      const healthDelta = record.statsAfter.health - record.statsBefore.health
      const hungerDelta = record.statsAfter.hunger - record.statsBefore.hunger
      const thirstDelta = record.statsAfter.thirst - record.statsBefore.thirst
      const severity: TurningPoint['severity'] =
        healthDelta <= -20 || hungerDelta >= 20 || thirstDelta >= 20
          ? 'critical'
          : healthDelta <= -10 || hungerDelta >= 10 || thirstDelta >= 10
            ? 'major'
            : 'minor'
      const parts: string[] = [record.event.text]
      if (healthDelta !== 0) parts.push(`生命${healthDelta > 0 ? '+' : ''}${healthDelta}`)
      if (hungerDelta !== 0) parts.push(`饥饿${hungerDelta > 0 ? '+' : ''}${hungerDelta}`)
      if (thirstDelta !== 0) parts.push(`口渴${thirstDelta > 0 ? '+' : ''}${thirstDelta}`)
      points.push({ turn: record.turn, description: parts.join('，'), severity })
    }
    return points
  }

  function computeFatalChains(history: TurnRecord[]): FatalChain[] {
    const chains: FatalChain[] = []
    let currentEvents: string[] = []
    let currentStart = 0
    let currentHealthLoss = 0

    for (const record of history) {
      const isBad = record.event && record.event.type === 'bad'
      const healthLoss = record.statsBefore.health - record.statsAfter.health
      if (isBad && healthLoss > 0) {
        if (currentEvents.length === 0) currentStart = record.turn
        currentEvents.push(record.event!.text)
        currentHealthLoss += healthLoss
      } else {
        if (currentEvents.length >= 2) {
          chains.push({
            startTurn: currentStart,
            endTurn: record.turn - 1,
            events: [...currentEvents],
            totalHealthLoss: currentHealthLoss,
          })
        }
        currentEvents = []
        currentHealthLoss = 0
      }
    }
    if (currentEvents.length >= 2) {
      chains.push({
        startTurn: currentStart,
        endTurn: history[history.length - 1].turn,
        events: [...currentEvents],
        totalHealthLoss: currentHealthLoss,
      })
    }
    return chains
  }

  function computeResourcePath(history: TurnRecord[]): ResourcePath[] {
    return history.map((r) => ({
      turn: r.turn,
      action: r.actionName,
      health: r.statsAfter.health,
      hunger: r.statsAfter.hunger,
      thirst: r.statsAfter.thirst,
      wood: r.statsAfter.wood,
      stone: r.statsAfter.stone,
    }))
  }

  function computeDeathCause(s: GameState): string {
    const causes: string[] = []
    if (s.health <= 0) causes.push('生命值归零')
    if (s.hunger >= MAX_STAT) causes.push('饥饿值满格')
    if (s.thirst >= MAX_STAT) causes.push('口渴值满格')
    return causes.join(' + ') || '未知原因'
  }

  function loadHighScore() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HIGH_SCORE)
      if (saved) {
        highScore.value = parseInt(saved, 10) || 0
      }
    } catch (e) {
      highScore.value = 0
    }
  }

  function saveHighScore() {
    if (state.value.turn > highScore.value) {
      highScore.value = state.value.turn
      try {
        localStorage.setItem(STORAGE_KEY_HIGH_SCORE, String(highScore.value))
      } catch (e) {
        // ignore
      }
    }
  }

  function addLog(text: string, type: LogEntry['type'] = 'action') {
    state.value.logs.unshift({
      id: ++logIdCounter,
      text,
      type,
      turn: state.value.turn,
    })
    if (state.value.logs.length > 50) {
      state.value.logs.pop()
    }
  }

  function clampStat(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  function applyEffects(effects: ActionEffect) {
    if (effects.health !== undefined) {
      state.value.health = clampStat(state.value.health + effects.health, 0, MAX_STAT)
    }
    if (effects.hunger !== undefined) {
      state.value.hunger = clampStat(state.value.hunger + effects.hunger, 0, MAX_STAT)
    }
    if (effects.thirst !== undefined) {
      state.value.thirst = clampStat(state.value.thirst + effects.thirst, 0, MAX_STAT)
    }
    if (effects.wood !== undefined) {
      state.value.wood = Math.max(0, state.value.wood + effects.wood)
    }
    if (effects.stone !== undefined) {
      state.value.stone = Math.max(0, state.value.stone + effects.stone)
    }
  }

  function getRandomEvent(): RandomEvent {
    const index = Math.floor(Math.random() * randomEvents.length)
    return randomEvents[index]
  }

  function checkGameOver() {
    if (state.value.health <= 0 || state.value.hunger >= MAX_STAT || state.value.thirst >= MAX_STAT) {
      state.value.isGameOver = true
      saveHighScore()
      addLog('你没能在荒野中生存下来...', 'system')
    }
  }

  function canPerformAction(action: ActionType): boolean {
    if (state.value.isGameOver) return false
    const effects = actionEffects[action]
    if (effects.wood !== undefined && state.value.wood + effects.wood < 0) {
      return false
    }
    if (effects.stone !== undefined && state.value.stone + effects.stone < 0) {
      return false
    }
    return true
  }

  function performAction(action: ActionType) {
    if (!canPerformAction(action)) return

    const statsBefore = takeSnapshot(state.value)
    const effects = actionEffects[action]
    applyEffects(effects)
    state.value.turn++

    addLog(`第 ${state.value.turn} 回合：${actionNames[action]}`, 'action')

    const event = getRandomEvent()
    applyEffects(event.effects)

    const eventLogType = event.type === 'good' ? 'good' : event.type === 'bad' ? 'bad' : 'event'
    addLog(event.text, eventLogType)

    const statsAfter = takeSnapshot(state.value)

    state.value.turnHistory.push({
      turn: state.value.turn,
      action,
      actionName: actionNames[action],
      statsBefore,
      statsAfter,
      event: { ...event },
      actionEffects: { ...effects },
    })

    checkGameOver()
  }

  function gatherWood() {
    performAction('gatherWood')
  }

  function gatherStone() {
    performAction('gatherStone')
  }

  function hunt() {
    performAction('hunt')
  }

  function drink() {
    performAction('drink')
  }

  function restart() {
    state.value = {
      health: 80,
      hunger: 30,
      thirst: 30,
      wood: 10,
      stone: 5,
      turn: 0,
      isGameOver: false,
      logs: [],
      turnHistory: [],
    }
    logIdCounter = 0
    addLog('你醒来发现自己身处荒野中，需要想办法生存下去...', 'system')
  }

  loadHighScore()
  addLog('你醒来发现自己身处荒野中，需要想办法生存下去...', 'system')

  return {
    state,
    highScore,
    canAct,
    canPerformAction,
    gameOverSummary,
    gatherWood,
    gatherStone,
    hunt,
    drink,
    restart,
  }
}
