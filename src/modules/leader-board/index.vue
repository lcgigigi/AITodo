<script setup lang="ts">
import type { Component } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import IconBlocks from '~icons/lucide/blocks'
import IconBox from '~icons/lucide/box'
import IconBriefcaseBusiness from '~icons/lucide/briefcase-business'
import IconBuilding2 from '~icons/lucide/building-2'
import IconCalendarDays from '~icons/lucide/calendar-days'
import IconCode2 from '~icons/lucide/code-2'
import IconFlame from '~icons/lucide/flame'
import IconGrid2x2 from '~icons/lucide/grid-2x2'
import IconHeadphones from '~icons/lucide/headphones'
import IconInfo from '~icons/lucide/info'
import IconMegaphone from '~icons/lucide/megaphone'
import IconSparkles from '~icons/lucide/sparkles'
import IconTrendingUp from '~icons/lucide/trending-up'
import IconTrophy from '~icons/lucide/trophy'
import IconUserRound from '~icons/lucide/user-round'
import {
  getCurrentMonthKey,
  loadAdminTokenDashboard,
  type AdminTokenQueryType,
  type AdminTokenUsageDashboard,
} from '@/modules/token-usage/token-usage.service'
import { formatTokenCompact, formatTokenNumber } from '@/modules/token-usage/token-usage.formatters'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { useECharts } from '@/shared/composables/useECharts'

defineOptions({
  name: 'LeaderBoardPage',
})

interface DepartmentUsage {
  id: string
  rank: number
  name: string
  tokens: string
  value: number
  share: number
  color: string
  icon: Component
}

interface AppUsage {
  id: string
  name: string
  tokens: string
  value: number
  share: number
  change?: number
  color: string
}

interface StatCard {
  id: string
  label: string
  value: string
  meta: string
  delta?: string
  icon: Component
  tone: 'blue' | 'orange' | 'purple'
}

interface TrendDataset {
  labels: string[]
  total: number[]
  selectedIndex: number
  selectedLabel: string
  selectedTotal: number
}

const timeModes = ['月', '年']

const selectedTimeMode = ref('月')
const selectedMonth = ref(getCurrentMonthKey())
const tokenDashboard = ref<AdminTokenUsageDashboard | null>(null)
const isDashboardLoading = ref(true)
const dashboardError = ref('')

const dashboardQueryType = computed<AdminTokenQueryType>(() =>
  selectedTimeMode.value === '年' ? 'year' : 'month',
)

function formatPeriodPoint(period: string, queryType: AdminTokenQueryType) {
  if (queryType === 'year') {
    const [, month] = period.split('-')
    return month ? `${Number(month)}月` : period
  }

  const [, month, day] = period.split('-')
  return month && day ? `${month}-${day}` : period
}

function formatPeriodRangeValue(value: string) {
  if (value.length === 7) return value

  const [, month, day] = value.split('-')
  return month && day ? `${month}-${day}` : value
}

const periodRangeLabel = computed(() => {
  const dashboard = tokenDashboard.value
  if (!dashboard?.startPeriod || !dashboard?.endPeriod) return '同步中…'

  return `${formatPeriodRangeValue(dashboard.startPeriod)} ~ ${formatPeriodRangeValue(dashboard.endPeriod)}`
})

const periodDisplayName = computed(() => {
  const rangeLabel = periodRangeLabel.value

  if (selectedTimeMode.value === '年') {
    return rangeLabel === '同步中…' ? '当年累计' : `当年累计（${rangeLabel}）`
  }

  return rangeLabel === '同步中…'
    ? `${selectedMonth.value} 全月`
    : `${selectedMonth.value} 全月（${rangeLabel}）`
})

const departmentColors = ['#1273f8', '#7a5cff', '#1fb7e8', '#18bf9e', '#ff9418', '#6a6cff']
const departmentIcons = [
  IconCode2,
  IconBox,
  IconMegaphone,
  IconHeadphones,
  IconBriefcaseBusiness,
  IconUserRound,
]
const moduleColors: Record<string, string> = {
  codeAssist: '#1273f8',
  libaiQa: '#8656f5',
  fileAnalysis: '#20aaf3',
  smartTodo: '#1fc6bd',
}

