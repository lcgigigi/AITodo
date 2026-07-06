<script setup lang="ts">
import type { Component } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import IconBot from '~icons/lucide/bot'
import IconBox from '~icons/lucide/box'
import IconCalendarDays from '~icons/lucide/calendar-days'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconCircleHelp from '~icons/lucide/circle-help'
import IconCode2 from '~icons/lucide/code-2'
import IconCpu from '~icons/lucide/cpu'
import IconHistory from '~icons/lucide/history'
import IconImage from '~icons/lucide/image'
import IconInfo from '~icons/lucide/info'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconPanelLeftClose from '~icons/lucide/panel-left-close'
import IconPanelLeftOpen from '~icons/lucide/panel-left-open'
import IconPlus from '~icons/lucide/plus'
import IconSearch from '~icons/lucide/search'
import IconShieldCheck from '~icons/lucide/shield-check'
import IconSparkles from '~icons/lucide/sparkles'
import IconStar from '~icons/lucide/star'
import IconTrendingUp from '~icons/lucide/trending-up'
import IconUsers from '~icons/lucide/users'
import IconX from '~icons/lucide/x'
import makeUrl from '@/assets/agent-center/make.png'
import moreAbilityUrl from '@/assets/agent-center/newagnet.png'
import DashboardTopBar from '@/modules/home/dashboard/DashboardTopBar.vue'
import {
  getTokenUsagePeriodName,
  loadCurrentUserTokenUsage,
  resolveTokenUsageDateRange,
  type CurrentUserTokenUsage,
  type TokenUsagePeriodCode,
} from '@/modules/token-usage/token-usage.service'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { openUrlInNewTab } from './links'
import { agentCategories, agents, getAgentByKey, permissionLabels, skills } from './mock'
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

type TokenModuleVisual = {
  icon: Component
  color: string
  iconTone: string
}

type TokenModuleUsage = {
  moduleCode: string
  moduleName: string
  tokenUsage: number
}

type TokenRankingEntry = TokenModuleUsage &
  TokenModuleVisual & {
    rank: number
    share: string
  }

type TokenDistributionEntry = {
  label: string
  value: number
  percentLabel: string
  color: string
}

type TokenTrendPoint = {
  date: string
  label: string
  value: number
}

const route = useRoute()
const router = useRouter()

const searchKeyword = ref('')
const activeCategory = ref<AgentCategory | '全部'>('全部')
const selectedAgent = ref<AgentCatalogItem | null>(null)
const actionToast = ref('')
const sidebarCollapsed = ref(true)
const currentUserTokenUsage = ref<CurrentUserTokenUsage | null>(null)
const isTokenUsageLoading = ref(true)
const tokenUsageError = ref('')
const selectedTokenPeriodCode = ref<TokenUsagePeriodCode>('last7Days')

const primaryNav = [
  { label: '智能体 Agent', icon: IconBot, active: true },
  { label: '能力 Skills', icon: IconCpu, active: false },
  { label: '我的收藏', icon: IconStar, active: false },
  { label: '使用记录', icon: IconHistory, active: false },
]

const secondaryNav = [{ label: '帮助中心', icon: IconCircleHelp }]

const tokenRangeTabs: TokenRangeTab[] = [
  { label: '日', periodCode: 'today' },
  { label: '周', periodCode: 'last7Days' },
  { label: '月', periodCode: 'last30Days' },
]

const tokenModuleVisualMap: Record<string, TokenModuleVisual> = {
  codeAssist: { icon: IconCode2, color: '#48c979', iconTone: 'token-icon-teal' },
  libaiQa: { icon: IconMessageCircle, color: '#2e7bff', iconTone: 'token-icon-blue' },
  fileAnalysis: { icon: IconImage, color: '#27c7c8', iconTone: 'token-icon-teal' },
  smartTodo: { icon: IconCalendarDays, color: '#9a6df2', iconTone: 'token-icon-orange' },
}

const defaultTokenModuleVisual: TokenModuleVisual = {
  icon: IconSparkles,
  color: '#8196bf',
  iconTone: 'token-icon-blue',
}

const usageTrendChartRef = ref<HTMLElement | null>(null)
const rankingChartRef = ref<HTMLElement | null>(null)
const distributionPieChartRef = ref<HTMLElement | null>(null)

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

const selectedTokenPeriodLabel = computed(() =>
  getTokenUsagePeriodName(selectedTokenPeriodCode.value),
)

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

const tokenRanking = computed<TokenRankingEntry[]>(() => {
  const total = tokenTotalConsumption.value

  return selectedTokenModuleUsages.value
    .filter((module) => module.tokenUsage > 0)
    .sort((a, b) => b.tokenUsage - a.tokenUsage)
    .map((module, index) => {
      const visual = tokenModuleVisualMap[module.moduleCode] ?? defaultTokenModuleVisual

      return {
        ...module,
        ...visual,
        rank: index + 1,
        share: total > 0 ? `${((module.tokenUsage / total) * 100).toFixed(1)}%` : '0%',
      }
    })
})

const tokenDistribution = computed<TokenDistributionEntry[]>(() =>
  tokenRanking.value.map((item) => ({
    label: item.moduleName,
    value: item.tokenUsage,
    percentLabel: item.share,
    color: item.color,
  })),
)

