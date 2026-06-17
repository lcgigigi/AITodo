<template>
  <main class="leader-board-page">
    <Transition name="center-toast-fade">
      <div v-if="actionToast" class="center-toast" role="status">
        {{ actionToast }}
      </div>
    </Transition>

    <header class="topbar">
      <div class="brand">
        <div class="brand-logo">
          <img :src="logoDarkImage" alt="" />
        </div>
        <div>
          <div class="brand-title">华力企业级Agent平台</div>
        </div>
      </div>

      <div class="top-actions">
        <div class="notification-wrap">
          <button class="top-icon" type="button" aria-label="通知">
            <IconBell />
          </button>
          <span class="notification-badge">6</span>
        </div>
        <button class="top-icon" type="button" aria-label="客服">
          <IconHeadphones />
        </button>
        <button class="top-icon" type="button" aria-label="设置">
          <IconSettings />
        </button>
        <div class="user">
          <div class="user-avatar">刘</div>
          <div>
            <b>刘美华</b>
          </div>
        </div>
      </div>
    </header>

    <section class="card summary-strip" aria-label="智能体指标概览">
      <article v-for="(item, index) in summaryStats" :key="item.label">
        <div class="summary-icon">{{ item.icon }}</div>
        <div class="summary-copy">
          <span>{{ item.label }}</span>
          <b
            >{{ item.value }}<em>{{ item.unit }}</em></b
          >
          <p>较上月 ↑ {{ item.rate }}%</p>
        </div>
        <div :ref="(el) => setSummaryChartRef(el, index)" class="mini-chart"></div>
      </article>
    </section>

    <section class="main-grid">
      <section class="card agent-panel">
        <div class="panel-head">
          <div>
            <h2>全部智能体</h2>
            <p>共 {{ filteredAgents.length }} / {{ agents.length }} 个智能体，本月持续统计中</p>
          </div>

          <div class="panel-actions">
            <Input
              v-model="searchKeyword"
              class="soft-search"
              type="search"
              placeholder="搜索智能体..."
              aria-label="搜索智能体"
            />
            <Select v-model="categoryFilter">
              <SelectTrigger class="soft-select category-select" aria-label="智能体分类">
                <SelectValue placeholder="智能体分类" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem v-for="option in categoryOptions" :key="option.key" :value="option.key">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select v-model="permissionFilter">
              <SelectTrigger class="soft-select permission-select" aria-label="智能体状态筛选">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem
                  v-for="option in permissionOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select v-model="sortType">
              <SelectTrigger class="soft-select sort-select" aria-label="智能体排序">
                <SelectValue placeholder="智能体排序" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem v-for="option in sortOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div v-if="filteredAgents.length" class="agent-grid">
          <article
            v-for="agent in filteredAgents"
            :key="agent.id"
            class="agent-card"
            :class="{ 'is-active': selectedAgent?.key === agent.key }"
          >
            <div class="agent-top">
              <div class="agent-icon" :class="`theme-${agent.theme}`">{{ agent.icon }}</div>
              <div>
                <h3>{{ agent.name }}</h3>
                <p>{{ agent.desc }}</p>
              </div>
            </div>

            <div class="tag-line">
              <span class="agent-tag info">{{ agent.categoryName }}</span>
              <span class="agent-tag success">{{ agent.status }}</span>
              <span class="agent-tag muted">{{ permissionText(agent.permissionState) }}</span>
            </div>

            <div class="agent-metrics">
              <div>
                <span>本月 Token</span><b>{{ formatNumber(agent.monthlyToken) }}</b>
              </div>
              <div>
                <span>调用次数</span><b>{{ formatNumber(agent.calls) }}</b>
              </div>
              <div>
                <span>积分贡献</span><b>{{ formatNumber(agent.points) }}</b>
              </div>
              <div>
                <span>使用进度</span><b>{{ agent.progress }}%</b>
              </div>
            </div>

            <div class="agent-progress" aria-hidden="true">
              <span :style="{ width: `${agent.progress}%` }"></span>
            </div>

            <div class="agent-actions">
              <button class="agent-use-btn" type="button" @click="openAgentAction(agent, 'use')">
                <IconPlay />
                使用
              </button>
              <button
                class="agent-detail-btn"
                type="button"
                @click="openAgentAction(agent, 'detail')"
              >
                <IconInfo />
                详情
              </button>
            </div>
          </article>
        </div>
        <div v-else class="agent-empty">
          <h3>没有匹配的智能体</h3>
          <p>调整搜索词、分类或状态筛选后再试。</p>
          <Button type="button" @click="resetAgentFilters">清空筛选</Button>
        </div>
      </section>

      <aside class="right-panel">
        <section class="card overview-card">
          <div class="panel-head small">
            <h2>Token 使用概览</h2>
            <Select v-model="overviewPeriod">
              <SelectTrigger class="soft-select period-select" aria-label="Token 统计周期">
                <SelectValue placeholder="统计周期" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem
                  v-for="option in periodOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="overview-grid">
            <div class="overview-list">
              <div>
                <span>本月总使用量</span>
                <b>{{ formatNumber(tokenOverview.monthTotal) }}</b>
                <em class="green">↑ 18.3%</em>
              </div>
              <div>
                <span>今日使用量</span>
                <b>{{ formatNumber(tokenOverview.today) }}</b>
                <em class="green">↓ {{ tokenOverview.todayRate }}%</em>
              </div>
              <div>
                <span>单智能体平均</span>
                <b>{{ formatNumber(tokenOverview.average) }}</b>
                <em class="green">↑ 9.6%</em>
              </div>
              <div>
                <span>剩余配额</span>
                <b>{{ formatNumber(tokenOverview.remaining) }}</b>
                <em class="red">↓ 4.8%</em>
              </div>
              <div class="quota-row">
                <span>配额使用率</span>
                <strong>{{ tokenOverview.quotaUsed }}%</strong>
                <div class="quota-progress" aria-hidden="true">
                  <span :style="{ width: `${tokenOverview.quotaUsed}%` }"></span>
                </div>
              </div>
            </div>

            <div class="donut-area">
              <div ref="donutChartRef" class="donut-chart"></div>
              <div class="legend">
                <p v-for="item in tokenOverview.categoryPercent" :key="item.name">
                  <i :style="{ backgroundColor: item.color }"></i>
                  <span>{{ item.name }}</span>
                  <b>{{ item.percent }}%</b>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="rank-grid">
          <div class="card rank-card">
            <div class="panel-head small">
              <h2>Token 排名</h2>
              <button class="link-action" type="button">
                更多
                <IconChevronRight />
              </button>
            </div>
            <div ref="tokenRankChartRef" class="rank-chart"></div>
          </div>

          <div class="card rank-card">
            <div class="panel-head small">
              <h2>积分排行</h2>
              <button class="link-action" type="button">
                更多
                <IconChevronRight />
              </button>
            </div>
            <div ref="pointsRankChartRef" class="rank-chart"></div>
          </div>
        </section>

        <section class="card trend-card">
          <div class="panel-head small">
            <h2>Token 趋势 <span>近 7 天</span></h2>
            <div class="mode-tabs" role="group" aria-label="趋势维度">
              <button
                type="button"
                :class="{ active: trendMode === 'day' }"
                @click="trendMode = 'day'"
              >
                按日
              </button>
              <button
                type="button"
                :class="{ active: trendMode === 'week' }"
                @click="trendMode = 'week'"
              >
                按周
              </button>
            </div>
          </div>

          <div ref="trendChartRef" class="trend-chart"></div>
        </section>
      </aside>
    </section>

    <Transition name="agent-drawer-fade">
      <section
        v-if="selectedAgent"
        class="agent-drawer"
        role="dialog"
        aria-modal="false"
        :aria-label="`${selectedAgent.name}智能体详情`"
      >
        <header class="drawer-head">
          <div>
            <span
              >{{ selectedAgent.categoryName }} ·
              {{ permissionText(selectedAgent.permissionState) }}</span
            >
            <h2>{{ selectedAgent.name }}</h2>
            <p>{{ selectedAgent.desc }}</p>
          </div>
          <button type="button" aria-label="关闭智能体详情" @click="closeAgentDrawer">×</button>
        </header>

        <div class="drawer-metrics">
          <span>
            <b>{{ formatNumber(selectedAgent.monthlyToken) }}</b>
            本月 Token
          </span>
          <span>
            <b>{{ formatNumber(selectedAgent.calls) }}</b>
            调用次数
          </span>
          <span>
            <b>{{ selectedAgent.owner }}</b>
            负责人
          </span>
        </div>

        <section v-if="agentActionMode === 'use'" class="mock-use-panel">
          <h3>模拟使用入口</h3>
          <p>当前前端使用 mock 数据模拟能力入口。真实接口接入后，这里会跳转到对应智能体工作流。</p>
          <button type="button" @click="agentActionMode = 'detail'">查看能力详情</button>
        </section>

        <section class="drawer-section">
          <h3>核心能力</h3>
          <div class="chip-list">
            <span v-for="item in selectedAgent.capabilities" :key="item">{{ item }}</span>
          </div>
        </section>

        <section class="drawer-section">
          <h3>适用场景</h3>
          <ul>
            <li v-for="item in selectedAgent.scenarios" :key="item">{{ item }}</li>
          </ul>
        </section>
      </section>
    </Transition>
  </main>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import IconBell from '~icons/lucide/bell'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconHeadphones from '~icons/lucide/headphones'
