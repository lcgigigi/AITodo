<script setup lang="ts">
import type { Component } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts/core'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconSearch from '~icons/lucide/search'
import IconShieldCheck from '~icons/lucide/shield-check'
import IconTrendingDown from '~icons/lucide/trending-down'
import IconTrendingUp from '~icons/lucide/trending-up'
import IconX from '~icons/lucide/x'
import agentBgUrl from '@/assets/agentbg.png'
import DashboardTopBar from '@/modules/home/dashboard/DashboardTopBar.vue'
import SimpleTodoListPanel from '@/modules/home/dashboard/components/SimpleTodoListPanel.vue'
import {
  dashboardTools,
  type DashboardTool,
  type DashboardToolId,
} from '@/modules/home/dashboard/config/dashboardTools'
import {
  loadCurrentUserTokenUsage,
  resolveTokenUsageDateRange,
  type CurrentUserTokenUsage,
  type TokenUsagePeriodCode,
} from '@/modules/token-usage/token-usage.service'
import { formatTokenCompact, formatTokenNumber } from '@/modules/token-usage/token-usage.formatters'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { useECharts } from '@/shared/composables/useECharts'
import { openUrlInNewTab } from './links'
import { agents, getAgentByKey, permissionLabels } from './mock'
import type { AgentCatalogItem, AgentCategory } from './types'

defineOptions({
  name: 'AgentCenterPage',
})

type AgentVisual = {
  icon?: Component
  iconSrc?: string
  iconText?: string
  tone: string
}

type TokenRangeTab = {
  label: string
  periodCode: TokenUsagePeriodCode
}

type TokenModuleUsage = {
  moduleCode: string
  moduleName: string
  tokenUsage: number
}

type TokenTrendPoint = {
  date: string
  label: string
  value: number
}

const route = useRoute()
const router = useRouter()

const activeCategory = ref<AgentCategory | '全部'>('全部')
const agentSearchQuery = ref('')
const selectedAgent = ref<AgentCatalogItem | null>(null)
const actionToast = ref('')
const currentUserTokenUsage = ref<CurrentUserTokenUsage | null>(null)
const isTokenUsageLoading = ref(true)
const tokenUsageError = ref('')
const selectedTokenPeriodCode = ref<TokenUsagePeriodCode>('last7Days')

const tokenPeriodOptions: TokenRangeTab[] = [
  { label: '今日', periodCode: 'today' },
  { label: '近7天', periodCode: 'last7Days' },
  { label: '近30天', periodCode: 'last30Days' },
]

const usageTrendChartRef = ref<HTMLElement | null>(null)

const { getChart, resizeCharts, disposeCharts } = useECharts()
let chartResizeObserver: ResizeObserver | null = null

const chartTextStyle = {
  color: '#71819c',
  fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  fontWeight: 500,
}

function formatTrendDateLabel(date: string) {
  const [, month, day] = date.split('-')
  return month && day ? `${month}-${day}` : date
}

const tokenTrendTimeline = computed<TokenTrendPoint[]>(() => {
  const usage = currentUserTokenUsage.value
  if (!usage) return []

  const dailyTotalMap = new Map<string, number>()

  for (const module of usage.trendList) {
    for (const point of module.dailyList) {
      dailyTotalMap.set(
        point.usageDate,
        (dailyTotalMap.get(point.usageDate) ?? 0) + point.tokenUsage,
      )
    }
  }

  return [...dailyTotalMap.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([date, value]) => ({
      date,
      label: formatTrendDateLabel(date),
      value,
    }))
})

const selectedTokenModuleUsages = computed<TokenModuleUsage[]>(() => {
  const usage = currentUserTokenUsage.value
  if (!usage) return []

  return usage.trendList.map((module) => ({
    moduleCode: module.moduleCode,
    moduleName: module.moduleName,
    tokenUsage: module.totalTokenUsage,
  }))
})

const tokenTotalConsumption = computed(() =>
  selectedTokenModuleUsages.value.reduce((sum, module) => sum + module.tokenUsage, 0),
)

const tokenTodayConsumption = computed(() => {
  const timeline = tokenTrendTimeline.value
  if (!timeline.length) return 0
  return timeline[timeline.length - 1]?.value ?? 0
})