const tokenDateRangeLabel = computed(() => {
  const points = tokenTrendTimeline.value.filter((point) => point.date)
  if (points.length > 1) return `${points[0].date} ~ ${points[points.length - 1].date}`
  if (points.length === 1) return points[0].date

  const range = resolveTokenUsageDateRange(selectedTokenPeriodCode.value)
  return range.startDate === range.endDate
    ? range.startDate
    : `${range.startDate} ~ ${range.endDate}`
})

const tokenDailyAverage = computed(() => {
  const pointCount = Math.max(1, tokenTrendTimeline.value.length)
  return Math.round(tokenTotalConsumption.value / pointCount)
})

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

function openTokenDashboard() {
  void router.push({ name: 'LeaderBoard' })
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
      grid: { top: 18, right: 18, bottom: 28, left: 46 },
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

function renderRankingChart() {
  const chart = getChart(rankingChartRef.value)
  if (!chart) return

  const ordered = [...tokenRanking.value].reverse()

  chart.setOption(
    {
      animationDuration: 620,
      textStyle: chartTextStyle,
      grid: { top: 4, right: 52, bottom: 4, left: 72 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        confine: true,
        borderColor: '#dfe8f4',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        textStyle: { ...chartTextStyle, color: '#172033', fontWeight: 700 },
        formatter: (params: unknown) => {
          const item = (Array.isArray(params) ? params[0] : params) as {
            name: string
            value: number
          }
          const ranking = tokenRanking.value.find((entry) => entry.moduleName === item.name)
          const share = ranking?.share ?? ''
          return `${item.name}<br/>${formatTokenNumber(Number(item.value))} Tokens<br/>占比 ${share}`
        },
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: ordered.map((item) => item.moduleName),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          ...chartTextStyle,
          color: '#182337',
          fontSize: 12,
          fontWeight: 600,
        },
      },
      series: [
        {
          type: 'bar',
          data: ordered.map((item) => ({
            value: item.tokenUsage,
            itemStyle: { color: item.color, borderRadius: [0, 999, 999, 0] },
          })),
          barWidth: 8,
          showBackground: true,
          backgroundStyle: {
            color: '#eef3fb',
            borderRadius: 999,
          },
          label: {
            show: true,
            position: 'right',
            ...chartTextStyle,
            color: '#182337',
            fontSize: 11,
            fontWeight: 600,
            formatter: (params: { value?: unknown }) =>
              formatTokenNumber(Number(params.value ?? 0)),
          },
        },
      ],
    } satisfies echarts.EChartsOption,
    true,
  )
}

function renderDistributionPieChart() {
  const chart = getChart(distributionPieChartRef.value)
  if (!chart) return

  chart.setOption(
    {
      animationDuration: 720,
      textStyle: chartTextStyle,
      color: tokenDistribution.value.map((item) => item.color),
      title: {
        text: formatTokenNumber(tokenTotalConsumption.value),
        subtext: '总消耗 Tokens',
        left: 'center',
        top: '38%',
        textStyle: {
          ...chartTextStyle,
          color: '#172033',
          fontSize: 24,
          fontWeight: 700,
        },
        subtextStyle: {
          ...chartTextStyle,
          color: '#7c8ca5',
          fontSize: 11,
          fontWeight: 500,
        },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        borderColor: '#dfe8f4',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        textStyle: { ...chartTextStyle, color: '#172033', fontWeight: 700 },
        formatter: (params: unknown) => {
          const item = params as { name: string; percent: number }
          return `${item.name}<br/>占比 ${item.percent}%`
        },
      },
      series: [
        {
          name: 'Token 消耗分布',
          type: 'pie',
          radius: ['52%', '78%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          minAngle: 4,
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 3,
          },
          label: { show: false },
          labelLine: { show: false },
          data: tokenDistribution.value.map((item) => ({
            name: item.label,
            value: item.value,
          })),
        },
      ],
    } satisfies echarts.EChartsOption,
    true,
  )
}

function renderAllCharts() {
  renderUsageTrendChart()
  renderRankingChart()
  renderDistributionPieChart()
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

const categoryTabs = computed(() => [
  { key: '全部' as const, label: '全部', count: agents.length + skills.length },
  ...agentCategories.map((category) => ({
    key: category,
    label: category,
    count: agents.filter((agent) => agent.category === category).length,
  })),
])

const visibleAgents = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()

  return agents.filter((agent) => {
    const matchesCategory =
      activeCategory.value === '全部' || agent.category === activeCategory.value
    const matchesKeyword =
      !keyword ||
      [agent.name, agent.description, agent.category, ...agent.scenarios]
        .join(' ')
        .toLowerCase()
        .includes(keyword)

    return matchesCategory && matchesKeyword
  })
})

const shouldShowMoreAbility = computed(
  () => activeCategory.value === '全部' && searchKeyword.value.trim().length === 0,
)

function getAgentVisual(agent: AgentCatalogItem) {
  return agentVisualMap[agent.key] ?? defaultAgentVisual
}

function selectCategory(category: AgentCategory | '全部') {
  activeCategory.value = category
}

function showToast(message: string) {
  actionToast.value = message
  window.setTimeout(() => {
    if (actionToast.value === message) actionToast.value = ''
  }, 2400)
}