import IconInfo from '~icons/lucide/info'
import IconPlay from '~icons/lucide/play'
import IconSettings from '~icons/lucide/settings'
import logoDarkImage from '@/assets/logoDark1.png'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  agents,
  categories,
  pointsRanking,
  summaryStats,
  tokenOverview,
  tokenRanking,
  trendData,
  type AgentPermissionState,
  type AgentItem,
  type RankItem,
} from './mock'

defineOptions({
  name: 'LeaderBoardPage',
})

type SortType = 'default' | 'tokenDesc' | 'pointsDesc' | 'callsDesc'
type TrendMode = 'day' | 'week'
type PermissionFilter = 'all' | AgentPermissionState
type AgentActionMode = 'use' | 'detail'

const route = useRoute()
const router = useRouter()
const sortType = ref<SortType>('default')
const searchKeyword = ref('')
const categoryFilter = ref('all')
const permissionFilter = ref<PermissionFilter>('all')
const overviewPeriod = ref('month')
const trendMode = ref<TrendMode>('day')
const actionToast = ref('')
const selectedAgent = ref<AgentItem | null>(null)
const agentActionMode = ref<AgentActionMode>('detail')

const donutChartRef = ref<HTMLElement | null>(null)
const tokenRankChartRef = ref<HTMLElement | null>(null)
const pointsRankChartRef = ref<HTMLElement | null>(null)
const trendChartRef = ref<HTMLElement | null>(null)
const summaryChartRefs = ref<HTMLElement[]>([])

