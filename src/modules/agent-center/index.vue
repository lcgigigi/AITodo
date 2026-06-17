<script setup lang="ts">
import type { Component } from 'vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconActivity from '~icons/lucide/activity'
import IconBot from '~icons/lucide/bot'
import IconBox from '~icons/lucide/box'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconCircleHelp from '~icons/lucide/circle-help'
import IconCode2 from '~icons/lucide/code-2'
import IconCoins from '~icons/lucide/coins'
import IconCpu from '~icons/lucide/cpu'
import IconHistory from '~icons/lucide/history'
import IconImage from '~icons/lucide/image'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconPanelLeftClose from '~icons/lucide/panel-left-close'
import IconPanelLeftOpen from '~icons/lucide/panel-left-open'
import IconPlus from '~icons/lucide/plus'
import IconSearch from '~icons/lucide/search'
import IconShieldCheck from '~icons/lucide/shield-check'
import IconSparkles from '~icons/lucide/sparkles'
import IconStar from '~icons/lucide/star'
import IconTrendingDown from '~icons/lucide/trending-down'
import IconTrendingUp from '~icons/lucide/trending-up'
import IconUsers from '~icons/lucide/users'
import IconX from '~icons/lucide/x'
import makeUrl from '@/assets/agent-center/make.png'
import moreAbilityUrl from '@/assets/agent-center/newagnet.png'
import DashboardTopBar from '@/modules/home/dashboard/DashboardTopBar.vue'
import {
  agentCategories,
  agents,
  getAgentByKey,
  permissionLabels,
  skills,
} from './mock'
import type { AgentCatalogItem, AgentCategory } from './types'

defineOptions({
  name: 'AgentCenterPage',
})

type AgentVisual = {
  icon: Component
  tone: string
}

const route = useRoute()
const router = useRouter()

const searchKeyword = ref('')
const activeCategory = ref<AgentCategory | '全部'>('全部')
const selectedAgent = ref<AgentCatalogItem | null>(null)
const actionToast = ref('')
const sidebarCollapsed = ref(false)

const primaryNav = [
  { label: '智能体 Agent', icon: IconBot, active: true },
  { label: '能力 Skills', icon: IconCpu, active: false },
  { label: '我的收藏', icon: IconStar, active: false },
  { label: '使用记录', icon: IconHistory, active: false },
]

const secondaryNav = [{ label: '帮助中心', icon: IconCircleHelp }]

function formatTokens(value: number) {
  if (value >= 10000) {
    const wan = value / 10000
    return `${Number.isInteger(wan) ? wan : wan.toFixed(1)}万`
  }
  return value.toLocaleString('zh-CN')
}

const tokenUsage = computed(() => {
  const quota = 2_000_000
  const used = 1_240_000
  const todayUsed = 86_000
  const todayDelta = 12

  const remaining = quota - used
  const usedPercent = Math.min(100, Math.round((used / quota) * 100))

  return {
    quotaLabel: formatTokens(quota),
    remainingLabel: formatTokens(remaining),
    usedPercent,
    isRunningLow: usedPercent >= 80,
    todayLabel: formatTokens(todayUsed),
    todayDelta,
    todayTrendUp: todayDelta >= 0,
  }
})