function handleNav(label: string) {
  if (label === '智能体 Agent') {
    activeCategory.value = '全部'
    searchKeyword.value = ''
    void router.replace({ name: 'AgentCenter' })
    return
  }

  showToast(`${label} 即将开放`)
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function createAgent() {
  showToast('开始创建专属智能体')
}

function openAgent(agent: AgentCatalogItem) {
  if (agent.launchUrl) {
    openUrlInNewTab(agent.launchUrl)
    showToast(`已在新标签页打开 ${agent.name}`)
    return
  }

  selectedAgent.value = agent
  void router.replace({ query: { ...route.query, agent: agent.key } })
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

function statusClass(state: AgentCatalogItem['permissionState']) {
  return state === 'available' ? 'is-available' : 'is-pending'
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

const mobileSidebarMedia = window.matchMedia('(max-width: 760px)')

function syncSidebarForViewport(event?: MediaQueryListEvent) {
  const isMobile = event?.matches ?? mobileSidebarMedia.matches
  if (isMobile) sidebarCollapsed.value = false
}

onMounted(async () => {
  syncSidebarForViewport()
  mobileSidebarMedia.addEventListener('change', syncSidebarForViewport)

  await nextTick()
  renderAllCharts()
  void refreshTokenUsage()

  chartResizeObserver = new ResizeObserver(resizeCharts)
  ;[usageTrendChartRef.value, rankingChartRef.value, distributionPieChartRef.value].forEach(
    (el) => {
      if (el) chartResizeObserver?.observe(el)
    },
  )
  window.addEventListener('resize', resizeCharts, { passive: true })
})

onBeforeUnmount(() => {
  mobileSidebarMedia.removeEventListener('change', syncSidebarForViewport)
  window.removeEventListener('resize', resizeCharts)
  chartResizeObserver?.disconnect()
  chartInstances.forEach((chart) => chart.dispose())
  chartInstances.clear()
})

watch(sidebarCollapsed, async () => {
  await nextTick()
  resizeCharts()
})

watch(selectedTokenPeriodCode, () => {
  void refreshTokenUsage()
})
</script>

<template>
  <div class="agent-center-page">
    <DashboardTopBar @open-todo="handleOpenTodo" />

    <main class="agent-center-shell" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
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

      <aside class="agent-sidebar" aria-label="Agent Center 导航">
        <nav class="sidebar-nav" aria-label="主要导航">
          <template v-for="item in primaryNav" :key="item.label">
            <div v-if="item.label === '智能体 Agent'" class="sidebar-link-row">
              <button
                type="button"
                class="sidebar-link"
                :class="{ active: item.active }"
                :aria-label="item.label"
                :title="sidebarCollapsed ? item.label : undefined"
                @click="handleNav(item.label)"
              >
                <component :is="item.icon" class="sidebar-link-icon" />
                <span class="sidebar-link-label">{{ item.label }}</span>
              </button>

              <button
                type="button"
                class="sidebar-collapse-toggle"
                :aria-label="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
                :aria-expanded="!sidebarCollapsed"
                @click="toggleSidebar"
              >
                <span class="sidebar-collapse-toggle-icon" aria-hidden="true">
                  <IconPanelLeftClose v-if="!sidebarCollapsed" />
                  <IconPanelLeftOpen v-else />
                </span>
              </button>
            </div>

            <button
              v-else
              type="button"
              class="sidebar-link"
              :class="{ active: item.active }"
              :aria-label="item.label"
              :title="sidebarCollapsed ? item.label : undefined"
              @click="handleNav(item.label)"
            >
              <component :is="item.icon" class="sidebar-link-icon" />
              <span class="sidebar-link-label">{{ item.label }}</span>
            </button>
          </template>
        </nav>

        <div class="sidebar-divider" />

        <nav class="sidebar-nav sidebar-nav-secondary" aria-label="辅助导航">
          <button
            v-for="item in secondaryNav"
            :key="item.label"
            type="button"
            class="sidebar-link"
            :aria-label="item.label"
            :title="sidebarCollapsed ? item.label : undefined"
            @click="handleNav(item.label)"
          >
            <component :is="item.icon" class="sidebar-link-icon" />
            <span class="sidebar-link-label">{{ item.label }}</span>
          </button>
        </nav>

        <div class="sidebar-spacer" />

        <button
          type="button"
          class="make-agent-card"
          :class="{ 'is-icon-only': sidebarCollapsed }"
          :style="sidebarCollapsed ? undefined : { backgroundImage: `url(${makeUrl})` }"
          :aria-label="sidebarCollapsed ? '创建专属智能体' : undefined"
          @click="createAgent"
        >
          <span class="sr-only">创建专属智能体</span>
          <span v-if="sidebarCollapsed" class="make-agent-icon-only" aria-hidden="true">
            <IconPlus />
          </span>
          <span v-else class="make-agent-action">
            <IconPlus />
            创建智能体
          </span>
        </button>
      </aside>

      <section class="agent-main">
        <section class="token-record-card" aria-label="Token使用记录">
          <div class="token-record-main">
            <header class="token-record-topline">
              <div class="token-record-title-stack">
                <div class="token-record-title">
                  <h2>Token使用记录</h2>
                  <IconInfo aria-hidden="true" />
                </div>

                <div class="token-range-tabs" role="tablist" aria-label="Token 时间范围">
                  <button
                    v-for="range in tokenRangeTabs"
                    :key="range.periodCode"
                    type="button"
                    class="token-range-tab"
                    :class="{ active: selectedTokenPeriodCode === range.periodCode }"
                    role="tab"
                    :aria-selected="selectedTokenPeriodCode === range.periodCode"
                    @click="selectTokenPeriod(range.periodCode)"
                  >
                    {{ range.label }}
                  </button>
                </div>
              </div>

              <div class="token-record-filters">
                <button type="button" class="token-filter-button" disabled>
                  <span>{{ tokenDateRangeLabel }}</span>
                  <IconCalendarDays aria-hidden="true" />
                </button>
                <button type="button" class="token-filter-button token-filter-select" disabled>
                  <span>全部模块</span>
                  <IconChevronDown aria-hidden="true" />
                </button>
              </div>
            </header>

            <AppStateBlock
              v-if="tokenUsageStateType"
              class="token-record-state"
              :type="tokenUsageStateType"
              :title="tokenUsageStateTitle"
              :description="tokenUsageStateDescription"
              :action-label="tokenUsageStateActionLabel"
              @action="refreshTokenUsage"
            />

            <div v-else class="token-record-body">
              <div class="usage-chart-panel">
                <div
                  ref="usageTrendChartRef"
                  class="usage-trend-chart"
                  aria-label="Token 消耗折线图"
                />
              </div>

              <div class="token-ranking-panel">
                <h3>智能体消耗排行</h3>
                <div
                  ref="rankingChartRef"
                  class="ranking-chart"
                  aria-label="智能体 Token 消耗排行柱状图"
                />

                <button type="button" class="ranking-more-button" @click="openTokenDashboard">
                  查看看板
                  <IconChevronDown aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <aside class="token-distribution-panel" aria-label="Token 消耗分布">
            <h2>Token 消耗分布</h2>

            <AppStateBlock
              v-if="tokenUsageStateType"
              class="token-distribution-state"
              :type="tokenUsageStateType"
              :title="tokenUsageStateTitle"
              :description="tokenUsageStateDescription"
              :action-label="tokenUsageStateActionLabel"
              size="sm"
              variant="inline"
              @action="refreshTokenUsage"
            />

            <template v-else>
              <div class="token-distribution-body">
                <div
                  ref="distributionPieChartRef"
                  class="distribution-pie-chart"
                  aria-label="Token 总消耗环形图"
                />

                <ul class="distribution-legend">
                  <li v-for="item in tokenDistribution" :key="item.label">
                    <span class="legend-swatch" :style="{ backgroundColor: item.color }" />
                    <span>{{ item.label }}</span>
                    <strong>{{ item.percentLabel }}</strong>
                  </li>
                </ul>
              </div>

              <div class="token-week-summary">
                <span class="week-summary-icon">
                  <IconCalendarDays aria-hidden="true" />
                </span>
                <div>
                  <p>
                    {{ selectedTokenPeriodLabel }}总消耗
                    <strong>{{ formatTokenNumber(tokenTotalConsumption) }}</strong>
                    <IconTrendingUp aria-hidden="true" />
                  </p>
                  <span>日均消耗 {{ formatTokenNumber(tokenDailyAverage) }} Tokens</span>
                </div>
              </div>
            </template>
          </aside>
        </section>

        <!-- banner 暂时隐藏
      <section
        class="hero-banner"
        :style="{ backgroundImage: `url(${bannerUrl})` }"
        aria-label="AI 赋能，智能无限"
      />
      -->

        <section class="catalog-toolbar" aria-label="智能体筛选">
          <div class="category-tabs" role="tablist" aria-label="分类筛选">
            <button
              v-for="tab in categoryTabs"
              :key="tab.key"
              type="button"
              class="category-tab"
              :class="{ active: activeCategory === tab.key }"
              role="tab"
              :aria-selected="activeCategory === tab.key"
              @click="selectCategory(tab.key)"
            >
              {{ tab.label }}
              <span>{{ tab.count }}</span>
            </button>
          </div>

          <div class="toolbar-actions">
            <label class="search-box">
              <span class="sr-only">搜索智能体或能力</span>
              <input
                v-model="searchKeyword"
                type="search"
                placeholder="搜索智能体或能力..."
                autocomplete="off"
              />
              <IconSearch class="search-icon" />
            </label>

            <button type="button" class="sort-button" @click="showToast('已按推荐排序')">
              推荐排序
              <IconChevronDown />
            </button>
          </div>
        </section>

        <section class="agent-grid" aria-label="智能体列表">
          <button
            v-for="agent in visibleAgents"
            :key="agent.id"
            type="button"
            class="agent-card"
            :class="{ selected: selectedAgent?.id === agent.id }"
            @click="openAgent(agent)"
          >
            <div class="agent-card-body">
              <span class="agent-icon" :class="getAgentVisual(agent).tone">
                <component :is="getAgentVisual(agent).icon" />
              </span>

              <div class="agent-card-copy">
                <div class="agent-card-title-row">
                  <h2>{{ agent.name }}</h2>
                  <span v-if="agent.recommended" class="favorite-mark" aria-label="推荐">
                    <IconStar />
                  </span>
                </div>
                <p class="agent-description">{{ agent.description }}</p>
              </div>
            </div>

            <div class="agent-card-footer">
              <span class="status-pill" :class="statusClass(agent.permissionState)">
                {{ permissionLabels[agent.permissionState] }}
              </span>
              <span class="agent-card-source">来自：{{ agent.category }}</span>
            </div>
          </button>

          <button
            v-if="shouldShowMoreAbility"
            type="button"
            class="agent-card more-ability-card"
            @click="handleNav('能力 Skills')"
          >
            <div class="agent-card-body">
              <span class="agent-icon icon-blue">
                <IconPlus />
              </span>

              <div class="agent-card-copy">
                <h2>更多能力</h2>
                <p class="agent-description">更多智能体与技能正在路上，敬请期待。</p>
              </div>
            </div>

            <img :src="moreAbilityUrl" alt="" class="more-ability-art" aria-hidden="true" />

            <div class="agent-card-footer">
              <span class="status-placeholder" aria-hidden="true" />
              <span class="agent-card-source">来自：智体中心</span>
            </div>
          </button>

          <AppStateBlock
            v-if="visibleAgents.length === 0"
            class="agent-grid-empty"
            type="empty"
            title="没有匹配的智能体"
            description="换个关键词，或切换分类查看可用智能体。"
            size="sm"
            variant="inline"
          />
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
  display: flex;
  width: 100%;
  height: 100vh;
  flex-direction: column;
  overflow: hidden;
  background: radial-gradient(circle at 78% 0%, rgba(207, 229, 255, 0.75) 0, transparent 360px),
    linear-gradient(130deg, #f8fbff 0%, #edf6ff 52%, #f8fcff 100%);
  color: #111827;
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}

.agent-center-shell {
  --sidebar-width: clamp(250px, 15vw, 288px);
  --sidebar-collapsed-width: 76px;
  --sidebar-card-margin: clamp(19px, 1.15vw, 22px);
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

.agent-sidebar {
  position: relative;
  display: flex;
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  flex-direction: column;
  overflow: hidden;
  background: rgba(252, 253, 255, 0.78);
  transition:
    width 240ms ease,
    min-width 240ms ease;
}

.sidebar-link-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar-link-row .sidebar-link {
  flex: 1;
  min-width: 0;
}

.is-sidebar-collapsed .sidebar-link-row {
  flex-direction: column;
  gap: 10px;
}

.is-sidebar-collapsed .sidebar-link-row .sidebar-collapse-toggle {
  order: -1;
}

.is-sidebar-collapsed .sidebar-link-row .sidebar-link {
  width: 100%;
}

.sidebar-collapse-toggle {
  display: inline-flex;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(207, 224, 248, 0.95);
  border-radius: 11px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 249, 255, 0.98) 100%);
  color: #355a8f;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 6px 16px rgba(93, 130, 181, 0.1);
  padding: 0;
  transition:
    background 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.sidebar-collapse-toggle-icon {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
}

.sidebar-collapse-toggle-icon svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.35;
}

.sidebar-collapse-toggle:hover,
.sidebar-collapse-toggle:focus-visible {
  border-color: rgba(122, 168, 255, 0.55);
  background: linear-gradient(180deg, #ffffff 0%, #edf4ff 100%);
  color: #075df4;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 0 0 3px rgba(42, 125, 255, 0.1),
    0 8px 18px rgba(61, 122, 211, 0.14);
  outline: none;
}

.sidebar-collapse-toggle:active {
  transform: translateY(1px);
}

.is-sidebar-collapsed {
  --sidebar-width: var(--sidebar-collapsed-width);
}

.is-sidebar-collapsed .sidebar-nav {
  margin: 28px 10px 0;
}

.is-sidebar-collapsed .sidebar-link-label,
.is-sidebar-collapsed .make-agent-action {
  max-width: 0;
  opacity: 0;
}

.sidebar-nav {
  display: grid;
  gap: 10px;
  margin: 32px 19px 0;
  transition: margin 240ms ease;
}

.sidebar-nav-secondary {
  margin-top: 24px;
}

.sidebar-link {
  display: flex;
  height: 52px;
  width: 100%;
  align-items: center;
  gap: 15px;
  border: 0;
  border-radius: 13px;
  background: transparent;
  padding: 0 18px;
  color: #31527f;
  font-size: 16px;
  font-weight: 650;
  text-align: left;
  transition:
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease,
    padding 240ms ease,
    gap 240ms ease;
}

.is-sidebar-collapsed .sidebar-link {
  justify-content: center;
  gap: 0;
  padding: 0;
}

.sidebar-link-label {
  max-width: 160px;
  overflow: hidden;
  white-space: nowrap;
  transition:
    opacity 180ms ease,
    max-width 240ms ease;
}

.sidebar-link:hover,
.sidebar-link:focus-visible {
  color: #075df4;
  outline: none;
}

.sidebar-link:active {
  transform: translateY(1px);
}

.sidebar-link.active {
  color: #0862ff;
  font-weight: 800;
}

.sidebar-link-icon {
  width: 22px;
  height: 22px;
  stroke-width: 2.4;
}

.sidebar-divider {
  height: 1px;
  margin: 24px 28px 0;
  background: #e9f0fa;
  transition: margin 240ms ease;
}

.is-sidebar-collapsed .sidebar-divider {
  margin: 24px 14px 0;
}

.sidebar-spacer {
  flex: 1;
  min-height: 24px;
}

.make-agent-card {
  position: relative;
  display: block;
  width: auto;
  height: clamp(243px, 25.9vh, 280px);
  margin: 0 var(--sidebar-card-margin) 16px;
  overflow: hidden;
  border: 0;
  border-radius: 15px;
  background-position: center;
  background-size: cover;
  box-shadow: 0 18px 35px rgba(33, 116, 244, 0.22);
  transition:
    height 240ms ease,
    margin 240ms ease,
    box-shadow 240ms ease;
}

.make-agent-card.is-icon-only {
  display: grid;
  width: 52px;
  height: 52px;
  margin: 0 auto 16px;
  place-items: center;
  border-radius: 13px;
  background: linear-gradient(145deg, #53a0ff 0%, #0763ff 100%);
  box-shadow: 0 10px 24px rgba(30, 111, 255, 0.28);
}

.make-agent-icon-only {
  display: grid;
  place-items: center;
  color: #ffffff;
}

.make-agent-icon-only svg {
  width: 22px;
  height: 22px;
  stroke-width: 2.8;
}

.make-agent-card:focus-visible {
  outline: 3px solid rgba(35, 112, 255, 0.34);
  outline-offset: 3px;
}

.make-agent-action {
  position: absolute;
  top: clamp(86px, 9.2vh, 99px);
  left: clamp(22px, 1.3vw, 25px);
  display: inline-flex;
  height: clamp(35px, 3.8vh, 41px);
  min-width: clamp(128px, 7.7vw, 148px);
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 999px;
  background: #ffffff;
  color: #0966ff;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 10px 24px rgba(22, 100, 225, 0.16);
  overflow: hidden;
  white-space: nowrap;
  transition:
    opacity 180ms ease,
    max-width 240ms ease;
}

.make-agent-action svg {
  width: 16px;
  height: 16px;
  stroke-width: 3;
}

.agent-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  padding: var(--main-pad-top) var(--main-pad-right) var(--main-pad-bottom) var(--main-pad-left);
}

.search-box {
  position: relative;
  display: block;
  width: clamp(302px, 18vw, 346px);
}

.search-box input {
  width: 100%;
  height: 42px;
  border: 1px solid rgba(219, 230, 248, 0.95);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 8px 22px rgba(93, 130, 181, 0.12);
  color: #17345f;
  font-size: 14px;
  font-weight: 600;
  outline: none;
  padding: 0 48px 0 23px;
}

.search-box input::placeholder {
  color: #7892b7;
}

.search-box input:focus {
  border-color: rgba(50, 122, 255, 0.45);
  box-shadow: 0 8px 22px rgba(93, 130, 181, 0.12);
}

.search-icon {
  position: absolute;
  top: 11px;
  right: 18px;
  width: 20px;
  height: 20px;
  color: #153b76;
  stroke-width: 2.5;
}

.token-record-card {
  display: grid;
  grid-template-columns: minmax(0, 1.9fr) minmax(282px, 0.9fr);
  flex: 0 0 auto;
  height: clamp(336px, 19vw, 392px);
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(219, 231, 248, 0.96);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 18px 42px rgba(72, 110, 165, 0.13);
  margin-top: 18px;
  padding: 16px clamp(18px, 1.45vw, 26px) 14px;
}

.token-record-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding-right: clamp(16px, 1.3vw, 24px);
}

.token-record-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.token-record-title-stack {
  min-width: 0;
}

.token-record-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #172033;
}

.token-record-title h2,
.token-distribution-panel h2 {
  margin: 0;
  color: #172033;
  font-size: clamp(18px, 1.2vw, 22px);
  font-weight: 900;
  line-height: 1.16;
  letter-spacing: 0;
}

.token-record-title svg {
  width: 16px;
  height: 16px;
  color: #9aaac2;
  stroke-width: 2.6;
}

.token-range-tabs {
  display: grid;
  width: 134px;
  height: 32px;
  grid-template-columns: repeat(3, 1fr);
  align-items: center;
  border-radius: 999px;
  background: #eef4fc;
  margin-top: 14px;
  padding: 3px;
}

.token-range-tab {
  display: inline-flex;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #617391;
  font-size: 14px;
  font-weight: 850;
  line-height: 1;
  transition:
    background 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.token-range-tab.active {
  background: linear-gradient(180deg, #3788ff 0%, #126cff 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    0 8px 16px rgba(35, 114, 245, 0.26);
  color: #ffffff;
}

.token-range-tab:focus-visible,
.token-filter-button:focus-visible,
.ranking-more-button:focus-visible {
  outline: 2px solid rgba(26, 111, 255, 0.28);
  outline-offset: 2px;
}

.token-range-tab:active,
.token-filter-button:active,
.ranking-more-button:active {
  transform: translateY(1px);
}

.token-record-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.token-filter-button {
  display: inline-flex;
  height: 38px;
  min-width: 164px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #dfe8f4;
  border-radius: 13px;
  background: #ffffff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 6px 15px rgba(69, 101, 148, 0.08);
  color: #617391;
  font-size: 13px;
  font-weight: 850;
  padding: 0 14px;
  white-space: nowrap;
}

.token-filter-select {
  min-width: 136px;
}

.token-filter-button svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #627795;
  stroke-width: 2.5;
}

.token-record-body {
  display: grid;
  grid-template-columns: minmax(292px, 1fr) minmax(246px, 0.86fr);
  flex: 1;
  gap: clamp(16px, 1.45vw, 24px);
  align-items: stretch;
  min-height: 0;
  margin-top: 4px;
}

.token-record-state {
  flex: 1;
  min-height: 0;
  margin-top: 12px;
}

.usage-chart-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  padding-top: 0;
}

.usage-trend-chart {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.token-ranking-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border-left: 1px solid #e2ebf6;
  padding-left: clamp(16px, 1.4vw, 24px);
}

.token-ranking-panel h3 {
  margin: 0 0 5px;
  color: #172033;
  font-size: clamp(15px, 0.98vw, 18px);
  font-weight: 900;
  line-height: 1.2;
}

.ranking-chart {
  flex: 1;
  width: 100%;
  min-height: 0;
}

.ranking-more-button {
  display: inline-flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 0;
  background: transparent;
  color: #2f7fff;
  font-size: 13px;
  font-weight: 900;
  margin: 7px auto 0;
  padding: 0 10px;
}

.ranking-more-button svg {
  width: 14px;
  height: 14px;
  rotate: -90deg;
  stroke-width: 3;
}

.token-distribution-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-left: 1px solid #e2ebf6;
  padding-left: clamp(18px, 1.45vw, 26px);
}

