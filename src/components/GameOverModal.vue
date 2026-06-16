<script setup lang="ts">
import { ref } from 'vue'
import type { GameOverSummary, TurnRecord, FatalChain, ResourcePath } from '@/types/game'

interface Props {
  show: boolean
  finalTurn: number
  highScore: number
  isNewRecord: boolean
  summary: GameOverSummary
}

defineProps<Props>()

const emit = defineEmits<{
  restart: []
}>()

const activeTab = ref<'turning' | 'lastAction' | 'chain' | 'resource'>('turning')

const severityColor = (s: string) => {
  if (s === 'critical') return 'text-red-400 bg-red-400/10 border-red-400/30'
  if (s === 'major') return 'text-orange-400 bg-orange-400/10 border-orange-400/30'
  return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
}

const severityLabel = (s: string) => {
  if (s === 'critical') return '危急'
  if (s === 'major') return '重大'
  return '轻微'
}

const deltaText = (before: number, after: number, invert = false) => {
  const diff = invert ? before - after : after - before
  if (diff === 0) return ''
  const sign = diff > 0 ? '+' : ''
  const cls = (invert ? diff > 0 : diff < 0) ? 'text-red-400' : 'text-green-400'
  return `<span class="${cls}">${sign}${diff}</span>`
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div class="relative bg-game-card rounded-3xl p-6 max-w-lg w-full border border-game-border shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
          <div class="text-center mb-4">
            <div class="text-5xl mb-2">💀</div>
            <h2 class="text-2xl font-bold text-white mb-1">游戏结束</h2>
            <p class="text-gray-400 text-sm mb-3">你没能在荒野中生存下来...</p>

            <div class="bg-gray-800/50 rounded-2xl p-4 mb-4 space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-gray-400">生存回合</span>
                <span class="text-2xl font-bold text-white">{{ finalTurn }}</span>
              </div>
              <div class="border-t border-gray-700"></div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">最高纪录</span>
                <span class="text-xl font-bold" :class="isNewRecord ? 'text-yellow-400' : 'text-gray-300'">
                  {{ highScore }}
                  <span v-if="isNewRecord" class="text-sm ml-1">🏆 新纪录！</span>
                </span>
              </div>
              <div class="border-t border-gray-700"></div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">死亡原因</span>
                <span class="text-red-400 font-semibold">{{ summary.deathCause }}</span>
              </div>
            </div>
          </div>

          <div class="flex gap-1 mb-4 bg-gray-800/50 rounded-xl p-1">
            <button
              v-for="tab in ([
                { key: 'turning', label: '转折' },
                { key: 'lastAction', label: '最后操作' },
                { key: 'chain', label: '致命连锁' },
                { key: 'resource', label: '资源路径' },
              ] as const)"
              :key="tab.key"
              @click="activeTab = tab.key"
              class="flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-all duration-200"
              :class="activeTab === tab.key
                ? 'bg-gray-700 text-white shadow'
                : 'text-gray-400 hover:text-gray-200'"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="min-h-[180px]">
            <div v-if="activeTab === 'turning'">
              <div v-if="summary.turningPoints.length === 0" class="text-center text-gray-500 py-8">
                本局没有重大转折事件
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="tp in summary.turningPoints"
                  :key="tp.turn"
                  class="rounded-xl border p-3 text-sm"
                  :class="severityColor(tp.severity)"
                >
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-medium">第 {{ tp.turn }} 回合</span>
                    <span class="text-xs px-2 py-0.5 rounded-full border" :class="severityColor(tp.severity)">
                      {{ severityLabel(tp.severity) }}
                    </span>
                  </div>
                  <p class="opacity-80">{{ tp.description }}</p>
                </div>
              </div>
            </div>

            <div v-if="activeTab === 'lastAction'">
              <div v-if="summary.lastActions.length === 0" class="text-center text-gray-500 py-8">
                没有操作记录
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="(rec, idx) in summary.lastActions"
                  :key="rec.turn"
                  class="bg-gray-800/50 rounded-xl p-3 text-sm"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-white font-medium">第 {{ rec.turn }} 回合 · {{ rec.actionName }}</span>
                    <span v-if="idx === summary.lastActions.length - 1" class="text-red-400 text-xs">← 致命操作</span>
                  </div>
                  <div class="grid grid-cols-5 gap-2 text-center text-xs">
                    <div>
                      <div class="text-gray-500">生命</div>
                      <div class="text-white">{{ rec.statsAfter.health }}</div>
                      <div v-html="deltaText(rec.statsBefore.health, rec.statsAfter.health)"></div>
                    </div>
                    <div>
                      <div class="text-gray-500">饥饿</div>
                      <div class="text-white">{{ rec.statsAfter.hunger }}</div>
                      <div v-html="deltaText(rec.statsBefore.hunger, rec.statsAfter.hunger, true)"></div>
                    </div>
                    <div>
                      <div class="text-gray-500">口渴</div>
                      <div class="text-white">{{ rec.statsAfter.thirst }}</div>
                      <div v-html="deltaText(rec.statsBefore.thirst, rec.statsAfter.thirst, true)"></div>
                    </div>
                    <div>
                      <div class="text-gray-500">木头</div>
                      <div class="text-white">{{ rec.statsAfter.wood }}</div>
                      <div v-html="deltaText(rec.statsBefore.wood, rec.statsAfter.wood)"></div>
                    </div>
                    <div>
                      <div class="text-gray-500">石头</div>
                      <div class="text-white">{{ rec.statsAfter.stone }}</div>
                      <div v-html="deltaText(rec.statsBefore.stone, rec.statsAfter.stone)"></div>
                    </div>
                  </div>
                  <div v-if="rec.event" class="mt-2 pt-2 border-t border-gray-700">
                    <span
                      class="text-xs px-2 py-0.5 rounded-full"
                      :class="rec.event.type === 'good' ? 'bg-green-400/10 text-green-400' : rec.event.type === 'bad' ? 'bg-red-400/10 text-red-400' : 'bg-gray-400/10 text-gray-400'"
                    >
                      {{ rec.event.type === 'good' ? '好运' : rec.event.type === 'bad' ? '厄运' : '中性' }}
                    </span>
                    <span class="text-gray-400 text-xs ml-2">{{ rec.event.text }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="activeTab === 'chain'">
              <div v-if="summary.fatalChains.length === 0" class="text-center text-gray-500 py-8">
                本局没有形成致命连锁
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="chain in summary.fatalChains"
                  :key="chain.startTurn"
                  class="bg-red-400/5 border border-red-400/20 rounded-xl p-3"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-red-400 font-medium text-sm">
                      第 {{ chain.startTurn }}–{{ chain.endTurn }} 回合 连锁
                    </span>
                    <span class="text-red-400 text-sm font-bold">
                      -{{ chain.totalHealthLoss }} ❤️
                    </span>
                  </div>
                  <div class="space-y-1">
                    <div
                      v-for="(evt, i) in chain.events"
                      :key="i"
                      class="flex items-start gap-2 text-xs text-gray-300"
                    >
                      <span class="text-red-400 mt-0.5">⚡</span>
                      <span>{{ evt }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="activeTab === 'resource'">
              <div v-if="summary.resourcePath.length === 0" class="text-center text-gray-500 py-8">
                没有资源变化记录
              </div>
              <div v-else class="space-y-1">
                <div class="grid grid-cols-6 gap-1 text-xs text-gray-500 px-2 pb-1 border-b border-gray-700">
                  <span>回合</span>
                  <span>操作</span>
                  <span class="text-center">❤️</span>
                  <span class="text-center">🍗</span>
                  <span class="text-center">💧</span>
                  <span class="text-center">🪵</span>
                </div>
                <div
                  v-for="rp in summary.resourcePath"
                  :key="rp.turn"
                  class="grid grid-cols-6 gap-1 text-xs px-2 py-1.5 rounded hover:bg-gray-800/50"
                >
                  <span class="text-gray-400">{{ rp.turn }}</span>
                  <span class="text-gray-300 truncate">{{ rp.action }}</span>
                  <span class="text-center" :class="rp.health <= 20 ? 'text-red-400 font-bold' : rp.health <= 50 ? 'text-yellow-400' : 'text-green-400'">
                    {{ rp.health }}
                  </span>
                  <span class="text-center" :class="rp.hunger >= 80 ? 'text-red-400 font-bold' : rp.hunger >= 50 ? 'text-yellow-400' : 'text-green-400'">
                    {{ rp.hunger }}
                  </span>
                  <span class="text-center" :class="rp.thirst >= 80 ? 'text-red-400 font-bold' : rp.thirst >= 50 ? 'text-yellow-400' : 'text-green-400'">
                    {{ rp.thirst }}
                  </span>
                  <span class="text-center text-gray-300">{{ rp.wood }}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            @click="emit('restart')"
            class="w-full py-4 px-6 mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-lg rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-green-500/25"
          >
            🔄 重新开始
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.9);
}
</style>