const sortOptions = [
  { label: '默认排序', value: 'default' },
  { label: 'Token 从高到低', value: 'tokenDesc' },
  { label: '积分贡献从高到低', value: 'pointsDesc' },
  { label: '调用次数从高到低', value: 'callsDesc' },
]

const categoryOptions = categories.map((item) => ({ key: item.key, label: item.label }))
const permissionOptions: Array<{ label: string; value: PermissionFilter }> = [
  { label: '全部状态', value: 'all' },
  { label: '可使用', value: 'available' },
  { label: '需授权', value: 'locked' },
  { label: '管理员', value: 'admin-only' },
]

const periodOptions = [
  { label: '本月', value: 'month' },
  { label: '本周', value: 'week' },
  { label: '今日', value: 'today' },
]

const filteredAgents = computed<AgentItem[]>(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const list = agents.filter((agent) => {
    const matchesKeyword =
      !keyword ||
      [agent.name, agent.desc, agent.categoryName, agent.owner, ...agent.capabilities]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    const matchesCategory =
      categoryFilter.value === 'all' || agent.categoryKey === categoryFilter.value
    const matchesPermission =
      permissionFilter.value === 'all' || agent.permissionState === permissionFilter.value

    return matchesKeyword && matchesCategory && matchesPermission
  })

  if (sortType.value === 'tokenDesc')
    return [...list].sort((a, b) => b.monthlyToken - a.monthlyToken)
  if (sortType.value === 'pointsDesc') return [...list].sort((a, b) => b.points - a.points)
  if (sortType.value === 'callsDesc') return [...list].sort((a, b) => b.calls - a.calls)
  return list
})

const chartInstances = new Set<echarts.ECharts>()
let resizeObserver: ResizeObserver | null = null
let actionToastTimer: ReturnType<typeof setTimeout> | undefined

const formatNumber = (value: number) => value.toLocaleString('en-US')
const permissionText = (state: AgentPermissionState) => {
  if (state === 'available') return '可使用'
  if (state === 'locked') return '需授权'
  return '管理员'
}

const clearActionToastTimer = () => {
  if (!actionToastTimer) return
  clearTimeout(actionToastTimer)
  actionToastTimer = undefined
}