.token-distribution-state {
  flex: 1;
  margin-top: 18px;
}

.token-distribution-body {
  display: flex;
  min-height: 0;
  align-items: center;
  gap: clamp(15px, 1.35vw, 24px);
  margin-top: 16px;
}

.distribution-pie-chart {
  width: clamp(128px, 8.8vw, 158px);
  height: clamp(128px, 8.8vw, 158px);
  flex: 0 0 auto;
}

.distribution-legend {
  display: grid;
  flex: 1;
  gap: 10px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.distribution-legend li {
  display: grid;
  grid-template-columns: 12px minmax(38px, 1fr) 52px;
  align-items: center;
  gap: 10px;
  color: #35425a;
  font-size: 13px;
  font-weight: 850;
}

.legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  box-shadow: 0 4px 10px rgba(58, 125, 231, 0.16);
}

.distribution-legend strong {
  color: #73829a;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.token-week-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 54px;
  border: 1px solid #dbe8fb;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fbff 0%, #f2f7ff 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88);
  margin-top: auto;
  padding: 9px 14px;
}

.week-summary-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid #d5e6ff;
  border-radius: 8px;
  background: #ffffff;
  color: #2e7bff;
}

.week-summary-icon svg {
  width: 17px;
  height: 17px;
  stroke-width: 2.6;
}