const BOARD_DESIGN_WIDTH = 2000
const BOARD_DESIGN_HEIGHT = 1125
const boardScale = ref(1)
const boardOffsetX = ref(0)
const boardOffsetY = ref(0)

const trendChartRef = ref<HTMLElement | null>(null)
const appDonutChartRef = ref<HTMLElement | null>(null)

const { getChart, resizeCharts, disposeCharts } = useECharts()
let resizeObserver: ResizeObserver | null = null

const boardCanvasStyle = computed(() => ({
  width: `${BOARD_DESIGN_WIDTH}px`,
  height: `${BOARD_DESIGN_HEIGHT}px`,
  transform: `translate3d(${boardOffsetX.value}px, ${boardOffsetY.value}px, 0) scale(${boardScale.value})`,
}))

function clampTrendIndex(index: number, length: number) {
  return Math.min(Math.max(index, 0), length - 1)
}

function createTrendDataset(
  labels: string[],
  total: number[],
  selectedIndex: number,
): TrendDataset {
  const safeIndex = clampTrendIndex(selectedIndex, labels.length)

  return {
    labels,
    total,
    selectedIndex: safeIndex,
    selectedLabel: labels[safeIndex],
    selectedTotal: total[safeIndex] ?? 0,
  }
}

const trendDataset = computed(() => {
  const dashboard = tokenDashboard.value
  if (!dashboard?.trendList.length) {
    return createTrendDataset([periodDisplayName.value], [0], 0)
  }

  const labels = dashboard.trendList.map((point) =>
    formatPeriodPoint(point.period, dashboard.queryType),
  )
  const totals = dashboard.trendList.map((point) => point.tokenUsage)

  return createTrendDataset(labels, totals, totals.length - 1)
})

const departments = computed<DepartmentUsage[]>(() => {
  const list = tokenDashboard.value?.deptDistributionList ?? []
  const total = list.reduce((sum, dept) => sum + dept.tokenUsage, 0)

  return [...list]
    .sort((a, b) => b.tokenUsage - a.tokenUsage)
    .map((dept, index) => ({
      id: dept.deptId || dept.deptName,
      rank: index + 1,
      name: dept.deptName,
      tokens: formatTokenCompact(dept.tokenUsage),
      value: dept.tokenUsage,
      share: total > 0 ? (dept.tokenUsage / total) * 100 : 0,
      color: departmentColors[index % departmentColors.length],
      icon: departmentIcons[index % departmentIcons.length],
    }))
})

const appUsages = computed<AppUsage[]>(() => {
  const list = tokenDashboard.value?.moduleDistributionList ?? []
  const total = list.reduce((sum, module) => sum + module.tokenUsage, 0)

  return [...list]
    .sort((a, b) => b.tokenUsage - a.tokenUsage)
    .map((module) => ({
      id: module.moduleCode,
      name: module.moduleName,
      tokens: formatTokenCompact(module.tokenUsage),
      value: module.tokenUsage,
      share: total > 0 ? (module.tokenUsage / total) * 100 : 0,
      color: moduleColors[module.moduleCode] ?? '#8196bf',
    }))
})

const departmentStats = computed<StatCard[]>(() => {
  const topDepartment = departments.value[0]

  return [
    {
      id: 'total',
      label: '总部门数',
      value: formatTokenNumber(tokenDashboard.value?.deptDistributionList.length ?? 0),
      meta: '二级部门',
      icon: IconBuilding2,
      tone: 'blue',
    },
    {
      id: 'top',
      label: '最高部门',
      value: topDepartment?.name ?? '--',
      meta: topDepartment?.tokens ?? '--',
      icon: IconTrophy,
      tone: 'blue',
    },
    {
      id: 'usage',
      label: '部门总消耗',
      value: formatTokenCompact(tokenDashboard.value?.totalTokenUsage ?? 0),
      meta: periodDisplayName.value,
      icon: IconTrendingUp,
      tone: 'blue',
    },
  ]
})

