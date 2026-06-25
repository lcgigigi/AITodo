<script setup lang="ts">
import type { Component, ComponentPublicInstance } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import IconArrowRight from '~icons/lucide/arrow-right'
import IconBlocks from '~icons/lucide/blocks'
import IconBox from '~icons/lucide/box'
import IconBriefcaseBusiness from '~icons/lucide/briefcase-business'
import IconBuilding2 from '~icons/lucide/building-2'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconCode2 from '~icons/lucide/code-2'
import IconDownload from '~icons/lucide/download'
import IconFilter from '~icons/lucide/filter'
import IconFlame from '~icons/lucide/flame'
import IconGrid2x2 from '~icons/lucide/grid-2x2'
import IconHeadphones from '~icons/lucide/headphones'
import IconInfo from '~icons/lucide/info'
import IconMegaphone from '~icons/lucide/megaphone'
import IconSparkles from '~icons/lucide/sparkles'
import IconTrendingUp from '~icons/lucide/trending-up'
import IconTrophy from '~icons/lucide/trophy'
import IconUserRound from '~icons/lucide/user-round'

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
  change: number
  color: string
  icon: Component
  trend: number[]
}

interface AppUsage {
  id: string
  name: string
  tokens: string
  value: number
  share: number
  change: number
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

const timeModes = ['日', '周', '月']
const departmentModes = ['按部门', '按团队']
const appModes = ['按应用', '按场景']
const selectedTimeMode = ref('日')
const selectedDepartmentMode = ref('按部门')
const selectedAppMode = ref('按应用')
const selectedDepartmentPeriod = ref('周')
const selectedAppPeriod = ref('周')

const BOARD_DESIGN_WIDTH = 2000
const BOARD_DESIGN_HEIGHT = 1125
const boardScale = ref(1)
const boardOffsetX = ref(0)
const boardOffsetY = ref(0)

const trendChartRef = ref<HTMLElement | null>(null)
const appDonutChartRef = ref<HTMLElement | null>(null)
const departmentSparklineRefs = ref<Record<string, HTMLElement | null>>({})

const chartInstances = new Set<echarts.ECharts>()
let resizeObserver: ResizeObserver | null = null

let currentSimulatedTotal = 0
let trendLiveTimer: number | null = null
const FLIP_HALF_MS = 220
const FLIP_OVERLAP_MS = 90
const FLIP_DURATION_MS = FLIP_HALF_MS + FLIP_OVERLAP_MS

function renderFlipDigit(char: string) {
  return `
    <span class="flip-digit" data-value="${char}">
      <span class="flip-top"><span class="flip-line">${char}</span></span>
      <span class="flip-bottom"><span class="flip-line">${char}</span></span>
      <span class="flip-top-flip"><span class="flip-line">${char}</span></span>
      <span class="flip-bottom-flip"><span class="flip-line">${char}</span></span>
    </span>
  `
}

function renderScoreboardText(text: string) {
  return text
    .split('')
    .map((char) => {
      if (char === ':' || char === '.') {
        return `<span class="score-separator">${char}</span>`
      }
      return renderFlipDigit(char)
    })
    .join('')
}

function triggerFlipDigit(el: HTMLElement, newChar: string) {
  const oldChar = el.dataset.value ?? newChar
  if (oldChar === newChar || el.classList.contains('is-flipping')) return

  const topLine = el.querySelector('.flip-top .flip-line')
  const bottomLine = el.querySelector('.flip-bottom .flip-line')
  const topFlipLine = el.querySelector('.flip-top-flip .flip-line')
  const bottomFlipLine = el.querySelector('.flip-bottom-flip .flip-line')
  if (!topLine || !bottomLine || !topFlipLine || !bottomFlipLine) return

  // 新数字先写入静态上层，翻页过程中作为底层承接，避免翻到 90° 后出现空白
  topLine.textContent = newChar
  topFlipLine.textContent = oldChar
  bottomFlipLine.textContent = newChar

  el.classList.remove('is-flipping')
  void el.offsetWidth
  el.classList.add('is-flipping')

  window.setTimeout(() => {
    bottomLine.textContent = newChar
    topFlipLine.textContent = newChar
    bottomFlipLine.textContent = newChar
    el.dataset.value = newChar
    el.classList.remove('is-flipping')
  }, FLIP_DURATION_MS)
}

function updateScoreboardDigits(container: HTMLElement, nextText: string) {
  const flipDigits = Array.from(container.querySelectorAll<HTMLElement>('.flip-digit'))
  const nextDigitChars = nextText.split('').filter((char) => char !== ':' && char !== '.')

  if (flipDigits.length !== nextDigitChars.length) {
    const unit = container.querySelector('.score-unit')
    container.innerHTML = renderScoreboardText(nextText)
    if (unit) container.appendChild(unit)
    return
  }

  flipDigits.forEach((el, index) => {
    const nextChar = nextDigitChars[index]
    if (!nextChar) return
    if ((el.dataset.value ?? '') !== nextChar) {
      triggerFlipDigit(el, nextChar)
    }
  })
}

const boardCanvasStyle = computed(() => ({
  width: `${BOARD_DESIGN_WIDTH}px`,
  height: `${BOARD_DESIGN_HEIGHT}px`,
  transform: `translate3d(${boardOffsetX.value}px, ${boardOffsetY.value}px, 0) scale(${boardScale.value})`,
}))

const hourlyTimeLabels = Array.from(
  { length: 25 },
  (_, index) => `${String(index).padStart(2, '0')}:00`,
)
const totalTrend = [
  0, 1.55, 2.95, 3.28, 4.45, 4.62, 6.22, 6.08, 5.82, 7.34, 7.95, 7.82, 7.45, 8.38, 8.05, 8.21, 8.78,
  8.44, 8.02, 8.02, 8.18, 8.22, 8.52, 9.22, 10.05,
]
const dayTimeBuckets = [
  { label: '0-8', hour: 8 },
  { label: '10', hour: 10 },
  { label: '12', hour: 12 },
  { label: '14', hour: 14 },
  { label: '16', hour: 15 },
  { label: '18', hour: 18 },
  { label: '20', hour: 20 },
  { label: '22', hour: 22 },
  { label: '22-24', hour: 24 },
]

function pickDayBucketTrend(hourlyTrend: number[]) {
  return dayTimeBuckets.map(({ hour }) => hourlyTrend[hour] ?? 0)
}

function clampTrendIndex(index: number, length: number) {
  return Math.min(Math.max(index, 0), length - 1)
}

function getCurrentDayBucketIndex(hour = new Date().getHours()) {
  if (hour < 8) return 0
  if (hour >= 22) return dayTimeBuckets.length - 1

  return Math.floor((hour - 8) / 2) + 1
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

const hourlyTrendDataset = computed(() =>
  createTrendDataset(hourlyTimeLabels, totalTrend, new Date().getHours()),
)

const dayTrendDataset = computed(() =>
  createTrendDataset(
    dayTimeBuckets.map(({ label }) => label),
    pickDayBucketTrend(totalTrend),
    getCurrentDayBucketIndex(),
  ),
)

const trendDataset = computed(() =>
  selectedTimeMode.value === '日' ? dayTrendDataset.value : hourlyTrendDataset.value,
)

const departments: DepartmentUsage[] = [
  {
    id: 'rd',
    rank: 1,
    name: '研发中心',
    tokens: '8.42B',
    value: 8.42,
    share: 32.4,
    change: 18.3,
    color: '#1273f8',
    icon: IconCode2,
    trend: [42, 46, 43, 51, 48, 56, 50, 61, 54, 63, 58, 55, 60, 53, 57, 66, 61, 68],
  },
  {
    id: 'product',
    rank: 2,
    name: '产品中心',
    tokens: '5.61B',
    value: 5.61,
    share: 21.6,
    change: 12.7,
    color: '#7a5cff',
    icon: IconBox,
    trend: [30, 34, 32, 38, 35, 42, 36, 45, 40, 48, 43, 51, 44, 39, 47, 42, 50, 46],
  },
  {
    id: 'marketing',
    rank: 3,
    name: '市场运营',
    tokens: '4.23B',
    value: 4.23,
    share: 16.3,
    change: 9.8,
    color: '#1fb7e8',
    icon: IconMegaphone,
    trend: [26, 29, 27, 34, 31, 38, 35, 42, 36, 40, 34, 37, 33, 39, 44, 41, 47, 43],
  },
  {
    id: 'support',
    rank: 4,
    name: '客服中心',
    tokens: '2.98B',
    value: 2.98,
    share: 11.5,
    change: 6.2,
    color: '#18bf9e',
    icon: IconHeadphones,
    trend: [22, 24, 23, 28, 25, 30, 27, 32, 29, 35, 31, 37, 33, 30, 34, 39, 35, 40],
  },
  {
    id: 'finance',
    rank: 5,
    name: '行政财务',
    tokens: '1.72B',
    value: 1.72,
    share: 6.6,
    change: -2.1,
    color: '#ff9418',
    icon: IconBriefcaseBusiness,
    trend: [18, 21, 19, 22, 20, 24, 23, 26, 22, 25, 27, 24, 26, 23, 25, 28, 24, 27],
  },
  {
    id: 'hr',
    rank: 6,
    name: '人力资源',
    tokens: '1.04B',
    value: 1.04,
    share: 4.0,
    change: 3.4,
    color: '#6a6cff',
    icon: IconUserRound,
    trend: [15, 17, 16, 21, 19, 23, 18, 22, 20, 24, 19, 21, 18, 20, 23, 21, 25, 22],
  },
]

const appUsages: AppUsage[] = [
  {
    id: 'qa',
    name: '智能问答',
    tokens: '5.63B',
    value: 5.63,
    share: 32.3,
    change: 18.9,
    color: '#1273f8',
  },
  {
    id: 'doc',
    name: '文档分析',
    tokens: '3.85B',
    value: 3.85,
    share: 22.1,
    change: 13.4,
    color: '#8656f5',
  },
  {
    id: 'content',
    name: '内容生成',
    tokens: '3.09B',
    value: 3.09,
    share: 17.8,
    change: 9.6,
    color: '#20aaf3',
  },
  {
    id: 'data',
    name: '数据分析',
    tokens: '2.19B',
    value: 2.19,
    share: 12.6,
    change: 6.8,
    color: '#1fc6bd',
  },
  {
    id: 'translate',
    name: '翻译服务',
    tokens: '1.28B',
    value: 1.28,
    share: 7.3,
    change: -1.6,
    color: '#ff8a00',
  },
  {
    id: 'workflow',
    name: '工作流助手',
    tokens: '1.36B',
    value: 1.36,
    share: 7.8,
    change: 4.7,
    color: '#8196bf',
  },
]

const departmentStats: StatCard[] = [
  {
    id: 'total',
    label: '总部门数',
    value: '6',
    delta: '20%',
    meta: '较前一周',
    icon: IconBuilding2,
    tone: 'blue',
  },
  {
    id: 'top',
    label: '本周最高部门',
    value: '研发中心',
    meta: '8.42B',
    icon: IconTrophy,
    tone: 'blue',
  },
  {
    id: 'growth',
    label: '环比增长',
    value: '18.6%',
    meta: '较前一周',
    icon: IconTrendingUp,
    tone: 'blue',
  },
]

const appStats: StatCard[] = [
  {
    id: 'active',
    label: '活跃应用数',
    value: '12',
    delta: '2',
    meta: '较前一周',
    icon: IconGrid2x2,
    tone: 'blue',
  },
  {
    id: 'top',
    label: '最高消耗应用',
    value: '智能问答',
    meta: '5.63B',
    icon: IconFlame,
    tone: 'orange',
  },
  {
    id: 'cost',
    label: '平均调用成本',
    value: '¥0.012',
    delta: '8.7%',
    meta: '较前一周',
    icon: IconBlocks,
    tone: 'purple',
  },
]

const maxDepartmentValue = Math.max(...departments.map((department) => department.value))
const maxAppValue = Math.max(...appUsages.map((app) => app.value))
const chartTextStyle = {
  color: '#526b9f',
  fontFamily:
    '"Avenir Next", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, sans-serif',
}

function resolveElement(el: Element | ComponentPublicInstance | null): HTMLElement | null {
  return el instanceof HTMLElement ? el : null
}

function setDepartmentSparklineRef(id: string, el: Element | ComponentPublicInstance | null) {
  departmentSparklineRefs.value[id] = resolveElement(el)
}

function getChart(el: HTMLElement | null) {
  if (!el) return null

  const chart = echarts.getInstanceByDom(el) ?? echarts.init(el, undefined, { renderer: 'canvas' })
  chartInstances.add(chart)
  return chart
}

function formatTrendAxis(value: number) {
  return value === 0 ? '0' : `${value}B`
}

function makeAreaGradient(color: string) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color },
    { offset: 1, color: 'rgba(255, 255, 255, 0.02)' },
  ])
}