.token-week-summary p {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 5px;
  color: #344057;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.1;
}

.token-week-summary p strong,
.token-week-summary p svg {
  color: #43bc65;
}

.token-week-summary p svg {
  width: 13px;
  height: 13px;
  stroke-width: 3;
}

.token-week-summary span {
  color: #6f7f98;
  font-size: 13px;
  font-weight: 850;
}

.hero-banner {
  flex: 0 0 auto;
  height: var(--banner-height);
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.95);
  border-radius: 17px;
  background: #dff0ff;
  background-position: center 42%;
  background-repeat: no-repeat;
  background-size: cover;
  box-shadow: 0 18px 35px rgba(51, 125, 229, 0.16);
}

.catalog-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 18px;
  margin-bottom: 12px;
}

.toolbar-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.category-tab,
.sort-button {
  border: 0;
  background: transparent;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.category-tab {
  display: inline-flex;
  height: 38px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 999px;
  padding: 0 16px;
  font-size: 15px;
  font-weight: 500;
  color: #64748b;
  position: relative;
}

.category-tab::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  background-color: #2563eb;
  transition: width 200ms ease;
  border-radius: 2px 2px 0 0;
}

.category-tab span {
  display: inline-flex;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  padding: 0 7px;
  margin-left: 2px;
  transition: all 200ms ease;
}