const tokenYesterdayConsumption = computed(() => {
  const timeline = tokenTrendTimeline.value
  if (timeline.length < 2) return 0
  return timeline[timeline.length - 2]?.value ?? 0
})

const tokenDayChangePercent = computed(() => {
  const today = tokenTodayConsumption.value
  const yesterday = tokenYesterdayConsumption.value
  if (yesterday === 0) return today > 0 ? 100 : 0
  return ((today - yesterday) / yesterday) * 100
})

const tokenDayChangeIsDown = computed(() => tokenDayChangePercent.value < 0)

const tokenDayChangeLabel = computed(() => Math.abs(tokenDayChangePercent.value).toFixed(1))

const hasTokenUsageContent = computed(() => {
  const usage = currentUserTokenUsage.value
  return Boolean(usage && usage.trendList.length > 0)
})

const tokenUsageStateType = computed<'loading' | 'empty' | 'error' | null>(() => {
  if (isTokenUsageLoading.value && !hasTokenUsageContent.value) return 'loading'
  if (tokenUsageError.value) return 'error'
  if (!hasTokenUsageContent.value) return 'empty'
  return null
})

const tokenUsageStateTitle = computed(() => {
  if (tokenUsageStateType.value === 'loading') return '正在加载 Token 使用数据'
  if (tokenUsageStateType.value === 'error') return 'Token 使用数据未能加载'
  return '暂无 Token 使用数据'
})

const tokenUsageStateDescription = computed(() => {
  if (tokenUsageStateType.value === 'loading') return '正在同步当前账号的用量统计。'
  if (tokenUsageStateType.value === 'error') return tokenUsageError.value
  return '当前周期还没有产生消耗，稍后刷新即可查看。'
})

const tokenUsageStateActionLabel = computed(() => {
  if (tokenUsageStateType.value === 'error') return '重新加载'
  if (tokenUsageStateType.value === 'empty') return '刷新数据'
  return ''
})

function selectTokenPeriod(periodCode: TokenUsagePeriodCode) {
  selectedTokenPeriodCode.value = periodCode
}

async function refreshTokenUsage() {
  isTokenUsageLoading.value = true
  tokenUsageError.value = ''

  try {
    currentUserTokenUsage.value = await loadCurrentUserTokenUsage(
      resolveTokenUsageDateRange(selectedTokenPeriodCode.value),
    )
    await nextTick()
    renderAllCharts()
  } catch (error) {
    currentUserTokenUsage.value = null
    tokenUsageError.value = error instanceof Error ? error.message : '加载 Token 用量失败'
    await nextTick()
    renderAllCharts()
  } finally {
    isTokenUsageLoading.value = false
  }
}

function renderUsageTrendChart() {
  const chart = getChart(usageTrendChartRef.value)
  if (!chart) return

  const timeline = tokenTrendTimeline.value
  const labels = timeline.map((point) => point.label)
  const values = timeline.map((point) => point.value)
  const peakIndex = values.length ? values.indexOf(Math.max(...values)) : -1

  chart.setOption(
    {
      animationDuration: 620,
      textStyle: chartTextStyle,
      grid: { top: 12, right: 12, bottom: 24, left: 40 },
      tooltip: {
        trigger: 'axis',
        confine: true,
        borderColor: '#dfe8f4',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        textStyle: { ...chartTextStyle, color: '#172033', fontWeight: 700 },
        formatter: (params: unknown) => {
          const item = (Array.isArray(params) ? params[0] : params) as {
            name: string
            value: number
          }
          return `${item.name}<br/>消耗 ${formatTokenNumber(Number(item.value))} Tokens`
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#d9e2ef', width: 1.4 } },
        axisLabel: { ...chartTextStyle, fontSize: 13, fontWeight: 500 },
      },
      yAxis: {
        type: 'value',
        splitNumber: 5,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          ...chartTextStyle,
          formatter: (value: number) => formatTokenCompact(value),
        },
        splitLine: { lineStyle: { color: '#dce6f3', type: 'dashed' } },
      },
      series: [
        {
          name: 'Token 消耗',
          type: 'line',
          data: values,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 3,
            color: '#2e7bff',
          },
          itemStyle: {
            color: '#2e7bff',
            borderColor: '#ffffff',
            borderWidth: 4,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(46, 123, 255, 0.24)' },
              { offset: 1, color: 'rgba(46, 123, 255, 0.03)' },
            ]),
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: 'rgba(69, 126, 224, 0.24)',
              width: 3,
            },
            data: peakIndex >= 0 ? [{ xAxis: labels[peakIndex] }] : [],
          },
          markPoint: {
            symbol: 'circle',
            symbolSize: 14,
            itemStyle: {
              color: '#2e7bff',
              borderColor: '#ffffff',
              borderWidth: 5,
            },
            label: { show: false },
            data:
              peakIndex >= 0
                ? [{ name: '峰值', coord: [labels[peakIndex], values[peakIndex]] }]
                : [],
          },
        },
      ],
    } satisfies echarts.EChartsCoreOption,
    true,
  )
}