function getProgressWidth(value: number, maxValue: number) {
  return `${Math.max(8, (value / maxValue) * 100)}%`
}

function showDefaultTrendTip(chart: echarts.ECharts) {
  const dataset = trendDataset.value

  requestAnimationFrame(() => {
    chart.dispatchAction({
      type: 'showTip',
      seriesIndex: 0,
      dataIndex: dataset.selectedIndex,
    })
  })
}

function bindTrendChartInteraction(chart: echarts.ECharts) {
  chart.off('globalout')
  chart.on('globalout', () => {
    showDefaultTrendTip(chart)
  })
}

function renderTrendChart() {
  const chart = getChart(trendChartRef.value)
  if (!chart) return

  const dataset = trendDataset.value
  const xAxisLabelInterval =
    selectedTimeMode.value === '日' ? 0 : (index: number) => index % 4 === 0

  chart.setOption(
    {
      animationDuration: 820,
      grid: { top: 34, right: 28, bottom: 34, left: 54 },
      color: ['#126fff'],
      tooltip: {
        trigger: 'axis',
        confine: true,
        alwaysShowContent: true,
        borderWidth: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        padding: [28, 36],
        shadowBlur: 32,
        shadowColor: 'rgba(26, 77, 145, 0.16)',
        borderRadius: 16,
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : []
          const title = (list[0] as { axisValueLabel?: string } | undefined)?.axisValueLabel ?? ''
          const point = list.find(
            (item) => (item as { seriesName?: string }).seriesName === '总量',
          ) as { value?: number } | undefined

          const isCurrent = title === dataset.selectedLabel
          let timeStr = ''
          if (isCurrent) {
            const now = new Date()
            timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
          } else {
            const match = title.match(/(\d+)(:\d+)?/)
            if (match) {
              const h = match[1].padStart(2, '0')
              const m = match[2] ? match[2].substring(1) : '00'
              timeStr = `${h}:${m}:00`
            } else {
              timeStr = title
            }
          }

          let totalVal = Number(point?.value ?? 0)
          if (isCurrent && currentSimulatedTotal > 0) {
            totalVal = currentSimulatedTotal
          }

          const timeId = isCurrent ? 'id="live-time-digits"' : ''
          const tokenId = isCurrent ? 'id="live-token-digits"' : ''

          return `
            <div class="token-scoreboard">
              <div class="score-section">
                <div class="score-label">${isCurrent ? '当前时间' : '记录时间'}</div>
                <div class="score-digits" ${timeId}>
                  ${renderScoreboardText(timeStr)}
                </div>
              </div>
              <div class="score-section">
                <div class="score-label">Token 消耗总量</div>
                <div class="score-digits" ${tokenId}>
                  ${renderScoreboardText(totalVal.toFixed(3))}<span class="score-unit">B</span>
                </div>
              </div>
            </div>
          `
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
        max: 10,
        interval: 2,
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
    } as echarts.EChartsOption,
    true,
  )

  bindTrendChartInteraction(chart)
  showDefaultTrendTip(chart)
}

function renderAppDonutChart() {
  const chart = getChart(appDonutChartRef.value)
  if (!chart) return

  chart.setOption(
    {
      animationDuration: 760,
      color: appUsages.map((app) => app.color),
      title: {
        text: '总 Token\n17.40B',
        subtext: '较前一周   ↑ 16.2%',
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
          return `${item.name}<br/>${Number(item.value).toFixed(2)}B<br/>占比 ${item.percent}%`
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
          data: appUsages.map((app) => ({
            name: app.name,
            value: app.value,
          })),
        },
      ],
    } as echarts.EChartsOption,
    true,
  )
}