const appStats = computed<StatCard[]>(() => {
  const topApp = appUsages.value[0]

  return [
    {
      id: 'active',
      label: '活跃模块数',
      value: formatTokenNumber(appUsages.value.length),
      meta: periodDisplayName.value,
      icon: IconGrid2x2,
      tone: 'blue',
    },
    {
      id: 'top',
      label: '最高消耗模块',
      value: topApp?.name ?? '--',
      meta: topApp?.tokens ?? '--',
      icon: IconFlame,
      tone: 'orange',
    },
    {
      id: 'total',
      label: '总消耗',
      value: formatTokenCompact(tokenDashboard.value?.totalTokenUsage ?? 0),
      meta: periodDisplayName.value,
      icon: IconBlocks,
      tone: 'purple',
    },
  ]
})

const maxDepartmentValue = computed(() =>
  Math.max(...departments.value.map((dept) => dept.value), 1),
)
const maxAppValue = computed(() => Math.max(...appUsages.value.map((app) => app.value), 1))
const hasDashboardContent = computed(() => {
  const dashboard = tokenDashboard.value
  if (!dashboard) return false

  return (
    dashboard.totalTokenUsage > 0 ||
    dashboard.deptDistributionList.length > 0 ||
    dashboard.moduleDistributionList.length > 0 ||
    dashboard.trendList.length > 0
  )
})
const dashboardStateType = computed<'loading' | 'empty' | 'error' | null>(() => {
  if (isDashboardLoading.value && !hasDashboardContent.value) return 'loading'
  if (dashboardError.value) return 'error'
  if (!hasDashboardContent.value) return 'empty'
  return null
})
const dashboardStateTitle = computed(() => {
  if (dashboardStateType.value === 'loading') return '正在加载 Token 看板数据'
  if (dashboardStateType.value === 'error') return 'Token 看板数据未能加载'
  return '暂无 Token 看板数据'
})
const dashboardStateDescription = computed(() => {
  if (dashboardStateType.value === 'loading') return '正在同步部门与模块维度的消耗数据。'
  if (dashboardStateType.value === 'error') return dashboardError.value
  return '当前筛选范围内还没有可展示的消耗数据。'
})
const dashboardStateActionLabel = computed(() => {
  if (dashboardStateType.value === 'error') return '重新加载'
  if (dashboardStateType.value === 'empty') return '刷新数据'
  return ''
})
const chartTextStyle = {
  color: '#526b9f',
  fontFamily:
    '"Avenir Next", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, sans-serif',
}

function formatTrendAxis(value: number) {
  return value === 0 ? '0' : formatTokenCompact(value)
}

function makeAreaGradient(color: string) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color },
    { offset: 1, color: 'rgba(255, 255, 255, 0.02)' },
  ])
}

function getProgressWidth(value: number, maxValue: number) {
  return `${Math.max(8, (value / Math.max(maxValue, 1)) * 100)}%`
}

function renderTrendChart() {
  const chart = getChart(trendChartRef.value)
  if (!chart) return

  const dataset = trendDataset.value
  const xAxisLabelInterval = dataset.labels.length <= 8 ? 0 : (index: number) => index % 4 === 0
  const maxTrendValue = Math.max(...dataset.total, 1)

  chart.setOption(
    {
      animationDuration: 820,
      grid: { top: 34, right: 28, bottom: 34, left: 54 },
      color: ['#126fff'],
      tooltip: {
        trigger: 'axis',
        confine: true,
        borderWidth: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        textStyle: { ...chartTextStyle, color: '#0d1d4a', fontWeight: 700 },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : []
          const title = (list[0] as { axisValueLabel?: string } | undefined)?.axisValueLabel ?? ''
          const point = list.find(
            (item) => (item as { seriesName?: string }).seriesName === '总量',
          ) as { value?: number } | undefined

          return `${title}<br/>${formatTokenNumber(Number(point?.value ?? 0))} Tokens`
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dataset.labels,
        axisLine: { lineStyle: { color: '#d7e4f8' } },
        axisTick: { show: false },
        axisLabel: {
          ...chartTextStyle,
          interval: xAxisLabelInterval,
          fontSize: 14,
          fontWeight: 600,
          margin: 13,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: Math.ceil(maxTrendValue * 1.15),
        axisLine: { show: true, lineStyle: { color: '#d7e4f8' } },
        axisTick: { show: false },
        axisLabel: {
          ...chartTextStyle,
          fontSize: 14,
          fontWeight: 600,
          formatter: (value: number) => formatTrendAxis(value),
          margin: 14,
        },
        splitLine: { lineStyle: { color: '#dce8fa', type: 'dashed' } },
      },
      series: [
        {
          name: '总量',
          type: 'line',
          data: dataset.total,
          smooth: false,
          symbol: 'none',
          lineStyle: { width: 3, color: '#126fff' },
          areaStyle: { color: makeAreaGradient('rgba(18, 111, 255, 0.2)') },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: '#a7bde3', width: 1, type: 'dashed' },
            data: [{ xAxis: dataset.selectedLabel }],
          },
          z: 5,
        },
        {
          name: '选中总量',
          type: 'scatter',
          tooltip: { show: false },
          data: [[dataset.selectedLabel, dataset.selectedTotal]],
          symbolSize: 20,
          itemStyle: {
            color: '#126fff',
            borderColor: '#ffffff',
            borderWidth: 4,
            shadowBlur: 10,
            shadowColor: 'rgba(18, 111, 255, 0.36)',
          },
          z: 9,
        },
      ],
    } as echarts.EChartsCoreOption,
    true,
  )
}