const showActionToast = (message: string) => {
  clearActionToastTimer()
  actionToast.value = message
  actionToastTimer = setTimeout(() => {
    actionToast.value = ''
    actionToastTimer = undefined
  }, 2200)
}

const openAgentAction = (agent: AgentItem, action: AgentActionMode) => {
  const url = action === 'use' ? agent.useUrl : agent.detailUrl

  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  selectedAgent.value = agent
  agentActionMode.value = action
  void router.replace({ query: { ...route.query, agent: agent.routeQuery } })
  showActionToast(action === 'use' ? '已打开模拟使用入口' : '已打开智能体详情')
}

function closeAgentDrawer() {
  selectedAgent.value = null
  const nextQuery = { ...route.query }
  delete nextQuery.agent
  void router.replace({ query: nextQuery })
}

function resetAgentFilters() {
  searchKeyword.value = ''
  categoryFilter.value = 'all'
  permissionFilter.value = 'all'
}

function locateAgentFromQuery(agentKey?: string) {
  const normalizedKey = agentKey?.trim()
  if (!normalizedKey) return

  const agent = agents.find(
    (item) => item.key === normalizedKey || item.routeQuery === normalizedKey,
  )
  if (!agent) return

  selectedAgent.value = agent
  agentActionMode.value = 'detail'
  categoryFilter.value = agent.categoryKey
}

const setSummaryChartRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  if (el instanceof HTMLElement) {
    summaryChartRefs.value[index] = el
  }
}

const chartTextStyle = {
  color: '#4f5879',
  fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
}

const renderChart = (el: HTMLElement | null, option: echarts.EChartsOption) => {
  if (!el) return

  const chart = echarts.getInstanceByDom(el) ?? echarts.init(el, undefined, { renderer: 'canvas' })
  chart.setOption(option, true)
  chartInstances.add(chart)
}

const createMiniLineOption = (values: number[], color = '#4f7cff'): echarts.EChartsOption => ({
  animation: false,
  grid: { top: 4, right: 3, bottom: 4, left: 3 },
  xAxis: { type: 'category', show: false, data: values.map((_, index) => index) },
  yAxis: { type: 'value', show: false, min: 'dataMin', max: 'dataMax' },
  series: [
    {
      type: 'line',
      data: values,
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2.4, color },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(79, 124, 255, 0.24)' },
          { offset: 1, color: 'rgba(79, 124, 255, 0)' },
        ]),
      },
    },
  ],
})

const createDonutOption = (): echarts.EChartsOption => ({
  color: tokenOverview.categoryPercent.map((item) => item.color),
  title: {
    text: formatNumber(tokenOverview.monthTotal),
    subtext: '本月总量',
    left: 'center',
    top: '38%',
    textStyle: { ...chartTextStyle, color: '#182044', fontSize: 19, fontWeight: 800 },
    subtextStyle: { ...chartTextStyle, color: '#6c7390', fontSize: 13 },
  },
  tooltip: {
    trigger: 'item',
    confine: true,
    formatter: (params: unknown) => {
      const item = params as { name: string; percent: number }
      return `${item.name}<br/>占比 ${item.percent}%`
    },
  },
  series: [
    {
      name: 'Token 使用',
      type: 'pie',
      radius: ['60%', '84%'],
      center: ['50%', '52%'],
      avoidLabelOverlap: true,
      label: { show: false },
      labelLine: { show: false },
      itemStyle: {
        borderWidth: 4,
        borderColor: '#fff',
        borderRadius: 8,
      },
      data: tokenOverview.categoryPercent.map((item) => ({
        name: item.name,
        value: item.percent,
      })),
    },
  ],
})

const createRankOption = (
  data: RankItem[],
  colorStops: [string, string],
): echarts.EChartsOption => {
  const orderedData = [...data].reverse()

  return {
    animationDuration: 600,
    grid: { top: 4, right: 70, bottom: 4, left: 76, containLabel: false },
    tooltip: { show: false },
    xAxis: {
      type: 'value',
      show: false,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: orderedData.map((item) => item.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...chartTextStyle,
        color: '#323b62',
        fontSize: 12,
        fontWeight: 700,
      },
    },
    series: [
      {
        type: 'bar',
        silent: true,
        data: orderedData.map((item) => item.value),
        barWidth: 10,
        showBackground: true,
        backgroundStyle: {
          color: '#eef2fa',
          borderRadius: 999,
        },
        itemStyle: {
          borderRadius: 999,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: colorStops[0] },
            { offset: 1, color: colorStops[1] },
          ]),
        },
        label: {
          show: true,
          position: 'right',
          color: '#182044',
          fontSize: 12,
          fontWeight: 800,
          formatter: (params: { value?: unknown }) => formatNumber(Number(params.value ?? 0)),
        },
      },
    ],
  }
}