const agentVisualMap: Record<string, AgentVisual> = {
  'policy-qa': { icon: IconMessageCircle, tone: 'icon-blue' },
  'image-analysis': { icon: IconImage, tone: 'icon-blue' },
  'meeting-notes': { icon: IconUsers, tone: 'icon-teal' },
  'ppt-creator': { icon: IconSparkles, tone: 'icon-orange' },
  'agent-workshop': { icon: IconBox, tone: 'icon-blue' },
  'code-assistant': { icon: IconCode2, tone: 'icon-cyan' },
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

function handleOpenTodo(payload: { id: string; date: string }) {
  void router.push({
    name: 'Home',
    query: { todo: payload.id, date: payload.date },
  })
}

const mobileSidebarMedia = window.matchMedia('(max-width: 760px)')

function syncSidebarForViewport(event?: MediaQueryListEvent) {
  const isMobile = event?.matches ?? mobileSidebarMedia.matches
  if (isMobile) sidebarCollapsed.value = false
}

onMounted(() => {
  syncSidebarForViewport()
  mobileSidebarMedia.addEventListener('change', syncSidebarForViewport)
})

onBeforeUnmount(() => {
  mobileSidebarMedia.removeEventListener('change', syncSidebarForViewport)
})
</script>

<template>
  <div class="agent-center-page">
    <DashboardTopBar @open-todo="handleOpenTodo" />

    <main
      class="agent-center-shell"
      :class="{ 'is-sidebar-collapsed': sidebarCollapsed }"
    >
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
      <header class="main-header">
        <div class="header-intro">
          <h1 class="page-title">智体中心</h1>

          <div class="metric-row" aria-label="Token 用量概览">
            <article class="metric-card token-card">
              <div class="token-card-head">
                <div class="token-card-meta">
                  <p>本月 Token 额度</p>
                  <strong>
                    {{ tokenUsage.remainingLabel }}
                    <span class="token-total">/ {{ tokenUsage.quotaLabel }}</span>
                  </strong>
                </div>
                <span class="metric-icon metric-blue">
                  <IconCoins />
                </span>
              </div>
              <div class="token-progress">
                <div
                  class="token-progress-bar"
                  role="progressbar"
                  :aria-valuenow="tokenUsage.usedPercent"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <span
                    class="token-progress-fill"
                    :class="{ 'is-low': tokenUsage.isRunningLow }"
                    :style="{ width: `${tokenUsage.usedPercent}%` }"
                  />
                </div>
                <span class="token-progress-meta">已用 {{ tokenUsage.usedPercent }}%</span>
              </div>
            </article>

            <article class="metric-card token-card">
              <div class="token-card-head">
                <div class="token-card-meta">
                  <p>今日消耗</p>
                  <strong>{{ tokenUsage.todayLabel }} <span class="token-unit">Tokens</span></strong>
                </div>
                <span class="metric-icon metric-teal">
                  <IconActivity />
                </span>
              </div>
              <span
                class="token-trend"
                :class="tokenUsage.todayTrendUp ? 'is-up' : 'is-down'"
              >
                <IconTrendingUp v-if="tokenUsage.todayTrendUp" />
                <IconTrendingDown v-else />
                较昨日 {{ tokenUsage.todayTrendUp ? '+' : '' }}{{ tokenUsage.todayDelta }}%
              </span>
            </article>
          </div>
        </div>

        <div class="header-cluster">
          <div class="utility-row">
            <label class="search-box">
              <span class="sr-only">搜索智能体或能力</span>
              <input
                v-model="searchKeyword"
                type="search"
                placeholder="搜索智能体或能力..."
                autocomplete="off"
              >
              <IconSearch class="search-icon" />
            </label>
          </div>
        </div>
      </header>

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

        <button type="button" class="sort-button" @click="showToast('已按推荐排序')">
          推荐排序
          <IconChevronDown />
        </button>
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

          <img :src="moreAbilityUrl" alt="" class="more-ability-art" aria-hidden="true">

          <div class="agent-card-footer">
            <span class="status-placeholder" aria-hidden="true" />
            <span class="agent-card-source">来自：智体中心</span>
          </div>
        </button>

        <p v-if="visibleAgents.length === 0" class="empty-message">
          没有匹配的智能体
        </p>
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
  background:
    radial-gradient(circle at 78% 0%, rgba(207, 229, 255, 0.75) 0, transparent 360px),
    linear-gradient(130deg, #f8fbff 0%, #edf6ff 52%, #f8fcff 100%);
  color: #111827;
  font-family:
    Inter,
    "PingFang SC",
    "Microsoft YaHei",
    system-ui,
    sans-serif;
}

.agent-center-shell {
  --sidebar-width: clamp(250px, 15vw, 288px);
  --sidebar-collapsed-width: 76px;
  --sidebar-card-margin: clamp(19px, 1.15vw, 22px);
  --main-pad-top: clamp(17px, 1.9vh, 21px);
  --main-pad-right: clamp(36px, 2.2vw, 42px);
  --main-pad-bottom: 32px;
  --main-pad-left: clamp(49px, 2.9vw, 56px);
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
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 249, 255, 0.98) 100%);
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
  background:
    linear-gradient(180deg, #ffffff 0%, #edf4ff 100%);
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

.main-header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 28px;
}