function renderAppDonutChart() {
  const chart = getChart(appDonutChartRef.value)
  if (!chart) return
  const apps = appUsages.value
  const total = apps.reduce((sum, app) => sum + app.value, 0)

  chart.setOption(
    {
      animationDuration: 760,
      color: apps.map((app) => app.color),
      title: {
        text: `总 Token\n${formatTokenCompact(total)}`,
        subtext: periodDisplayName.value,
        left: 'center',
        top: '39%',
        textStyle: {
          color: '#0d1d4a',
          fontSize: 15,
          lineHeight: 34,
          fontWeight: 800,
          fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif',
        },
        subtextStyle: {
          ...chartTextStyle,
          color: '#7a8db7',
          fontSize: 13,
          fontWeight: 800,
        },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        borderWidth: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        textStyle: { ...chartTextStyle, color: '#0d1d4a', fontWeight: 700 },
        formatter: (params: unknown) => {
          const item = params as { name: string; value: number; percent: number }
          return `${item.name}<br/>${formatTokenNumber(Number(item.value))} Tokens<br/>占比 ${item.percent}%`
        },
      },
      series: [
        {
          name: '应用 Token',
          type: 'pie',
          radius: ['55%', '82%'],
          center: ['50%', '50%'],
          minAngle: 6,
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 4,
            borderRadius: 6,
          },
          emphasis: {
            scale: true,
            scaleSize: 5,
          },
          data: apps.map((app) => ({
            name: app.name,
            value: app.value,
          })),
        },
      ],
    } as echarts.EChartsCoreOption,
    true,
  )
}

function renderAllCharts() {
  renderTrendChart()
  renderAppDonutChart()
}

function updateBoardScale() {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const nextScale = Math.min(
    viewportWidth / BOARD_DESIGN_WIDTH,
    viewportHeight / BOARD_DESIGN_HEIGHT,
    1,
  )

  boardScale.value = Number(nextScale.toFixed(4))
  boardOffsetX.value = Math.max(0, (viewportWidth - BOARD_DESIGN_WIDTH * boardScale.value) / 2)
  boardOffsetY.value = Math.max(0, (viewportHeight - BOARD_DESIGN_HEIGHT * boardScale.value) / 2)
}

function handleWindowResize() {
  updateBoardScale()
  resizeCharts()
}

function observeChartContainers() {
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(resizeCharts)
  const elements = [trendChartRef.value, appDonutChartRef.value].filter((el): el is HTMLElement =>
    Boolean(el),
  )

  elements.forEach((el) => resizeObserver?.observe(el))
}

async function refreshTokenDashboard() {
  isDashboardLoading.value = true
  dashboardError.value = ''

  try {
    tokenDashboard.value = await loadAdminTokenDashboard({
      queryType: dashboardQueryType.value,
      month: dashboardQueryType.value === 'month' ? selectedMonth.value : undefined,
    })
    await nextTick()
    renderAllCharts()
    observeChartContainers()
  } catch (error) {
    tokenDashboard.value = null
    dashboardError.value = error instanceof Error ? error.message : '加载 Token 看板失败'
    await nextTick()
    renderAllCharts()
  } finally {
    isDashboardLoading.value = false
  }
}