.category-tab.active {
  color: #2563eb;
  font-weight: 700;
}

.category-tab.active::after {
  width: 100%;
}

.category-tab.active span {
  background: #eff6ff;
  color: #2563eb;
}

.category-tab:hover:not(.active) {
  color: #2563eb;
}

.category-tab:hover:not(.active) span {
  background: #e0e7ff;
  color: #2563eb;
}

.category-tab:focus-visible,
.sort-button:focus-visible {
  outline: 2px solid rgba(15, 23, 42, 0.2);
  outline-offset: 2px;
  border-radius: 6px;
}

.category-tab:active,
.sort-button:active {
  transform: scale(0.97);
}

.sort-button {
  display: inline-flex;
  height: 38px;
  min-width: 130px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.sort-button:hover {
  border-color: #cbd5e1;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.sort-button svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.agent-grid {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: repeat(var(--agent-grid-columns), minmax(0, 1fr));
  align-content: start;
  gap: var(--grid-gap-y) var(--grid-gap-x);
  min-height: 0;
  margin-top: 12px;
  overflow-y: auto;
  padding: 4px 4px 8px 0;
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
  min-height: var(--agent-card-min-height);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(225, 235, 249, 0.95);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 13px 28px rgba(91, 131, 184, 0.1);
  padding: 16px 16px 14px;
  color: inherit;
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

.agent-card.selected {
  border-color: rgba(28, 111, 255, 0.72);
  box-shadow:
    0 0 0 3px rgba(42, 125, 255, 0.13),
    0 18px 34px rgba(61, 122, 211, 0.16);
}

.agent-card-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.agent-card-copy {
  min-width: 0;
  flex: 1;
}

.agent-card-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.agent-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
}

.agent-icon svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.7;
}