function renderDepartmentSparkline(department: DepartmentUsage) {
  const chart = getChart(departmentSparklineRefs.value[department.id] ?? null)
  if (!chart) return

  chart.setOption(
    {
      animationDuration: 520,
      grid: { top: 4, right: 2, bottom: 4, left: 2 },
      xAxis: { type: 'category', show: false, data: department.trend.map((_, index) => index) },
      yAxis: {
        type: 'value',
        show: false,
        min: Math.min(...department.trend) - 4,
        max: Math.max(...department.trend) + 4,
      },
      series: [
        {
          type: 'line',
          data: department.trend,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: department.color },
        },
      ],
    } as echarts.EChartsOption,
    true,
  )
}

function renderAllCharts() {
  renderTrendChart()
  renderAppDonutChart()
  departments.forEach(renderDepartmentSparkline)
}

function resizeCharts() {
  chartInstances.forEach((chart) => chart.resize())
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
  const elements = [
    trendChartRef.value,
    appDonutChartRef.value,
    ...Object.values(departmentSparklineRefs.value),
  ].filter((el): el is HTMLElement => Boolean(el))

  elements.forEach((el) => resizeObserver?.observe(el))
}

watch(selectedTimeMode, () => {
  currentSimulatedTotal = trendDataset.value.selectedTotal || 0
  renderTrendChart()
})