.header-intro {
  display: grid;
  gap: 14px;
}

.page-title {
  margin: 0;
  color: #101827;
  font-size: 30px;
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: 0;
}

.header-cluster {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
}

.utility-row {
  display: flex;
  align-items: center;
  gap: 20px;
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

.metric-row {
  display: grid;
  grid-template-columns: repeat(2, var(--metric-card-width));
  gap: clamp(13px, 0.8vw, 15px);
}

.metric-card {
  display: flex;
  height: var(--metric-card-height);
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  overflow: hidden;
  border: 1px solid rgba(227, 236, 250, 0.95);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 13px 30px rgba(83, 120, 171, 0.12);
  padding: 16px 18px;
}

.token-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.token-card-meta {
  min-width: 0;
}

.metric-card p {
  margin: 0 0 8px;
  color: #607ba3;
  font-size: 13px;
  font-weight: 700;
}

.metric-card strong {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: #091325;
  font-size: 27px;
  font-weight: 900;
  line-height: 1;
}

.token-total {
  color: #93a9c9;
  font-size: 14px;
  font-weight: 700;
}

.token-unit {
  color: #93a9c9;
  font-size: 13px;
  font-weight: 700;
}

.metric-icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 13px;
}

.metric-icon svg {
  width: 23px;
  height: 23px;
  stroke-width: 2.5;
}

.metric-blue {
  background: #eef5ff;
  color: #126cff;
}

.metric-teal {
  background: #ecfbfa;
  color: #19bcae;
}

.token-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.token-progress-bar {
  position: relative;
  height: 7px;
  flex: 1;
  overflow: hidden;
  border-radius: 999px;
  background: #e9eef7;
}

.token-progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: linear-gradient(90deg, #4c9dff 0%, #0966ff 100%);
  transition: width 360ms cubic-bezier(0.4, 0, 0.2, 1);
}

.token-progress-fill.is-low {
  background: linear-gradient(90deg, #ffb24c 0%, #f97316 100%);
}

.token-progress-meta {
  flex-shrink: 0;
  color: #607ba3;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.token-trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
}

.token-trend svg {
  width: 14px;
  height: 14px;
  stroke-width: 2.6;
}

.token-trend.is-up {
  color: #ef6b53;
}

.token-trend.is-down {
  color: #10a87c;
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
  margin-top: calc(var(--toolbar-gap) + 16px);
  margin-bottom: 12px;
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
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
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

.empty-message {
  grid-column: 1 / -1;
  margin: 40px 0;
  color: #6d83a8;
  font-size: 15px;
  font-weight: 700;
  text-align: center;
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
  .metric-row {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }

  .agent-center-shell {
    --agent-grid-columns: 3;
  }
}

@media (max-width: 1024px) {
  .agent-center-shell {
    --sidebar-width: 220px;
    --main-pad-top: 18px;
    --main-pad-right: 24px;
    --main-pad-bottom: 32px;
    --main-pad-left: 24px;
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

  .main-header {
    flex-direction: column;
    min-height: auto;
    margin-bottom: 20px;
  }

  .header-cluster {
    width: 100%;
    justify-content: flex-end;
  }

  .utility-row {
    justify-content: flex-end;
  }

  .metric-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
    padding: 18px 16px 28px;
  }

  .page-title {
    font-size: 25px;
  }

  .utility-row {
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 12px;
  }

  .search-box {
    width: min(100%, 360px);
  }

  .metric-row {
    grid-template-columns: 1fr;
  }

  .hero-banner {
    height: 168px;
  }

  .catalog-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .category-tabs {
    gap: 10px;
  }

  .category-tab {
    min-width: auto;
  }
}
</style>