function renderAllCharts() {
  renderUsageTrendChart()
}

const dashboardToolById = Object.fromEntries(
  dashboardTools.map((tool) => [tool.id, tool]),
) as Record<DashboardToolId, DashboardTool>

const morePlaceholderTool = dashboardToolById.more

const normalizedAgentSearchQuery = computed(() => agentSearchQuery.value.trim().toLowerCase())

const hasAgentSearchQuery = computed(() => normalizedAgentSearchQuery.value.length > 0)

const categoryFilteredAgents = computed(() =>
  agents.filter(
    (agent) => activeCategory.value === '全部' || agent.category === activeCategory.value,
  ),
)

function agentMatchesSearch(agent: AgentCatalogItem, query: string) {
  if (!query) return true

  const haystack = [agent.name, agent.description, agent.category, agent.level, ...agent.scenarios]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

const visibleAgents = computed(() =>
  categoryFilteredAgents.value.filter((agent) =>
    agentMatchesSearch(agent, normalizedAgentSearchQuery.value),
  ),
)

function clearAgentSearch() {
  agentSearchQuery.value = ''
}

function getAgentTool(agent: AgentCatalogItem) {
  return dashboardToolById[agent.key as DashboardToolId]
}

function getAgentVisual(agent: AgentCatalogItem): AgentVisual {
  const tool = getAgentTool(agent)
  if (!tool) {
    return {
      iconSrc: agent.iconSrc,
      iconText: agent.icon,
      tone: `tone-${agent.theme}`,
    }
  }

  return {
    icon: tool.icon,
    iconSrc: tool.iconSrc,
    tone: `tone-${tool.tone}`,
  }
}

function showToast(message: string) {
  actionToast.value = message
  window.setTimeout(() => {
    if (actionToast.value === message) actionToast.value = ''
  }, 2400)
}

function closeAgentPanel() {
  selectedAgent.value = null
  const nextQuery = { ...route.query }
  delete nextQuery.agent
  void router.replace({ query: nextQuery })
}

function launchAgent(agent: AgentCatalogItem) {
  if (agent.launchUrl) {
    openUrlInNewTab(agent.launchUrl)
    showToast(`已在新标签页打开 ${agent.name}`)
    return
  }

  if (agent.permissionState !== 'available') {
    showToast(`${agent.name} 当前${permissionLabels[agent.permissionState]}，暂不可直接使用`)
    return
  }

  showToast(`即将打开 ${agent.name}`)
}

function locateAgentFromQuery(agentKey?: string) {
  const normalizedKey = agentKey?.trim()
  if (!normalizedKey) {
    selectedAgent.value = null
    return
  }

  const agent = getAgentByKey(normalizedKey)
  if (!agent) return

  activeCategory.value = agent.category
  selectedAgent.value = agent
}

watch(
  () => route.query.agent,
  (agentKey) => {
    locateAgentFromQuery((Array.isArray(agentKey) ? agentKey[0] : agentKey) ?? undefined)
  },
  { immediate: true },
)

function handleOpenTodo(payload: { id: string; date?: string }) {
  const query: Record<string, string> = { todo: payload.id }
  if (payload.date) query.date = payload.date

  void router.push({
    name: 'Home',
    query,
  })
}

onMounted(async () => {
  await nextTick()
  renderAllCharts()
  void refreshTokenUsage()

  chartResizeObserver = new ResizeObserver(resizeCharts)
  if (usageTrendChartRef.value) chartResizeObserver.observe(usageTrendChartRef.value)
  window.addEventListener('resize', resizeCharts, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  chartResizeObserver?.disconnect()
  disposeCharts()
})

watch(selectedTokenPeriodCode, () => {
  void refreshTokenUsage()
})
</script>

<template>
  <div class="agent-center-page">
    <div class="agent-center-bg" aria-hidden="true">
      <img :src="agentBgUrl" alt="" />
    </div>

    <div class="agent-center-topbar-wrap">
      <DashboardTopBar page-title="智体中心" @open-todo="handleOpenTodo" />
    </div>

    <main class="agent-center-shell">
      <Transition
        enter-active-class="toast-enter-active"
        enter-from-class="toast-enter-from"
        enter-to-class="toast-enter-to"
        leave-active-class="toast-leave-active"
        leave-from-class="toast-leave-from"
        leave-to-class="toast-leave-to"
      >
        <div v-if="actionToast" class="agent-toast" role="status">
          {{ actionToast }}
        </div>
      </Transition>

      <section class="agent-main">
        <section class="agent-hero-row">
          <div class="agent-hero-panel-slot">
            <SimpleTodoListPanel />
          </div>

          <section class="token-usage-card" aria-label="个人 Token 使用记录">
            <header class="token-usage-header">
              <div class="token-usage-title">
                <IconShieldCheck aria-hidden="true" />
                <h2>个人 Token 使用记录</h2>
              </div>

              <label class="token-period-select">
                <span class="sr-only">选择统计周期</span>
                <select
                  :value="selectedTokenPeriodCode"
                  @change="
                    selectTokenPeriod(
                      ($event.target as HTMLSelectElement).value as TokenUsagePeriodCode,
                    )
                  "
                >
                  <option
                    v-for="option in tokenPeriodOptions"
                    :key="option.periodCode"
                    :value="option.periodCode"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <IconChevronDown aria-hidden="true" />
              </label>
            </header>

            <AppStateBlock
              v-if="tokenUsageStateType"
              class="token-usage-state"
              :type="tokenUsageStateType"
              :title="tokenUsageStateTitle"
              :description="tokenUsageStateDescription"
              :action-label="tokenUsageStateActionLabel"
              size="sm"
              variant="inline"
              @action="refreshTokenUsage"
            />

            <template v-else>
              <div class="token-usage-metrics">
                <div class="token-metric">
                  <span>总消耗</span>
                  <strong>{{ formatTokenNumber(tokenTotalConsumption) }} Token</strong>
                </div>
              </div>

              <div
                ref="usageTrendChartRef"
                class="token-usage-chart"
                aria-label="Token 消耗折线图"
              />

              <footer class="token-usage-footer">
                <p>
                  今日消耗
                  <strong>{{ formatTokenNumber(tokenTodayConsumption) }} Token</strong>
                </p>
                <p class="token-day-change" :class="tokenDayChangeIsDown ? 'is-down' : 'is-up'">
                  较昨日
                  <component
                    :is="tokenDayChangeIsDown ? IconTrendingDown : IconTrendingUp"
                    aria-hidden="true"
                  />
                  {{ tokenDayChangeLabel }}%
                </p>
              </footer>
            </template>
          </section>
        </section>

        <section class="agent-catalog-panel" aria-label="智能体列表">
          <header class="agent-catalog-toolbar">
            <div class="agent-catalog-heading">
              <h2>智能体列表</h2>
              <span v-if="hasAgentSearchQuery" class="agent-catalog-count">
                {{ visibleAgents.length }} / {{ categoryFilteredAgents.length }}
              </span>
            </div>

            <label class="agent-catalog-search">
              <IconSearch class="agent-catalog-search-icon" aria-hidden="true" />
              <input
                v-model="agentSearchQuery"
                type="search"
                class="agent-catalog-search-input"
                placeholder="搜索名称、描述或场景"
                autocomplete="off"
              />
              <button
                v-if="hasAgentSearchQuery"
                type="button"
                class="agent-catalog-search-clear"
                aria-label="清除搜索"
                @click="clearAgentSearch"
              >
                <IconX aria-hidden="true" />
              </button>
            </label>
          </header>

          <section class="agent-grid">
            <button
              v-for="agent in visibleAgents"
              :key="agent.id"
              type="button"
              class="agent-card"
              @click="launchAgent(agent)"
            >
              <span
                class="agent-card-tier"
                :class="`is-${agent.level.toLowerCase()}`"
                :aria-label="`智能体级别 ${agent.level}`"
              >
                {{ agent.level }}
              </span>

              <span
                class="agent-card-icon"
                :class="[
                  getAgentVisual(agent).tone,
                  { 'has-image': getAgentVisual(agent).iconSrc },
                ]"
              >
                <img
                  v-if="getAgentVisual(agent).iconSrc"
                  :src="getAgentVisual(agent).iconSrc"
                  alt=""
                  class="agent-card-icon-image"
                />
                <component
                  v-else-if="getAgentVisual(agent).icon"
                  :is="getAgentVisual(agent).icon"
                />
                <span v-else class="agent-card-icon-text">{{
                  getAgentVisual(agent).iconText
                }}</span>
              </span>

              <div class="agent-card-copy">
                <h2>{{ agent.name }}</h2>
                <p class="agent-description">{{ agent.description }}</p>
                <span class="agent-card-action">进入应用 -&gt;</span>
              </div>
            </button>

            <article
              v-if="activeCategory === '全部' && !hasAgentSearchQuery"
              class="agent-card agent-card-more"
              aria-label="期待更多智能应用"
            >
              <span
                class="agent-card-icon tone-slate"
                :class="{ 'has-image': morePlaceholderTool.iconSrc }"
              >
                <img
                  v-if="morePlaceholderTool.iconSrc"
                  :src="morePlaceholderTool.iconSrc"
                  alt=""
                  class="agent-card-icon-image"
                />
                <component v-else-if="morePlaceholderTool.icon" :is="morePlaceholderTool.icon" />
              </span>

              <div class="agent-card-copy">
                <h2>期待更多</h2>
                <p class="agent-description">更多智能应用持续上线，敬请期待。</p>
              </div>
            </article>

            <AppStateBlock
              v-if="visibleAgents.length === 0"
              class="agent-grid-empty"
              type="empty"
              :title="hasAgentSearchQuery ? '未找到匹配的智能体' : '没有匹配的智能体'"
              :description="
                hasAgentSearchQuery
                  ? `没有与「${agentSearchQuery.trim()}」相关的智能体，试试其他关键词。`
                  : '当前暂无可用智能体，请稍后再试。'
              "
              size="sm"
              variant="inline"
            />
          </section>
        </section>
      </section>

      <Transition
        enter-active-class="panel-enter-active"
        enter-from-class="panel-enter-from"
        enter-to-class="panel-enter-to"
        leave-active-class="panel-leave-active"
        leave-from-class="panel-leave-from"
        leave-to-class="panel-leave-to"
      >
        <aside v-if="selectedAgent" class="agent-detail-panel" aria-label="智能体详情">
          <header>
            <div>
              <p>{{ selectedAgent.category }}</p>
              <h2>{{ selectedAgent.name }}</h2>
            </div>
            <button type="button" aria-label="关闭详情" @click="closeAgentPanel">
              <IconX />
            </button>
          </header>

          <p class="detail-description">{{ selectedAgent.description }}</p>

          <section>
            <h3>适用场景</h3>
            <div class="detail-tags">
              <span v-for="scenario in selectedAgent.scenarios" :key="scenario">
                {{ scenario }}
              </span>
            </div>
          </section>

          <footer>
            <button type="button" class="detail-secondary" @click="closeAgentPanel">关闭</button>
            <button type="button" class="detail-primary" @click="launchAgent(selectedAgent)">
              立即使用
            </button>
          </footer>
        </aside>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.agent-center-page {
  position: relative;
  display: flex;
  width: 100%;
  height: 100vh;
  flex-direction: column;
  overflow: hidden;
  background: #e6edf5;
  color: #111827;
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}

.agent-center-page > :not(.agent-center-bg) {
  position: relative;
  z-index: 1;
}

.agent-center-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.agent-center-bg::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(245, 250, 255, 0.08), rgba(226, 237, 248, 0.08));
  content: '';
}