const createTrendOption = (): echarts.EChartsOption => ({
  animationDuration: 700,
  grid: { top: 14, right: 10, bottom: 24, left: 8 },
  tooltip: {
    trigger: 'axis',
    confine: true,
    formatter: (params: unknown) => {
      const item = (Array.isArray(params) ? params[0] : params) as { name: string; value: number }
      return `${item.name}<br/>${formatNumber(Number(item.value))} Tokens`
    },
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: trendData.map((item) => item.date),
    axisLine: { lineStyle: { color: '#dbe2f1' } },
    axisTick: { show: false },
    axisLabel: { ...chartTextStyle, color: '#7b839f', fontSize: 12 },
  },
  yAxis: {
    type: 'value',
    splitNumber: 3,
    axisLabel: { show: false },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: '#edf1f8' } },
  },
  series: [
    {
      name: 'Token',
      type: 'line',
      data: trendData.map((item) => item.value),
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { width: 3, color: '#2f68ff' },
      itemStyle: { color: '#2f68ff', borderColor: '#fff', borderWidth: 3 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(47, 104, 255, 0.22)' },
          { offset: 1, color: 'rgba(47, 104, 255, 0.02)' },
        ]),
      },
    },
  ],
})

const renderAllCharts = () => {
  summaryStats.forEach((item, index) => {
    renderChart(summaryChartRefs.value[index] ?? null, createMiniLineOption(item.sparkline))
  })
  renderChart(donutChartRef.value, createDonutOption())
  renderChart(tokenRankChartRef.value, createRankOption(tokenRanking, ['#2f68ff', '#765cff']))
  renderChart(pointsRankChartRef.value, createRankOption(pointsRanking, ['#12b981', '#2f68ff']))
  renderChart(trendChartRef.value, createTrendOption())
}

const resizeCharts = () => {
  chartInstances.forEach((chart) => chart.resize())
}

watch(
  () => route.query.agent,
  (agentKey) => {
    locateAgentFromQuery((Array.isArray(agentKey) ? agentKey[0] : agentKey) ?? undefined)
  },
  { immediate: true },
)

onMounted(async () => {
  await nextTick()
  renderAllCharts()

  resizeObserver = new ResizeObserver(resizeCharts)
  ;[
    ...summaryChartRefs.value,
    donutChartRef.value,
    tokenRankChartRef.value,
    pointsRankChartRef.value,
    trendChartRef.value,
  ].forEach((el) => {
    if (el) resizeObserver?.observe(el)
  })
})

onBeforeUnmount(() => {
  clearActionToastTimer()
  resizeObserver?.disconnect()
  chartInstances.forEach((chart) => chart.dispose())
  chartInstances.clear()
})
</script>

<style scoped>
.leader-board-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  padding: 14px 18px;
  color: #182044;
  box-sizing: border-box;
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;
  background: radial-gradient(circle at 18% 6%, rgba(77, 116, 255, 0.13), transparent 28%),
    radial-gradient(circle at 75% 12%, rgba(21, 185, 130, 0.09), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #f4f7fc 100%);
}

.center-toast {
  position: fixed;
  z-index: 30;
  top: 18px;
  left: 50%;
  min-height: 38px;
  box-sizing: border-box;
  border-radius: 999px;
  background: rgba(24, 32, 68, 0.94);
  color: #ffffff;
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.2;
  box-shadow: 0 18px 34px rgba(31, 45, 86, 0.18);
  transform: translateX(-50%);
  pointer-events: none;
}

.center-toast-fade-enter-active,
.center-toast-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.center-toast-fade-enter-from,
.center-toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

.topbar,
.brand,
.top-actions,
.user,
.panel-head {
  display: flex;
  align-items: center;
}

.topbar {
  flex: 0 0 auto;
  height: 48px;
  justify-content: space-between;
  margin-bottom: 8px;
}

.brand {
  gap: 12px;
}

.brand-logo {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: transparent;
  overflow: hidden;
}