onMounted(async () => {
  updateBoardScale()
  await nextTick()
  currentSimulatedTotal = trendDataset.value.selectedTotal || 8.21
  renderAllCharts()
  observeChartContainers()
  window.addEventListener('resize', handleWindowResize, { passive: true })

  trendLiveTimer = window.setInterval(() => {
    currentSimulatedTotal += Math.random() * 0.005
    const timeEl = document.getElementById('live-time-digits')
    if (timeEl) {
      const now = new Date()
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      updateScoreboardDigits(timeEl, timeStr)
    }
    const tokenEl = document.getElementById('live-token-digits')
    if (tokenEl) {
      updateScoreboardDigits(tokenEl, currentSimulatedTotal.toFixed(3))
    }
  }, 1000)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  resizeObserver?.disconnect()
  chartInstances.forEach((chart) => chart.dispose())
  chartInstances.clear()
  if (trendLiveTimer) window.clearInterval(trendLiveTimer)
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

          <button class="toolbar-button compare-button" type="button">
            <span>对比：前一天</span>
            <IconChevronDown aria-hidden="true" />
          </button>

          <button class="toolbar-button" type="button">
            <IconFilter aria-hidden="true" />
            <span>筛选</span>
          </button>

          <button class="toolbar-button" type="button">
            <IconDownload aria-hidden="true" />
            <span>导出</span>
            <IconChevronDown aria-hidden="true" />
          </button>
        </div>
      </header>

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

            <div class="panel-actions">
              <div class="soft-toggle" role="tablist" aria-label="部门维度">
                <button
                  v-for="mode in departmentModes"
                  :key="mode"
                  type="button"
                  role="tab"
                  :aria-selected="selectedDepartmentMode === mode"
                  :class="{ 'is-active': selectedDepartmentMode === mode }"
                  @click="selectedDepartmentMode = mode"
                >
                  {{ mode }}
                </button>
              </div>
              <div class="mini-period" role="tablist" aria-label="部门统计周期">
                <button
                  v-for="mode in timeModes"
                  :key="mode"
                  type="button"
                  role="tab"
                  :aria-selected="selectedDepartmentPeriod === mode"
                  :class="{ 'is-active': selectedDepartmentPeriod === mode }"
                  @click="selectedDepartmentPeriod = mode"
                >
                  {{ mode }}
                </button>
              </div>
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
                  <th scope="col">趋势（近7日）</th>
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
                  <td class="numeric">
                    <span class="change-chip" :class="{ negative: department.change < 0 }">
                      {{ department.change >= 0 ? '▲' : '▼' }}
                      {{ Math.abs(department.change).toFixed(1) }}%
                    </span>
                  </td>
                  <td>
                    <div
                      :ref="(el) => setDepartmentSparklineRef(department.id, el)"
                      class="sparkline-chart"
                      :aria-label="`${department.name}近7日 Token 趋势`"
                    ></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <button class="detail-link" type="button">
            查看部门详情
            <IconArrowRight aria-hidden="true" />
          </button>
        </article>

        <article class="panel usage-panel app-panel" aria-label="分应用 Token 使用量">
          <div class="panel-header usage-header">
            <div class="heading-with-info">
              <h2>分应用 Token 使用量</h2>
              <IconInfo aria-hidden="true" />
            </div>

            <div class="panel-actions">
              <div class="soft-toggle" role="tablist" aria-label="应用维度">
                <button
                  v-for="mode in appModes"
                  :key="mode"
                  type="button"
                  role="tab"
                  :aria-selected="selectedAppMode === mode"
                  :class="{ 'is-active': selectedAppMode === mode }"
                  @click="selectedAppMode = mode"
                >
                  {{ mode }}
                </button>
              </div>
              <div class="mini-period" role="tablist" aria-label="应用统计周期">
                <button
                  v-for="mode in timeModes"
                  :key="mode"
                  type="button"
                  role="tab"
                  :aria-selected="selectedAppPeriod === mode"
                  :class="{ 'is-active': selectedAppPeriod === mode }"
                  @click="selectedAppPeriod = mode"
                >
                  {{ mode }}
                </button>
              </div>
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
                      <span class="change-chip" :class="{ negative: app.change < 0 }">
                        {{ app.change >= 0 ? '▲' : '▼' }} {{ Math.abs(app.change).toFixed(1) }}%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <button class="detail-link" type="button">
            查看应用详情
            <IconArrowRight aria-hidden="true" />
          </button>
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

.leader-board-page *,
.leader-board-page *::before,
.leader-board-page *::after {
  box-sizing: border-box;
}

.leader-topbar,
.topbar-actions,
.segmented-control,
.toolbar-button,
.panel-header,
.heading-with-info,
.panel-actions,
.soft-toggle,
.mini-period,
.stat-card,
.entity-name,
.usage-meter-cell,
.app-usage-body,
.app-name,
.app-meter-cell,
.detail-link {
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
  width: 280px;
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

.toolbar-button {
  position: relative;
  min-height: 56px;
  border: 1px solid #dce8fb;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.88);
  color: #0d1d4a;
  padding: 0 24px;
  gap: 12px;
  box-shadow: 0 10px 24px rgba(26, 77, 145, 0.07);
  font: inherit;
  font-size: 16px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.toolbar-button:hover,
.toolbar-button:focus-visible {
  border-color: rgba(18, 115, 248, 0.42);
  box-shadow: 0 14px 28px rgba(26, 77, 145, 0.12);
  outline: none;
  transform: translateY(-1px);
}

.toolbar-button svg {
  width: 21px;
  height: 21px;
  flex: 0 0 auto;
}

.compare-button {
  min-width: 218px;
  justify-content: center;
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

.panel-actions {
  gap: 18px;
}

.soft-toggle,
.mini-period {
  height: 36px;
  border: 1px solid #dce8fb;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  padding: 3px;
}

.soft-toggle button,
.mini-period button {
  min-width: 64px;
  min-height: 28px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: #385487;
  font: inherit;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
}

.soft-toggle button.is-active,
.mini-period button.is-active {
  background: #dbeaff;
  color: var(--blue);
}

.mini-period {
  width: 154px;
}

.mini-period button {
  min-width: 0;
  flex: 1 1 0;
}

.mini-period button.is-active {
  background: linear-gradient(180deg, #1686ff 0%, #0069ef 100%);
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(18, 115, 248, 0.25);
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

.detail-link {
  position: absolute;
  bottom: 20px;
  left: 50%;
  min-height: 34px;
  border: 0;
  background: transparent;
  color: var(--blue);
  gap: 8px;
  padding: 0;
  font: inherit;
  font-size: 15px;
  font-weight: 900;
  cursor: pointer;
  transform: translateX(-50%);
}

.detail-link svg {
  width: 17px;
  height: 17px;
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

:deep(.token-scoreboard) {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 220px;
}
:deep(.score-section) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
:deep(.score-label) {
  font-size: 16px;
  color: #526b9f;
  font-weight: 800;
}
:deep(.score-digits) {
  display: flex;
  align-items: center;
  gap: 6px;
}
:deep(.flip-digit) {
  position: relative;
  display: inline-block;
  width: 46px;
  height: 54px;
  perspective: 320px;
  transform-style: preserve-3d;
  font-family: 'DIN Alternate', 'Arial Narrow', sans-serif;
}
:deep(.flip-digit::after) {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(220, 232, 251, 0.95);
  transform: translateY(-50%);
  z-index: 5;
  pointer-events: none;
}
:deep(.flip-top),
:deep(.flip-bottom),
:deep(.flip-top-flip),
:deep(.flip-bottom-flip) {
  position: absolute;
  left: 0;
  right: 0;
  height: 50%;
  overflow: hidden;
  background: #f1f5fb;
  border: 1px solid #dce8fb;
  backface-visibility: hidden;
}
:deep(.flip-top),
:deep(.flip-bottom) {
  z-index: 1;
}
:deep(.flip-top),
:deep(.flip-top-flip) {
  top: 0;
  border-radius: 8px 8px 0 0;
  border-bottom: none;
  transform-origin: bottom center;
}
:deep(.flip-bottom),
:deep(.flip-bottom-flip) {
  bottom: 0;
  border-radius: 0 0 8px 8px;
  border-top: none;
  transform-origin: top center;
}
:deep(.flip-line) {
  display: block;
  height: 54px;
  line-height: 54px;
  text-align: center;
  font-size: 38px;
  font-weight: bold;
  color: #0d1d4a;
}
:deep(.flip-bottom .flip-line),
:deep(.flip-bottom-flip .flip-line) {
  margin-top: -27px;
}
:deep(.flip-top-flip),
:deep(.flip-bottom-flip) {
  display: none;
  z-index: 2;
  box-shadow: 0 3px 8px rgba(26, 77, 145, 0.14);
  will-change: transform;
}
:deep(.flip-digit.is-flipping .flip-top-flip) {
  display: block;
  animation: flip-top-down 220ms cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards;
}
:deep(.flip-digit.is-flipping .flip-bottom-flip) {
  display: block;
  transform: rotateX(180deg);
  animation: flip-bottom-up 220ms 90ms cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards;
}
@keyframes flip-top-down {
  0% {
    transform: rotateX(0deg);
  }
  100% {
    transform: rotateX(-180deg);
  }
}
@keyframes flip-bottom-up {
  0% {
    transform: rotateX(180deg);
  }
  100% {
    transform: rotateX(0deg);
  }
}
:deep(.score-separator) {
  font-size: 32px;
  font-weight: bold;
  color: #0d1d4a;
  margin: 0 2px;
}
:deep(.score-unit) {
  font-size: 24px;
  font-weight: 900;
  color: #0d1d4a;
  margin-left: 8px;
  align-self: flex-end;
  margin-bottom: 4px;
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

  :deep(.flip-digit.is-flipping .flip-top-flip),
  :deep(.flip-digit.is-flipping .flip-bottom-flip) {
    animation: none !important;
  }
}
</style>