.agent-center-bg img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center bottom;
  transform: translateY(clamp(28px, 4.8vh, 72px));
}

.agent-center-topbar-wrap {
  flex-shrink: 0;
}

.agent-center-topbar-wrap :deep(.dashboard-topbar) {
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: radial-gradient(
      circle at 22% 20%,
      rgba(255, 255, 255, 0.72),
      rgba(255, 255, 255, 0) 36%
    ),
    linear-gradient(145deg, rgba(255, 255, 255, 0.52), rgba(214, 228, 248, 0.42)),
    rgba(226, 236, 250, 0.58) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 10px 28px rgba(72, 110, 165, 0.14);
  backdrop-filter: blur(22px) saturate(1.14) !important;
  -webkit-backdrop-filter: blur(22px) saturate(1.14) !important;
}

.agent-center-shell {
  --main-pad-top: clamp(17px, 1.9vh, 21px);
  --main-pad-right: clamp(18px, 1.1vw, 21px);
  --main-pad-bottom: 32px;
  --main-pad-left: clamp(25px, 1.45vw, 28px);
  --topbar-gutter: clamp(48px, 3.8vw, 76px);
  --hero-panel-min-height: clamp(310px, 34vh, 370px);
  --banner-height: clamp(260px, 26.5vh, 286px);
  --toolbar-gap: clamp(14px, 1.55vh, 17px);
  --grid-gap-x: 14px;
  --grid-gap-y: 12px;
  --agent-grid-columns: 4;
  --agent-card-min-height: 122px;
  --metric-card-width: clamp(269px, 16vw, 307px);
  --metric-card-height: clamp(100px, 10.6vh, 116px);
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  width: 100%;
  overflow: hidden;
}