.brand-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.brand-title {
  font-size: 20px;
  font-weight: 800;
}

.brand-subtitle,
.panel-head p {
  margin: 3px 0 0;
  color: #6c7390;
  font-size: 12px;
  line-height: 1.2;
}

.top-actions {
  gap: 10px;
}

.notification-wrap {
  position: relative;
}

.top-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.74);
  color: #263158;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.top-icon:hover {
  border-color: rgba(79, 124, 255, 0.28);
  background: #ffffff;
  box-shadow: 0 10px 22px rgba(31, 45, 86, 0.08);
  transform: translateY(-1px);
}

.top-icon svg {
  width: 18px;
  height: 18px;
}

.notification-badge {
  position: absolute;
  top: -7px;
  right: -6px;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: #e3345f;
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  line-height: 15px;
  text-align: center;
}

.user {
  gap: 9px;
  padding-left: 8px;
}

.user-avatar {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #e8efff;
  color: #2458ff;
  font-size: 15px;
  font-weight: 800;
}

.card {
  border: 1px solid rgba(164, 175, 204, 0.22);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 45px rgba(31, 45, 86, 0.08);
  backdrop-filter: blur(18px);
}

.summary-strip {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 10px;
  padding: 8px 12px;
}

.summary-strip article {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 74px;
  align-items: center;
  gap: 8px;
  min-height: 46px;
}

.summary-icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: #eef4ff;
}

.summary-copy {
  min-width: 0;
}

.summary-strip span {
  color: #69718d;
  font-size: 11px;
  line-height: 1.1;
}

.summary-strip b {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  font-size: 15px;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-strip em {
  margin-left: 3px;
  font-size: 13px;
  font-style: normal;
}

.summary-strip p {
  margin: 2px 0 0;
  color: #0ca768;
  font-size: 10px;
  line-height: 1.1;
}

.mini-chart {
  width: 74px;
  height: 28px;
}

.main-grid {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(500px, 560px);
  gap: 12px;
  align-items: stretch;
}

.panel-head {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.panel-head.small {
  margin-bottom: 8px;
}

.panel-head h2 {
  margin: 0;
  font-size: 17px;
}

.panel-head h2 span {
  margin-left: 6px;
  color: #69718d;
  font-size: 13px;
  font-weight: 500;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.sort-select {
  width: 176px;
}

.category-select,
.permission-select {
  width: 126px;
}

.period-select {
  width: 96px;
}

.soft-search {
  width: 180px;
  height: 38px;
  box-sizing: border-box;
  border: 1px solid rgba(151, 164, 198, 0.28);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  color: #263158;
  padding: 0 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  outline: none;
  box-shadow: 0 8px 20px rgba(31, 45, 86, 0.04);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.soft-search::placeholder {
  color: #8b94ad;
}

.soft-search:focus {
  border-color: rgba(79, 124, 255, 0.72);
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.12);
}

.soft-select {
  height: 38px;
  padding: 0 12px 0 14px;
  border: 1px solid rgba(151, 164, 198, 0.28);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  color: #263158;
  display: inline-flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 8px 20px rgba(31, 45, 86, 0.04);
  cursor: pointer;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease;
}

.soft-select:hover {
  border-color: rgba(79, 124, 255, 0.48);
  background-color: #ffffff;
  color: #263158;
}

.soft-select:focus,
.soft-select:focus-visible,
.soft-select[aria-expanded='true'] {
  border-color: rgba(79, 124, 255, 0.72);
  box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.12);
}

.agent-panel,
.overview-card,
.rank-card,
.trend-card {
  padding: 12px;
}

.overview-card {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.agent-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.agent-grid {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  min-height: 0;
}

.agent-card {
  min-height: 0;
  padding: 11px;
  overflow: hidden;
  border: 1px solid rgba(144, 156, 190, 0.18);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(250, 252, 255, 0.86));
  box-shadow: 0 12px 26px rgba(39, 52, 97, 0.06);
  display: flex;
  flex-direction: column;
  transition: 0.18s ease;
}

.agent-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 36px rgba(39, 52, 97, 0.1);
}

.agent-card.is-active {
  border-color: rgba(47, 104, 255, 0.42);
  box-shadow:
    0 18px 36px rgba(39, 52, 97, 0.1),
    0 0 0 3px rgba(47, 104, 255, 0.08);
}

.agent-top {
  display: flex;
  gap: 10px;
}

.agent-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  border-radius: 13px;
}