watch([selectedTimeMode, selectedMonth], async () => {
  await refreshTokenDashboard()
})

onMounted(async () => {
  updateBoardScale()
  await nextTick()
  renderAllCharts()
  observeChartContainers()
  window.addEventListener('resize', handleWindowResize, { passive: true })
  void refreshTokenDashboard()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  resizeObserver?.disconnect()
  disposeCharts()
})
</script>

<template>
  <main class="leader-board-page">
    <div class="leader-board-canvas" :style="boardCanvasStyle">
      <header class="leader-topbar">
        <div class="title-stack">
          <h1>
            <span>Token 使用领导者看板</span>
            <IconSparkles aria-hidden="true" />
          </h1>
          <p>全局视角 · 实时洞察 · 智能决策</p>
        </div>

        <div class="topbar-actions" aria-label="看板筛选操作">
          <div class="segmented-control" role="tablist" aria-label="统计周期">
            <button
              v-for="mode in timeModes"
              :key="mode"
              type="button"
              role="tab"
              :aria-selected="selectedTimeMode === mode"
              :class="{ 'is-active': selectedTimeMode === mode }"
              @click="selectedTimeMode = mode"
            >
              {{ mode }}
            </button>
          </div>

          <label v-if="selectedTimeMode === '月'" class="month-picker">
            <IconCalendarDays aria-hidden="true" />
            <input
              v-model="selectedMonth"
              class="month-picker__input"
              type="month"
              aria-label="选择统计月份"
            />
          </label>
          <div v-else class="month-picker is-year-mode">
            <IconCalendarDays aria-hidden="true" />
            <span class="month-picker__value" aria-live="polite">
              {{ periodRangeLabel }}
            </span>
          </div>
        </div>
      </header>

      <AppStateBlock
        v-if="dashboardStateType"
        class="leader-board-state"
        :type="dashboardStateType"
        :title="dashboardStateTitle"
        :description="dashboardStateDescription"
        :action-label="dashboardStateActionLabel"
        size="sm"
        variant="inline"
        @action="refreshTokenDashboard"
      />

      <section class="panel trend-panel" aria-label="Token 使用趋势">
        <div class="panel-header trend-header">
          <div class="heading-with-info">
            <h2>Token 使用趋势</h2>
            <IconInfo aria-hidden="true" />
          </div>
        </div>

        <div class="trend-visual">
          <div ref="trendChartRef" class="trend-chart" aria-label="Token 使用趋势折线图"></div>
        </div>
      </section>

      <section class="lower-grid" aria-label="Token 使用明细">
        <article class="panel usage-panel department-panel" aria-label="各部门 Token 使用量">
          <div class="panel-header usage-header">
            <div class="heading-with-info">
              <h2>各部门 Token 使用量</h2>
              <IconInfo aria-hidden="true" />
            </div>
          </div>

          <div class="stat-strip department-stats">
            <section
              v-for="stat in departmentStats"
              :key="stat.id"
              class="stat-card"
              :class="`tone-${stat.tone}`"
            >
              <span class="stat-icon"><component :is="stat.icon" aria-hidden="true" /></span>
              <div>
                <span>{{ stat.label }}</span>
                <strong>{{ stat.value }}</strong>
                <em v-if="stat.delta">↑ {{ stat.delta }}</em>
                <small>{{ stat.meta }}</small>
              </div>
            </section>
          </div>

          <div class="department-table-wrap">
            <table class="usage-table department-table">
              <thead>
                <tr>
                  <th scope="col">排名</th>
                  <th scope="col">部门</th>
                  <th scope="col">Token 使用量</th>
                  <th scope="col">占比</th>
                  <th scope="col">环比增长</th>
                  <th scope="col">趋势</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="department in departments" :key="department.id">
                  <td>
                    <span class="rank-pill" :class="`rank-${department.rank}`">{{
                      department.rank
                    }}</span>
                  </td>
                  <td>
                    <span class="entity-name">
                      <i class="entity-icon" :style="{ backgroundColor: department.color }">
                        <component :is="department.icon" aria-hidden="true" />
                      </i>
                      {{ department.name }}
                    </span>
                  </td>
                  <td class="usage-meter-cell">
                    <span class="meter-track">
                      <i
                        class="meter-fill"
                        :style="{
                          width: getProgressWidth(department.value, maxDepartmentValue),
                          backgroundColor: department.color,
                        }"
                      ></i>
                    </span>
                    <strong>{{ department.tokens }}</strong>
                  </td>
                  <td class="numeric">{{ department.share.toFixed(1) }}%</td>
                  <td class="numeric muted">--</td>
                  <td class="numeric muted">--</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel usage-panel app-panel" aria-label="分应用 Token 使用量">
          <div class="panel-header usage-header">
            <div class="heading-with-info">
              <h2>分应用 Token 使用量</h2>
              <IconInfo aria-hidden="true" />
            </div>
          </div>

          <div class="stat-strip app-stats">
            <section
              v-for="stat in appStats"
              :key="stat.id"
              class="stat-card"
              :class="`tone-${stat.tone}`"
            >
              <span class="stat-icon"><component :is="stat.icon" aria-hidden="true" /></span>
              <div>
                <span>{{ stat.label }}</span>
                <strong>{{ stat.value }}</strong>
                <em v-if="stat.delta" :class="{ cost: stat.id === 'cost' }">
                  {{ stat.id === 'cost' ? '↓' : '↑' }} {{ stat.delta }}
                </em>
                <small>{{ stat.meta }}</small>
              </div>
            </section>
          </div>

          <div class="app-usage-body">
            <div
              ref="appDonutChartRef"
              class="app-donut-chart"
              aria-label="分应用 Token 使用量环形图"
            ></div>

            <div class="app-table-wrap">
              <table class="usage-table app-table">
                <thead>
                  <tr>
                    <th scope="col">应用名称</th>
                    <th scope="col">Token 使用量</th>
                    <th scope="col">占比</th>
                    <th scope="col">环比增长</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="app in appUsages" :key="app.id">
                    <td>
                      <span class="app-name">
                        <i :style="{ backgroundColor: app.color }"></i>
                        {{ app.name }}
                      </span>
                    </td>
                    <td class="app-meter-cell">
                      <span class="meter-track app-meter">
                        <i
                          class="meter-fill"
                          :style="{
                            width: getProgressWidth(app.value, maxAppValue),
                            backgroundColor: app.color,
                          }"
                        ></i>
                      </span>
                      <strong>{{ app.tokens }}</strong>
                    </td>
                    <td class="numeric">{{ app.share.toFixed(1) }}%</td>
                    <td class="numeric">
                      <span class="change-chip" :class="{ negative: (app.change ?? 0) < 0 }">
                        <template v-if="app.change !== undefined">
                          {{ app.change >= 0 ? '▲' : '▼' }}
                          {{ Math.abs(app.change).toFixed(1) }}%
                        </template>
                        <template v-else>--</template>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>

