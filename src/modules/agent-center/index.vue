<script setup lang="ts">
import type { Component } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import IconBot from '~icons/lucide/bot'
import IconBox from '~icons/lucide/box'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconCode2 from '~icons/lucide/code-2'
import IconImage from '~icons/lucide/image'
import IconLayers from '~icons/lucide/layers'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconRocket from '~icons/lucide/rocket'
import IconShieldCheck from '~icons/lucide/shield-check'
import IconSparkles from '~icons/lucide/sparkles'
import IconTrendingDown from '~icons/lucide/trending-down'
import IconTrendingUp from '~icons/lucide/trending-up'
import IconUsers from '~icons/lucide/users'
import IconX from '~icons/lucide/x'
import agentBgUrl from '@/assets/agentbg.png'
import DashboardTopBar from '@/modules/home/dashboard/DashboardTopBar.vue'
import {
  loadCurrentUserTokenUsage,
  resolveTokenUsageDateRange,
  type CurrentUserTokenUsage,
  type TokenUsagePeriodCode,
} from '@/modules/token-usage/token-usage.service'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { openUrlInNewTab } from './links'
import { agents, getAgentByKey, permissionLabels } from './mock'
import type { AgentCatalogItem, AgentCategory } from './types'

defineOptions({
  name: 'AgentCenterPage',
})

type AgentVisual = {
  icon: Component
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

type WelcomeFeature = {
  title: string
  description: string
  icon: Component
}

const welcomeFeatures: WelcomeFeature[] = [
  {
    title: '多场景覆盖',
    description: '满足企业多样化业务需求',
    icon: IconLayers,
  },
  {
    title: '开箱即用',
    description: '快速接入，轻松上手',
    icon: IconRocket,
  },
  {
    title: '安全可靠',
    description: '企业级安全与权限管控',
    icon: IconShieldCheck,
  },
]

const route = useRoute()
const router = useRouter()

const activeCategory = ref<AgentCategory | '全部'>('全部')
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

const chartInstances = new Set<echarts.ECharts>()
let chartResizeObserver: ResizeObserver | null = null

const chartTextStyle = {
  color: '#71819c',
  fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  fontWeight: 500,
}

function formatTokenNumber(value: number) {
  return Math.round(value).toLocaleString('zh-CN')
}

function formatTokenCompact(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
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

function getChart(el: HTMLElement | null) {
  if (!el) return null

  const chart = echarts.getInstanceByDom(el) ?? echarts.init(el, undefined, { renderer: 'canvas' })
  chartInstances.add(chart)
  return chart
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
    } satisfies echarts.EChartsOption,
    true,
  )
}

function renderAllCharts() {
  renderUsageTrendChart()
}

function resizeCharts() {
  chartInstances.forEach((chart) => chart.resize())
}

const agentVisualMap: Record<string, AgentVisual> = {
  'policy-qa': { icon: IconMessageCircle, tone: 'icon-blue' },
  'image-analysis': { icon: IconImage, tone: 'icon-blue' },
  'meeting-notes': { icon: IconUsers, tone: 'icon-teal' },
  'ppt-creator': { icon: IconSparkles, tone: 'icon-orange' },
  'agent-workshop': { icon: IconBox, tone: 'icon-blue' },
  'code-assistant': { icon: IconCode2, tone: 'icon-cyan' },
  'interview-center': { icon: IconUsers, tone: 'icon-teal' },
  'compliance-assistant': { icon: IconShieldCheck, tone: 'icon-blue' },
}

const defaultAgentVisual: AgentVisual = {
  icon: IconBot,
  tone: 'icon-blue',
}

const visibleAgents = computed(() =>
  agents.filter((agent) => activeCategory.value === '全部' || agent.category === activeCategory.value),
)

function getAgentVisual(agent: AgentCatalogItem) {
  return agentVisualMap[agent.key] ?? defaultAgentVisual
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
  chartInstances.forEach((chart) => chart.dispose())
  chartInstances.clear()
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

    <DashboardTopBar @open-todo="handleOpenTodo" />

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
          <section class="agent-welcome" aria-label="欢迎语">
            <h1 class="welcome-title">
              AI Agent <span>应用广场</span>
            </h1>
            <p class="welcome-subtitle">
              一站式企业级 AI 应用平台，赋能高效协作与智能创新
            </p>

            <div class="welcome-features">
              <article
                v-for="feature in welcomeFeatures"
                :key="feature.title"
                class="welcome-feature-card"
              >
                <span class="welcome-feature-icon" aria-hidden="true">
                  <component :is="feature.icon" />
                </span>
                <div class="welcome-feature-copy">
                  <h2>{{ feature.title }}</h2>
                  <p>{{ feature.description }}</p>
                </div>
              </article>
            </div>
          </section>

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
                  @change="selectTokenPeriod(($event.target as HTMLSelectElement).value as TokenUsagePeriodCode)"
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
                <p
                  class="token-day-change"
                  :class="tokenDayChangeIsDown ? 'is-down' : 'is-up'"
                >
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
          <section class="agent-grid">
            <button
              v-for="agent in visibleAgents"
              :key="agent.id"
              type="button"
              class="agent-card"
              @click="launchAgent(agent)"
            >
              <span class="agent-card-icon" :class="getAgentVisual(agent).tone">
                <component :is="getAgentVisual(agent).icon" />
              </span>

              <div class="agent-card-copy">
                <h2>{{ agent.name }}</h2>
                <p class="agent-description">{{ agent.description }}</p>
                <span class="agent-card-action">进入应用 -&gt;</span>
              </div>
            </button>

            <AppStateBlock
              v-if="visibleAgents.length === 0"
              class="agent-grid-empty"
              type="empty"
              title="没有匹配的智能体"
              description="当前暂无可用智能体，请稍后再试。"
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
  background: #ffffff;
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

.agent-center-bg img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center calc(100% + clamp(96px, 11vh, 160px));
}