.agent-card h3 {
  margin: 0 0 4px;
  font-size: 15px;
}

.agent-card p {
  margin: 0;
}

.agent-top p {
  height: 28px;
  color: #69718d;
  font-size: 12px;
  line-height: 14px;
}

.tag-line {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 7px 0 7px;
}

.agent-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.agent-tag.info {
  background: rgba(79, 124, 255, 0.1);
  color: #315fe7;
}

.agent-tag.success {
  background: rgba(18, 185, 129, 0.12);
  color: #0f996b;
}

.agent-tag.muted {
  background: rgba(100, 116, 139, 0.1);
  color: #64748b;
}

.agent-empty {
  flex: 1 1 auto;
  min-height: 240px;
  border: 1px dashed rgba(151, 164, 198, 0.34);
  border-radius: 18px;
  background: rgba(248, 251, 255, 0.76);
  display: grid;
  place-content: center;
  gap: 8px;
  text-align: center;
}

.agent-empty h3,
.agent-empty p {
  margin: 0;
}

.agent-empty h3 {
  color: #263158;
  font-size: 16px;
}

.agent-empty p {
  color: #6c7390;
  font-size: 13px;
}

.agent-empty button {
  justify-self: center;
  min-height: 32px;
  border: 1px solid rgba(79, 124, 255, 0.24);
  border-radius: 999px;
  background: #eff4ff;
  color: #2458ff;
  padding: 0 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.agent-empty button:hover {
  background: #dfe8ff;
}

.agent-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.agent-metrics div {
  display: grid;
  gap: 4px;
  color: #69718d;
  font-size: 12px;
}

.agent-metrics b {
  color: #1c2448;
}

.agent-progress {
  height: 7px;
  overflow: hidden;
  margin-top: 8px;
  border-radius: 999px;
  background: #eef2fa;
}

.agent-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2f68ff, #765cff);
}

.agent-actions {
  margin-top: auto;
  padding-top: 10px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.agent-actions button {
  height: 34px;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.agent-actions svg {
  width: 15px;
  height: 15px;
}

.agent-use-btn {
  background: #2458ff;
  color: #ffffff;
  box-shadow: 0 12px 22px rgba(47, 104, 255, 0.2);
}

.agent-use-btn:hover {
  background: #1f49dd;
  box-shadow: 0 14px 26px rgba(47, 104, 255, 0.26);
  transform: translateY(-1px);
}

.agent-detail-btn {
  min-width: 72px;
  border-color: rgba(151, 164, 198, 0.28) !important;
  background: rgba(255, 255, 255, 0.86);
  color: #4f5879;
}

.agent-detail-btn:hover {
  border-color: rgba(79, 124, 255, 0.38) !important;
  background: #ffffff;
  color: #2458ff;
  transform: translateY(-1px);
}

.right-panel {
  display: grid;
  grid-template-rows: 250px minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
}

.agent-drawer {
  position: fixed;
  z-index: 40;
  top: 76px;
  right: 18px;
  width: min(420px, calc(100vw - 36px));
  max-height: calc(100vh - 96px);
  overflow: auto;
  box-sizing: border-box;
  border: 1px solid rgba(151, 164, 198, 0.26);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.96);
  padding: 18px;
  box-shadow: 0 28px 70px rgba(31, 45, 86, 0.18);
  backdrop-filter: blur(18px);
}

.agent-drawer-fade-enter-active,
.agent-drawer-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.agent-drawer-fade-enter-from,
.agent-drawer-fade-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

.drawer-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid #eef2f8;
}

.drawer-head span {
  color: #6c7390;
  font-size: 12px;
  font-weight: 800;
}

.drawer-head h2 {
  margin: 5px 0 6px;
  color: #182044;
  font-size: 22px;
}

.drawer-head p {
  margin: 0;
  color: #4f5879;
  font-size: 13px;
  line-height: 1.45;
}

.drawer-head button {
  width: 32px;
  height: 32px;
  border: 1px solid #e5ebf5;
  border-radius: 999px;
  background: #ffffff;
  color: #64748b;
  font: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.drawer-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0;
}

.drawer-metrics span {
  min-width: 0;
  border: 1px solid #eef2f8;
  border-radius: 14px;
  background: #f8fbff;
  color: #6c7390;
  padding: 10px;
  display: grid;
  gap: 5px;
  font-size: 12px;
  font-weight: 800;
}