.agent-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: clamp(10px, 1.2vh, 14px);
  overflow: hidden;
  padding: var(--main-pad-top) var(--main-pad-right) var(--main-pad-bottom) var(--main-pad-left);
}

.agent-hero-row {
  display: grid;
  flex: 0 0 auto;
  width: calc(100% + var(--main-pad-left) + var(--main-pad-right) - var(--topbar-gutter));
  min-height: var(--hero-panel-min-height);
  margin-left: calc((var(--topbar-gutter) / 2) - var(--main-pad-left));
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(10px, 1.2vw, 14px);
  align-items: stretch;
}

.agent-hero-panel-slot {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.token-usage-card {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.92);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 18px 42px rgba(72, 110, 165, 0.12);
  padding: 18px 20px 16px;
}

.token-usage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.token-usage-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #172033;
}

.token-usage-title h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.2;
}

.token-usage-title svg {
  width: 18px;
  height: 18px;
  color: #126cff;
  stroke-width: 2.4;
}

.token-period-select {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.token-period-select select {
  height: 34px;
  appearance: none;
  border: 1px solid #dfe8f4;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 6px 15px rgba(69, 101, 148, 0.08);
  color: #475569;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  outline: none;
  padding: 0 34px 0 12px;
}

.token-period-select select:focus-visible {
  border-color: rgba(18, 108, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(18, 108, 255, 0.12);
}

.token-period-select svg {
  position: absolute;
  right: 10px;
  width: 15px;
  height: 15px;
  color: #627795;
  pointer-events: none;
  stroke-width: 2.5;
}

.token-usage-state {
  flex: 1;
  margin-top: 16px;
}

.token-usage-metrics {
  display: flex;
  gap: 24px;
  margin-top: 14px;
}

.token-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.token-metric span {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.token-metric strong {
  color: #0f172a;
  font-size: 22px;
  font-weight: 900;
  line-height: 1.1;
}

.token-usage-chart {
  flex: 1;
  width: 100%;
  min-height: 150px;
  margin-top: 4px;
}

.token-usage-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #e8eef7;
  margin-top: 8px;
  padding-top: 12px;
}

.token-usage-footer p {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.token-usage-footer strong {
  color: #0f172a;
  font-size: 14px;
  font-weight: 900;
}

.token-day-change {
  font-weight: 800;
}

.token-day-change.is-down {
  color: #16a34a;
}

.token-day-change.is-up {
  color: #ef4444;
}

.token-day-change svg {
  width: 14px;
  height: 14px;
  stroke-width: 2.8;
}

.agent-catalog-panel {
  display: flex;
  width: calc(100% + var(--main-pad-left) + var(--main-pad-right) - var(--topbar-gutter));
  flex: 0 0 auto;
  flex-direction: column;
  margin-top: 0;
  margin-left: calc((var(--topbar-gutter) / 2) - var(--main-pad-left));
  border: 1px solid rgba(255, 255, 255, 0.88);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 24px 48px rgba(100, 140, 200, 0.12);
  padding: clamp(14px, 1.35vw, 16px);
}

.agent-catalog-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: clamp(10px, 1.1vw, 12px);
}

.agent-catalog-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.agent-catalog-heading h2 {
  margin: 0;
  color: #172033;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.2;
}

.agent-catalog-count {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.agent-catalog-search {
  position: relative;
  display: flex;
  align-items: center;
  width: min(280px, 100%);
  flex: 0 1 280px;
}

.agent-catalog-search-icon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: #7b8da8;
  pointer-events: none;
}

.agent-catalog-search-input {
  width: 100%;
  height: 34px;
  border: 1px solid #dfe8f4;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 6px 15px rgba(69, 101, 148, 0.08);
  color: #172033;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  outline: none;
  padding: 0 36px;
}

.agent-catalog-search-input::placeholder {
  color: #94a3b8;
}

.agent-catalog-search-input:focus-visible {
  border-color: rgba(18, 108, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(18, 108, 255, 0.12);
}

.agent-catalog-search-clear {
  position: absolute;
  right: 6px;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #7b8da8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.agent-catalog-search-clear svg {
  width: 14px;
  height: 14px;
}

.agent-catalog-search-clear:hover,
.agent-catalog-search-clear:focus-visible {
  background: rgba(226, 236, 250, 0.9);
  color: #355da3;
  outline: none;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(var(--agent-grid-columns), minmax(0, 1fr));
  grid-auto-rows: var(--agent-card-min-height);
  align-content: start;
  gap: var(--grid-gap-y) var(--grid-gap-x);
  height: calc(
    var(--agent-card-min-height) + var(--agent-card-min-height) + var(--grid-gap-y) + 2px
  );
  padding: 2px 2px 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.agent-grid::-webkit-scrollbar {
  width: 8px;
}

.agent-grid::-webkit-scrollbar-track {
  background: transparent;
}

.agent-grid::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(125, 157, 204, 0.42);
  background-clip: padding-box;
}

.agent-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: var(--agent-card-min-height);
  border: 1px solid rgba(255, 255, 255, 0.95);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 28px rgba(91, 131, 184, 0.1);
  color: inherit;
  padding: 15px 15px 13px;
  text-align: left;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.agent-card-tier {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.04em;
  white-space: nowrap;
  pointer-events: none;
}

.agent-card-tier.is-l1 {
  color: #1f4e9d;
  background: rgba(219, 234, 254, 0.98);
  box-shadow:
    inset 0 0 0 1px rgba(59, 130, 246, 0.28),
    0 4px 10px rgba(59, 130, 246, 0.12);
}

.agent-card-tier.is-l2 {
  color: #9a3412;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.98), rgba(254, 230, 138, 0.94));
  box-shadow:
    inset 0 0 0 1px rgba(245, 158, 11, 0.36),
    0 4px 10px rgba(245, 158, 11, 0.14);
}

.agent-card:hover,
.agent-card:focus-visible {
  border-color: rgba(63, 137, 255, 0.42);
  box-shadow: 0 18px 34px rgba(61, 122, 211, 0.16);
  outline: none;
  transform: translateY(-2px);
}

.agent-card-icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid rgba(226, 237, 255, 0.95);
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f3f8ff 100%);
  box-shadow: 0 10px 20px rgba(91, 131, 184, 0.12);
}

.agent-card-icon.has-image {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.agent-card-icon-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
}

.agent-card-icon svg {
  width: 22px;
  height: 22px;
  stroke-width: 2.5;
}

.agent-card-icon-text {
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
}

.tone-orange.agent-card-icon {
  background: #ffe5d7;
  color: #ff7a3d;
}

.tone-blue.agent-card-icon {
  background: #dbeafe;
  color: #2f7cff;
}

.tone-green.agent-card-icon {
  background: #d9f8e7;
  color: #20bb77;
}

.tone-violet.agent-card-icon,
.tone-purple.agent-card-icon {
  background: #eadfff;
  color: #8b5cf6;
}

.tone-cyan.agent-card-icon {
  background: #d7f7ff;
  color: #09b6d7;
}

.tone-sky.agent-card-icon {
  background: #dff3ff;
  color: #26a4e8;
}

.tone-slate.agent-card-icon {
  background: #e7edf5;
  color: #70819a;
}

.agent-card-more {
  border-style: dashed;
  border-color: rgba(148, 163, 184, 0.42);
  background: rgba(255, 255, 255, 0.56);
  cursor: default;
  box-shadow: none;
}

.agent-card-more:hover,
.agent-card-more:focus-within {
  border-color: rgba(148, 163, 184, 0.42);
  box-shadow: none;
  transform: none;
}

.agent-card-more h2,
.agent-card-more .agent-description {
  color: #64748b;
}

.agent-card-copy {
  min-width: 0;
  flex: 1;
}

.agent-card:not(.agent-card-more) .agent-card-copy {
  padding-right: 40px;
}

.agent-card h2 {
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.25;
}

.agent-description {
  display: -webkit-box;
  margin: 7px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.52;
}

.agent-card-action {
  display: inline-flex;
  margin-top: 10px;
  color: #126cff;
  font-size: 12px;
  font-weight: 800;
}

.agent-grid-empty {
  grid-column: 1 / -1;
  align-self: start;
  margin: 24px 0;
}

.detail-tags span {
  display: inline-flex;
  height: 22px;
  align-items: center;
  border-radius: 7px;
  background: #edf5ff;
  color: #42628d;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  padding: 0 8px;
}

.agent-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  z-index: 80;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #0f1a2f;
  box-shadow: 0 14px 32px rgba(15, 26, 47, 0.18);
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  padding: 9px 17px;
}