.agent-center-shell {
  --main-pad-top: clamp(17px, 1.9vh, 21px);
  --main-pad-right: clamp(18px, 1.1vw, 21px);
  --main-pad-bottom: 32px;
  --main-pad-left: clamp(25px, 1.45vw, 28px);
  --banner-height: clamp(260px, 26.5vh, 286px);
  --toolbar-gap: clamp(14px, 1.55vh, 17px);
  --grid-gap-x: 16px;
  --grid-gap-y: 14px;
  --agent-grid-columns: 4;
  --agent-card-min-height: 132px;
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
  gap: clamp(18px, 2.2vh, 28px);
  overflow: hidden;
  padding: var(--main-pad-top) var(--main-pad-right) var(--main-pad-bottom) var(--main-pad-left);
}

.agent-hero-row {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 1.12fr) minmax(320px, 0.88fr);
  gap: clamp(18px, 2vw, 28px);
  align-items: stretch;
}

.agent-welcome {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: clamp(8px, 1.2vh, 16px) 0;
}

.welcome-title {
  margin: 0;
  color: #0f172a;
  font-size: clamp(34px, 3.4vw, 52px);
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.welcome-title span {
  color: #126cff;
}

.welcome-subtitle {
  max-width: 640px;
  margin: clamp(12px, 1.4vh, 18px) 0 0;
  color: #64748b;
  font-size: clamp(14px, 1vw, 16px);
  font-weight: 500;
  line-height: 1.7;
}

.welcome-features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: clamp(20px, 2.4vh, 28px);
}

.welcome-feature-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.88);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(14px);
  box-shadow: 0 10px 24px rgba(100, 140, 200, 0.08);
  padding: 12px 14px;
}

.welcome-feature-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 10px;
  background: linear-gradient(180deg, #edf5ff 0%, #e4efff 100%);
  color: #126cff;
}

.welcome-feature-icon svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.4;
}

.welcome-feature-copy h2 {
  margin: 0;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.3;
}

.welcome-feature-copy p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
}

.token-usage-card {
  display: flex;
  min-width: 0;
  min-height: clamp(280px, 30vh, 340px);
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
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.88);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 24px 48px rgba(100, 140, 200, 0.12);
  padding: clamp(18px, 1.8vw, 24px);
}

.agent-grid {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: repeat(var(--agent-grid-columns), minmax(0, 1fr));
  align-content: start;
  gap: var(--grid-gap-y) var(--grid-gap-x);
  min-height: 0;
  overflow-y: auto;
  padding: 2px 4px 8px 0;
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
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-height: var(--agent-card-min-height);
  border: 1px solid rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 28px rgba(91, 131, 184, 0.1);
  color: inherit;
  padding: 18px 18px 16px;
  text-align: left;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
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
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid rgba(226, 237, 255, 0.95);
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #f3f8ff 100%);
  box-shadow: 0 10px 20px rgba(91, 131, 184, 0.12);
}

.agent-card-icon svg {
  width: 22px;
  height: 22px;
  stroke-width: 2.5;
}

.agent-card-copy {
  min-width: 0;
  flex: 1;
}

.agent-card h2 {
  margin: 0;
  color: #0f172a;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.3;
}

.agent-description {
  display: -webkit-box;
  margin: 8px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.55;
}

.agent-card-action {
  display: inline-flex;
  margin-top: 12px;
  color: #126cff;
  font-size: 13px;
  font-weight: 800;
}

.icon-blue {
  color: #126cff;
}

.icon-teal {
  color: #19bfae;
}

.icon-orange {
  color: #ff7a00;
}

.icon-cyan {
  color: #16b9c1;
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

  .agent-hero-row {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.92fr);
  }
}

@media (max-width: 1024px) {
  .agent-center-shell {
    --main-pad-top: 18px;
    --main-pad-right: 12px;
    --main-pad-bottom: 32px;
    --main-pad-left: 12px;
    --agent-grid-columns: 2;
    --agent-card-min-height: 148px;
    overflow: hidden;
  }

  .agent-main {
    padding: var(--main-pad-top) var(--main-pad-right) var(--main-pad-bottom) var(--main-pad-left);
  }

  .agent-hero-row {
    grid-template-columns: 1fr;
  }

  .welcome-features {
    grid-template-columns: 1fr;
  }

  .token-usage-card {
    min-height: 300px;
  }
}

@media (max-width: 760px) {
  .agent-center-shell {
    --agent-grid-columns: 1;
    --agent-card-min-height: 152px;
    display: flex;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }

  .agent-main {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    padding: 18px 8px 28px;
  }

  .welcome-title {
    font-size: 30px;
  }

  .token-usage-footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