.drawer-metrics b {
  overflow: hidden;
  color: #182044;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mock-use-panel,
.drawer-section {
  margin-top: 12px;
  border-top: 1px solid #eef2f8;
  padding-top: 12px;
}

.mock-use-panel {
  border: 1px solid rgba(47, 104, 255, 0.12);
  border-radius: 16px;
  background: #f4f7ff;
  padding: 12px;
}

.mock-use-panel h3,
.drawer-section h3 {
  margin: 0 0 8px;
  color: #182044;
  font-size: 14px;
}

.mock-use-panel p {
  margin: 0 0 10px;
  color: #4f5879;
  font-size: 13px;
  line-height: 1.5;
}

.mock-use-panel button {
  min-height: 32px;
  border: 0;
  border-radius: 999px;
  background: #2458ff;
  color: #ffffff;
  padding: 0 13px;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-list span {
  min-height: 26px;
  border-radius: 999px;
  background: #eef4ff;
  color: #315fe7;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 850;
}

.drawer-section ul {
  margin: 0;
  padding-left: 18px;
  color: #4f5879;
  font-size: 13px;
  line-height: 1.7;
}

.overview-grid {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(0, 1.35fr);
  gap: 22px;
  align-items: center;
  padding: 2px 4px 4px;
}

.overview-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: center;
  gap: 11px 14px;
}

.overview-list > div:not(.quota-row) {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(151, 164, 198, 0.18);
}

.overview-list span {
  color: #69718d;
  font-size: 12px;
  line-height: 1.1;
}

.overview-list b {
  grid-column: 1 / 2;
  font-size: 18px;
  line-height: 1;
}

.overview-list em {
  grid-column: 1 / 2;
  color: #69718d;
  font-size: 11px;
  font-style: normal;
  line-height: 1.1;
}

.overview-list .green {
  color: #0ca768;
}

.overview-list .red {
  color: #e5484d;
}

.quota-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 6px 10px;
  margin-top: 2px;
}

.quota-progress {
  grid-column: 1 / -1;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef2fa;
}

.quota-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2f68ff, #765cff);
}

.quota-row strong {
  color: #182044;
  font-size: 13px;
  line-height: 1;
}

.donut-area {
  display: grid;
  grid-template-columns: 192px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}

.donut-chart {
  width: 192px;
  height: 192px;
}

.legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: center;
  gap: 11px 12px;
}

.legend p {
  display: grid;
  grid-template-columns: 8px 1fr auto;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin: 0;
  color: #4f5879;
  font-size: 12px;
  line-height: 1.1;
}

.legend span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend b {
  white-space: nowrap;
}

.legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.rank-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-height: 0;
}

.rank-card {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.rank-chart {
  flex: 1 1 auto;
  min-height: 0;
}

.link-action {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 0;
  background: transparent;
  color: #2f68ff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.link-action svg {
  width: 15px;
  height: 15px;
}

.trend-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.trend-chart {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
}

.mode-tabs {
  display: inline-grid;
  grid-template-columns: repeat(2, 1fr);
  overflow: hidden;
  padding: 2px;
  border: 1px solid rgba(151, 164, 198, 0.26);
  border-radius: 15px;
  background: #eef2fa;
}

.mode-tabs button {
  min-width: 48px;
  height: 30px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #6b7390;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.mode-tabs button.active {
  background: #2f68ff;
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(47, 104, 255, 0.24);
}

.theme-blue {
  background: linear-gradient(135deg, #1a84ff, #3f5dff);
}
.theme-green {
  background: linear-gradient(135deg, #12b981, #11a36b);
}
.theme-purple {
  background: linear-gradient(135deg, #7a5cff, #9b62ff);
}
.theme-orange {
  background: linear-gradient(135deg, #ff7a1a, #ffb21f);
}
.theme-indigo {
  background: linear-gradient(135deg, #24345d, #465782);
}
.theme-pink {
  background: linear-gradient(135deg, #f4458d, #ff6cb2);
}
.theme-yellow {
  background: linear-gradient(135deg, #f6a800, #ffca42);
}

@media (max-width: 1600px) {
  .main-grid {
    grid-template-columns: minmax(0, 1fr) 500px;
  }

  .summary-strip article {
    grid-template-columns: 30px minmax(0, 1fr) 60px;
  }

  .mini-chart {
    width: 60px;
  }
}
</style>