.icon-blue {
  background: #eaf4ff;
  color: #126cff;
}

.icon-teal {
  background: #e9fbf7;
  color: #19bfae;
}

.icon-orange {
  background: #fff2e5;
  color: #ff7a00;
}

.icon-cyan {
  background: #e8fbff;
  color: #16b9c1;
}

.favorite-mark {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 50%;
  background: #fff7e6;
  color: #f6a400;
}

.favorite-mark svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
  stroke-width: 2;
}

.agent-card h2 {
  margin: 0;
  color: #101827;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.3;
}

.agent-description {
  display: -webkit-box;
  margin: 6px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  color: #395982;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.agent-card-source {
  color: #6d83a8;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
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

.agent-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 12px;
}

.status-pill {
  display: inline-flex;
  height: 18px;
  align-items: center;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  padding: 0 7px;
}

.status-pill.is-available {
  background: #d8f8ed;
  color: #10a87c;
}

.status-pill.is-pending {
  background: #fff0d7;
  color: #f39419;
}

.more-ability-card {
  background: rgba(255, 255, 255, 0.9);
}

.more-ability-card .agent-description {
  max-width: 100%;
}

.more-ability-art {
  position: absolute;
  right: -6px;
  bottom: -8px;
  width: clamp(88px, 28%, 108px);
  pointer-events: none;
}