<style scoped>
.leader-board-page {
  --board-bg: #f8fbff;
  --panel-bg: rgba(255, 255, 255, 0.94);
  --panel-line: #e2ebfb;
  --ink: #0d1d4a;
  --muted: #7386b1;
  --soft-blue: #eaf2ff;
  --blue: #1273f8;
  --cyan: #20b9ee;
  --purple: #8b5cff;
  --green: #13b890;
  --orange: #ff8a18;
  position: relative;
  width: 100vw;
  height: 100vh;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  padding: 0;
  color: var(--ink);
  background: radial-gradient(circle at 17% 0%, rgba(18, 115, 248, 0.08), transparent 32%),
    linear-gradient(180deg, #fbfdff 0%, var(--board-bg) 100%);
  font-family:
    'Avenir Next',
    'PingFang SC',
    'Microsoft YaHei',
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-variant-numeric: tabular-nums;
}

.leader-board-canvas {
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  padding: 24px 34px 22px;
  transform-origin: top left;
  will-change: transform;
}

.leader-board-page .leader-board-state {
  position: absolute;
  z-index: 20;
  top: 94px;
  left: 50%;
  width: min(460px, calc(100% - 68px));
  min-height: 0;
  transform: translateX(-50%);
  border-style: solid;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 14px 34px rgba(29, 78, 141, 0.12);
}

.leader-board-page *,
.leader-board-page *::before,
.leader-board-page *::after {
  box-sizing: border-box;
}

.leader-topbar,
.topbar-actions,
.segmented-control,
.month-picker,
.panel-header,
.heading-with-info,
.stat-card,
.entity-name,
.usage-meter-cell,
.app-usage-body,
.app-name,
.app-meter-cell {
  display: flex;
  align-items: center;
}

.leader-topbar {
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.title-stack h1 {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #09183e;
  font-size: 34px;
  font-weight: 900;
  line-height: 1.08;
  letter-spacing: 0;
}

.title-stack h1 svg {
  width: 24px;
  height: 24px;
  color: var(--blue);
}

.title-stack p {
  margin: 8px 0 0;
  color: #8b9bbc;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
}

.topbar-actions {
  flex: 0 0 auto;
  gap: 18px;
}

.segmented-control {
  width: 200px;
  height: 56px;
  border: 1px solid #dce8fb;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 8px 24px rgba(26, 77, 145, 0.08);
  padding: 5px;
}

.segmented-control button {
  position: relative;
  min-width: 0;
  min-height: 44px;
  flex: 1 1 0;
  border: 0;
  border-radius: 22px;
  background: transparent;
  color: #0d1d4a;
  font: inherit;
  font-size: 16px;
  font-weight: 900;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.segmented-control button + button::before {
  position: absolute;
  top: 13px;
  bottom: 13px;
  left: 0;
  width: 1px;
  background: #dce8fb;
  content: '';
}

.segmented-control button.is-active {
  background: linear-gradient(180deg, #1686ff 0%, #0069ef 100%);
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(18, 115, 248, 0.28);
}

.segmented-control button.is-active::before,
.segmented-control button.is-active + button::before {
  opacity: 0;
}

.month-picker {
  position: relative;
  min-height: 56px;
  border: 1px solid #dce8fb;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.88);
  color: #0d1d4a;
  padding: 0 20px 0 24px;
  gap: 12px;
  box-shadow: 0 10px 24px rgba(26, 77, 145, 0.07);
  cursor: default;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.month-picker:hover {
  border-color: rgba(18, 115, 248, 0.42);
  box-shadow: 0 14px 28px rgba(26, 77, 145, 0.12);
}

.month-picker svg {
  width: 21px;
  height: 21px;
  flex: 0 0 auto;
  color: var(--blue);
}

.month-picker__value,
.month-picker__input {
  min-width: 132px;
  color: #0d1d4a;
  font: inherit;
  font-size: 16px;
  font-weight: 900;
  white-space: nowrap;
}

.month-picker__input {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  outline: none;
}

.month-picker__input:focus-visible {
  box-shadow: 0 0 0 3px rgba(18, 115, 248, 0.16);
  border-radius: 8px;
}

.month-picker.is-year-mode .month-picker__value {
  min-width: 180px;
}

.panel {
  min-width: 0;
  border: 1px solid var(--panel-line);
  border-radius: 24px;
  background: var(--panel-bg);
  box-shadow: 0 18px 48px rgba(29, 78, 141, 0.08);
}

.panel h2 {
  margin: 0;
  color: #0d1d4a;
  font-size: 21px;
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: 0;
}

.panel-header {
  justify-content: space-between;
  gap: 16px;
}

.heading-with-info {
  gap: 8px;
}

.heading-with-info svg {
  width: 18px;
  height: 18px;
  color: #8ba0c5;
}

.trend-panel {
  position: relative;
  height: 382px;
  padding: 24px 28px 12px;
  margin-bottom: 16px;
}

.trend-header {
  align-items: flex-start;
}

.trend-visual {
  position: relative;
  height: 296px;
  margin-top: 8px;
}

.trend-chart {
  width: 100%;
  height: 100%;
}

.lower-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  height: 584px;
}

.usage-panel {
  position: relative;
  overflow: hidden;
  padding: 20px 28px 20px;
}

.usage-header {
  min-height: 42px;
  margin-bottom: 10px;
}

.stat-strip {
  height: 108px;
  border: 1px solid #dfe8f8;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 11px;
}

.stat-card {
  position: relative;
  min-width: 0;
  gap: 18px;
  padding: 18px 26px;
}

.stat-card + .stat-card::before {
  position: absolute;
  top: 20px;
  bottom: 20px;
  left: 0;
  width: 1px;
  background: #dfe8f8;
  content: '';
}

.stat-icon {
  width: 62px;
  height: 62px;
  flex: 0 0 auto;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: #eef5ff;
  color: var(--blue);
}

.stat-icon svg {
  width: 34px;
  height: 34px;
}

.stat-card.tone-orange .stat-icon {
  background: #fff4eb;
  color: var(--orange);
}

.stat-card.tone-purple .stat-icon {
  background: #f1ebff;
  color: var(--purple);
}

.stat-card div {
  min-width: 0;
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  gap: 4px 11px;
}

.stat-card span {
  grid-column: 1 / -1;
  color: #4c6397;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.1;
}

.stat-card strong {
  color: #0d1d4a;
  font-family: 'DIN Alternate', 'Arial Narrow', sans-serif;
  font-size: 29px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.stat-card em {
  color: var(--green);
  font-size: 16px;
  font-style: normal;
  font-weight: 900;
  white-space: nowrap;
}

.stat-card em.cost {
  color: var(--green);
}

.stat-card small {
  grid-column: 1 / -1;
  color: #8294bd;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.department-table-wrap,
.app-table-wrap {
  overflow: hidden;
}

.usage-table {
  width: 100%;
  border-collapse: collapse;
}

.usage-table th,
.usage-table td {
  border-bottom: 1px solid #dfe8f8;
  color: #173064;
  vertical-align: middle;
  white-space: nowrap;
}

.usage-table th {
  height: 50px;
  color: #526b9f;
  font-size: 13px;
  font-weight: 900;
  text-align: left;
}

.usage-table td {
  height: 48px;
  font-size: 14px;
  font-weight: 850;
}

.usage-table tbody tr:last-child td {
  border-bottom: 0;
}

.department-table th:nth-child(1),
.department-table td:nth-child(1) {
  width: 66px;
}

.department-table th:nth-child(2),
.department-table td:nth-child(2) {
  width: 142px;
}

.department-table th:nth-child(4),
.department-table td:nth-child(4) {
  width: 94px;
}

.department-table th:nth-child(5),
.department-table td:nth-child(5) {
  width: 126px;
}

.department-table th:nth-child(6),
.department-table td:nth-child(6) {
  width: 146px;
}

.rank-pill {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e8f0ff;
  color: #385487;
  font-size: 13px;
  font-weight: 900;
}

.rank-1 {
  background: #ff9d13;
  color: #ffffff;
}

.rank-2 {
  background: #a8b7d6;
  color: #ffffff;
}

.rank-3 {
  background: #d4845f;
  color: #ffffff;
}

.entity-name {
  gap: 12px;
}

.entity-icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  color: #ffffff;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.entity-icon svg {
  width: 18px;
  height: 18px;
}

.usage-meter-cell {
  gap: 15px;
}

.meter-track {
  width: 214px;
  height: 11px;
  overflow: hidden;
  border-radius: 999px;
  background: #e9eef8;
}

.meter-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.usage-meter-cell strong,
.app-meter-cell strong {
  min-width: 58px;
  color: #0d1d4a;
  font-weight: 900;
}

.numeric {
  text-align: right;
}

.numeric.muted {
  color: #94a3b8;
  font-weight: 700;
}

.change-chip {
  color: var(--green);
  font-weight: 900;
}

.change-chip.negative {
  color: #ff334d;
}

.sparkline-chart {
  width: 118px;
  height: 28px;
}

.app-usage-body {
  min-height: 350px;
  gap: 44px;
  padding: 12px 16px 0 4px;
}

.app-donut-chart {
  width: 330px;
  height: 306px;
  flex: 0 0 330px;
}

.app-table-wrap {
  flex: 1 1 auto;
  min-width: 0;
}

.app-table th:nth-child(1),
.app-table td:nth-child(1) {
  width: 144px;
}

.app-table th:nth-child(2),
.app-table td:nth-child(2) {
  width: 282px;
}

.app-table th:nth-child(3),
.app-table td:nth-child(3) {
  width: 92px;
}

.app-table th:nth-child(4),
.app-table td:nth-child(4) {
  width: 118px;
}

.app-name {
  gap: 12px;
}

.app-name i {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.app-meter-cell {
  gap: 15px;
}

.app-meter {
  width: 180px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
</style>