.agent-detail-panel {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 60;
  display: flex;
  width: min(360px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(222, 233, 249, 0.96);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 62px rgba(32, 65, 116, 0.22);
  padding: 22px;
}

.agent-detail-panel header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.agent-detail-panel header p {
  margin: 0 0 8px;
  color: #126cff;
  font-size: 12px;
  font-weight: 900;
}

.agent-detail-panel header h2 {
  margin: 0;
  color: #101827;
  font-size: 24px;
  font-weight: 900;
}

.agent-detail-panel header button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: #f2f7ff;
  color: #49658f;
}

.agent-detail-panel header button svg {
  width: 18px;
  height: 18px;
}

.detail-description {
  margin: 18px 0 22px;
  color: #405d86;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.7;
}

.agent-detail-panel h3 {
  margin: 0 0 12px;
  color: #101827;
  font-size: 15px;
  font-weight: 900;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.agent-detail-panel footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 26px;
}

.detail-secondary,
.detail-primary {
  height: 38px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 800;
  padding: 0 17px;
}

.detail-secondary {
  border: 1px solid #dce9fb;
  background: #ffffff;
  color: #36567e;
}

.detail-primary {
  border: 0;
  background: #0966ff;
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(17, 108, 255, 0.22);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.toast-enter-active,
.toast-leave-active,
.panel-enter-active,
.panel-leave-active {
  transition: all 200ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

.toast-enter-to,
.toast-leave-from {
  opacity: 1;
  transform: translate(-50%, 0);
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateX(18px);
}

.panel-enter-to,
.panel-leave-from {
  opacity: 1;
  transform: translateX(0);
}

@media (max-width: 1280px) {
  .agent-center-shell {
    --agent-grid-columns: 3;
  }
}

@media (max-width: 900px) {
  .agent-center-shell {
    --topbar-gutter: 28px;
  }
}

@media (max-width: 1024px) {
  .agent-center-shell {
    --main-pad-top: 18px;
    --main-pad-right: 12px;
    --main-pad-bottom: 32px;
    --main-pad-left: 12px;
    --hero-panel-min-height: clamp(290px, 32vh, 330px);
    --agent-grid-columns: 2;
    --agent-card-min-height: 136px;
    overflow: hidden;
  }

  .agent-main {
    padding: var(--main-pad-top) var(--main-pad-right) var(--main-pad-bottom) var(--main-pad-left);
  }

  .agent-hero-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .agent-center-shell {
    --agent-grid-columns: 1;
    --agent-card-min-height: 140px;
    display: flex;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }

  .agent-main {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    --main-pad-right: 8px;
    --main-pad-left: 8px;
    padding: 18px 8px 28px;
  }

  .token-usage-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .agent-catalog-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .agent-catalog-search {
    width: 100%;
    flex: 1 1 auto;
  }
}
</style>