.status-placeholder {
  display: block;
  width: 1px;
  height: 24px;
}

.agent-grid-empty {
  grid-column: 1 / -1;
  align-self: start;
  margin: 24px 0;
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

  .token-record-card {
    grid-template-columns: minmax(0, 1.8fr) minmax(260px, 0.92fr);
  }

  .token-record-body {
    grid-template-columns: minmax(260px, 1fr) minmax(228px, 0.86fr);
  }
}

@media (max-width: 1024px) {
  .agent-center-shell {
    --sidebar-width: 220px;
    --main-pad-top: 18px;
    --main-pad-right: 12px;
    --main-pad-bottom: 32px;
    --main-pad-left: 12px;
    --banner-height: 170px;
    --agent-grid-columns: 3;
    --agent-card-min-height: 148px;
    overflow: hidden;
  }

  .agent-sidebar {
    width: var(--sidebar-width);
    min-width: var(--sidebar-width);
  }

  .agent-main {
    padding: var(--main-pad-top) var(--main-pad-right) var(--main-pad-bottom) var(--main-pad-left);
  }

  .token-record-card {
    grid-template-columns: 1fr;
    gap: 18px;
    height: auto;
    min-height: auto;
  }

  .token-record-main {
    padding-right: 0;
  }

  .token-distribution-panel {
    border-top: 1px solid #e2ebf6;
    border-left: 0;
    padding-top: 18px;
    padding-left: 0;
  }
}

@media (max-width: 760px) {
  .agent-center-shell {
    --banner-height: 128px;
    --agent-grid-columns: 2;
    --agent-card-min-height: 152px;
    display: flex;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }

  .agent-center-shell.is-sidebar-collapsed {
    --sidebar-width: 100%;
  }

  .sidebar-collapse-toggle {
    display: none;
  }

  .agent-sidebar {
    width: 100%;
    min-width: 0;
    border-right: 0;
    border-bottom: 1px solid rgba(220, 232, 250, 0.8);
    padding-bottom: 14px;
  }

  .sidebar-nav {
    display: flex;
    overflow-x: auto;
    margin: 20px 16px 0;
    padding-bottom: 2px;
  }

  .sidebar-link {
    width: auto;
    min-width: fit-content;
    padding: 0 16px;
  }

  .sidebar-divider,
  .sidebar-nav-secondary,
  .make-agent-card {
    display: none;
  }

  .agent-main {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    padding: 18px 8px 28px;
  }

  .toolbar-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1 1 auto;
    min-width: 0;
    width: auto;
    max-width: 360px;
  }

  .token-record-card {
    border-radius: 17px;
    margin-top: 14px;
    padding: 16px;
  }

  .token-record-topline,
  .token-record-filters,
  .token-record-body,
  .token-distribution-body {
    flex-direction: column;
  }

  .token-record-topline,
  .token-record-filters {
    align-items: stretch;
  }

  .token-record-filters {
    width: 100%;
  }

  .token-filter-button,
  .token-filter-select {
    width: 100%;
  }

  .token-record-body {
    display: grid;
    grid-template-columns: 1fr;
  }

  .token-ranking-panel {
    border-top: 1px solid #e2ebf6;
    border-left: 0;
    padding-top: 14px;
    padding-left: 0;
  }

  .token-distribution-body {
    align-items: center;
  }

  .distribution-legend {
    width: 100%;
  }

  .token-week-summary {
    margin-top: 16px;
  }

  .hero-banner {
    height: 168px;
  }

  .catalog-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar-actions {
    justify-content: flex-end;
  }

  .category-tabs {
    gap: 10px;
  }

  .category-tab {
    min-width: auto;
  }
}
</style>
