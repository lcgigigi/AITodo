<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import IconArrowLeft from '~icons/lucide/arrow-left'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconMailbox from '~icons/lucide/mailbox'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconSearch from '~icons/lucide/search'
import IconSparkles from '~icons/lucide/sparkles'
import {
  loadOpinionPage,
  toOpinionType,
  type OpinionCategory,
  type OpinionRecord,
  type OpinionStatistics,
  type OpinionType,
} from '@/modules/opinion-box/opinion-box.service'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'

defineOptions({
  name: 'SuggestionInboxPage',
})

type FilterCategory = 'all' | OpinionCategory

const categoryMeta: Record<
  OpinionCategory,
  { label: string; emoji: string; tone: string; soft: string; ink: string }
> = {
  feature: {
    label: '功能建议',
    emoji: '💡',
    tone: '#f59e0b',
    soft: '#fff7ed',
    ink: '#9a3412',
  },
  experience: {
    label: '体验感受',
    emoji: '✨',
    tone: '#0ea5e9',
    soft: '#eff6ff',
    ink: '#1d4ed8',
  },
  bug: {
    label: '发现问题',
    emoji: '🐛',
    tone: '#f43f5e',
    soft: '#fff1f2',
    ink: '#be123c',
  },
  other: {
    label: '其他想法',
    emoji: '💬',
    tone: '#8b5cf6',
    soft: '#f5f3ff',
    ink: '#6d28d9',
  },
}

const router = useRouter()
const activeFilter = ref<FilterCategory>('all')
const keywordInput = ref('')
const appliedKeyword = ref('')
const records = ref<OpinionRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10
const isLoading = ref(false)
const errorMessage = ref('')
const statistics = ref<OpinionStatistics>({
  totalCount: 0,
  todayCount: 0,
  type1Count: 0,
  type2Count: 0,
  type3Count: 0,
  type4Count: 0,
})
let requestSequence = 0

const typeToCategory: Record<OpinionType, OpinionCategory> = {
  1: 'feature',
  2: 'experience',
  3: 'bug',
  4: 'other',
}

const totalCount = computed(() => statistics.value.totalCount)
const todayCount = computed(() => statistics.value.todayCount)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

const categoryCounts = computed(() => ({
  feature: statistics.value.type1Count,
  experience: statistics.value.type2Count,
  bug: statistics.value.type3Count,
  other: statistics.value.type4Count,
}))

function getActiveType() {
  return activeFilter.value === 'all' ? undefined : toOpinionType(activeFilter.value)
}

function getCategory(type: OpinionType) {
  return typeToCategory[type]
}

function getAuthorInitial(record: OpinionRecord) {
  return (record.userName || record.userNo || '匿').slice(0, 1)
}

function formatCreateTime(value: string) {
  if (!value) return '时间未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function hasActiveListFilter() {
  return Boolean(getActiveType()) || Boolean(appliedKeyword.value)
}

async function fetchOpinions(options: { refreshGlobalStats?: boolean } = {}) {
  const currentRequest = ++requestSequence
  isLoading.value = true
  errorMessage.value = ''

  try {
    const listParams = {
      pageNum: pageNum.value,
      pageSize,
      keyword: appliedKeyword.value,
      type: getActiveType(),
    }
    const shouldRefreshGlobalStats = !hasActiveListFilter() || options.refreshGlobalStats

    if (shouldRefreshGlobalStats && hasActiveListFilter()) {
      const [result, statsResult] = await Promise.all([
        loadOpinionPage(listParams),
        loadOpinionPage({ pageNum: 1, pageSize: 1 }),
      ])
      if (currentRequest !== requestSequence) return

      records.value = result.rows
      total.value = result.total
      statistics.value = statsResult.statistics
      return
    }

    const result = await loadOpinionPage(listParams)
    if (currentRequest !== requestSequence) return

    records.value = result.rows
    total.value = result.total
    if (shouldRefreshGlobalStats) {
      statistics.value = result.statistics
    }
  } catch (error) {
    if (currentRequest !== requestSequence) return
    errorMessage.value = error instanceof Error ? error.message : '查询意见列表失败'
  } finally {
    if (currentRequest === requestSequence) {
      isLoading.value = false
    }
  }
}

function selectFilter(filter: FilterCategory) {
  if (activeFilter.value === filter) return
  activeFilter.value = filter
  pageNum.value = 1
  void fetchOpinions()
}

function applyKeyword() {
  const keyword = keywordInput.value.trim()
  if (appliedKeyword.value === keyword && pageNum.value === 1) {
    void fetchOpinions()
    return
  }

  appliedKeyword.value = keyword
  pageNum.value = 1
  void fetchOpinions()
}

function goToPage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === pageNum.value) return
  pageNum.value = nextPage
  void fetchOpinions()
}

function goHome() {
  void router.push({ name: 'Home' })
}

onMounted(() => {
  void fetchOpinions()
})
</script>

<template>
  <main class="suggestion-inbox-page">
    <div class="suggestion-inbox-bg" aria-hidden="true">
      <span class="suggestion-inbox-bg__orb suggestion-inbox-bg__orb--one" />
      <span class="suggestion-inbox-bg__orb suggestion-inbox-bg__orb--two" />
      <span class="suggestion-inbox-bg__orb suggestion-inbox-bg__orb--three" />
    </div>

    <div class="suggestion-inbox-shell">
      <header class="inbox-hero">
        <button type="button" class="inbox-back-btn" @click="goHome">
          <IconArrowLeft aria-hidden="true" />
          <span>返回工作台</span>
        </button>

        <div class="inbox-hero__main">
          <div class="inbox-hero__brand">
            <div class="inbox-hero__visual" aria-hidden="true">
              <span class="inbox-hero__mailbox">
                <IconMailbox />
              </span>
              <span class="inbox-hero__sparkle inbox-hero__sparkle--one">
                <IconSparkles />
              </span>
              <span class="inbox-hero__sparkle inbox-hero__sparkle--two">
                <IconSparkles />
              </span>
            </div>

            <div class="inbox-hero__copy">
              <p class="inbox-hero__kicker">Beta Voice Inbox</p>
              <h1>心声收件箱</h1>
            </div>
          </div>

          <section class="inbox-toolbar" aria-label="搜索与刷新">
            <form class="inbox-search" role="search" @submit.prevent="applyKeyword">
              <IconSearch aria-hidden="true" />
              <input
                v-model="keywordInput"
                type="search"
                maxlength="50"
                placeholder="搜索工号或用户名"
                aria-label="搜索工号或用户名"
              />
              <button type="submit">搜索</button>
            </form>

            <button
              type="button"
              class="inbox-refresh-btn"
              :disabled="isLoading"
              @click="fetchOpinions({ refreshGlobalStats: true })"
            >
              <IconRefreshCw :class="{ 'is-spinning': isLoading }" aria-hidden="true" />
              <span>刷新</span>
            </button>
          </section>
        </div>

        <div class="inbox-stats" aria-label="反馈统计与筛选">
          <button
            type="button"
            class="inbox-stat-card is-clickable"
            :class="{ 'is-active': activeFilter === 'all' }"
            :aria-pressed="activeFilter === 'all'"
            @click="selectFilter('all')"
          >
            <strong>{{ totalCount }}</strong>
            <span>累计心声</span>
          </button>
          <article class="inbox-stat-card is-today">
            <strong>{{ todayCount }}</strong>
            <span>今日新增</span>
          </article>
          <button
            v-for="category in ['feature', 'experience', 'bug', 'other'] as OpinionCategory[]"
            :key="category"
            type="button"
            class="inbox-stat-card is-category is-clickable"
            :class="{ 'is-active': activeFilter === category }"
            :style="{
              '--stat-accent': categoryMeta[category].tone,
              '--stat-soft': categoryMeta[category].soft,
            }"
            :aria-pressed="activeFilter === category"
            @click="selectFilter(category)"
          >
            <strong>{{ categoryCounts[category] }}</strong>
            <span>{{ categoryMeta[category].emoji }} {{ categoryMeta[category].label }}</span>
          </button>
        </div>
      </header>

      <AppStateBlock
        v-if="isLoading && records.length === 0"
        class="inbox-state"
        type="loading"
        title="正在收取心声"
        description="意见列表正在加载，请稍候。"
        size="sm"
        variant="inline"
      />

      <AppStateBlock
        v-else-if="errorMessage && records.length === 0"
        class="inbox-state"
        type="error"
        title="心声列表加载失败"
        :description="errorMessage"
        action-label="重新加载"
        size="sm"
        variant="inline"
        @action="fetchOpinions({ refreshGlobalStats: true })"
      />

      <AppStateBlock
        v-else-if="records.length === 0"
        class="inbox-state"
        type="empty"
        title="暂时没有匹配的心声"
        description="可以调整统计卡片筛选或搜索条件后再试。"
        size="sm"
        variant="inline"
      />

      <AppStateBlock
        v-if="errorMessage && records.length > 0"
        class="inbox-state"
        type="error"
        title="本次刷新失败"
        :description="errorMessage"
        action-label="重新加载"
        size="sm"
        variant="inline"
        @action="fetchOpinions({ refreshGlobalStats: true })"
      />

      <section v-if="records.length > 0" class="inbox-feed" aria-label="意见列表">
        <article
          v-for="(record, index) in records"
          :key="record.id"
          class="inbox-letter"
          :style="{
            '--letter-accent': categoryMeta[getCategory(record.type)].tone,
            '--letter-soft': categoryMeta[getCategory(record.type)].soft,
            '--letter-ink': categoryMeta[getCategory(record.type)].ink,
            '--letter-delay': `${Math.min(index, 8) * 45}ms`,
          }"
        >
          <div class="inbox-letter__stamp" aria-hidden="true">
            <span>{{ categoryMeta[getCategory(record.type)].emoji }}</span>
            <em>VOICE</em>
          </div>

          <header class="inbox-letter__header">
            <div class="inbox-letter__author">
              <span class="inbox-letter__avatar" aria-hidden="true">
                {{ getAuthorInitial(record) }}
              </span>
              <div>
                <strong>{{ record.userName }}</strong>
                <span>{{ record.userNo || '未提供工号' }}</span>
              </div>
            </div>

            <div class="inbox-letter__meta">
              <span class="inbox-letter__category">
                {{ categoryMeta[getCategory(record.type)].emoji }}
                {{ categoryMeta[getCategory(record.type)].label }}
              </span>
              <time :datetime="record.createTime || undefined">
                {{ formatCreateTime(record.createTime) }}
              </time>
            </div>
          </header>

          <p class="inbox-letter__content">{{ record.content || '未填写意见内容' }}</p>
        </article>
      </section>

      <nav v-if="totalPages > 1 && records.length > 0" class="inbox-pagination" aria-label="分页">
        <button
          type="button"
          :disabled="pageNum <= 1 || isLoading"
          aria-label="上一页"
          @click="goToPage(pageNum - 1)"
        >
          <IconChevronLeft aria-hidden="true" />
          上一页
        </button>
        <span>第 {{ pageNum }} / {{ totalPages }} 页，共 {{ total }} 条</span>
        <button
          type="button"
          :disabled="pageNum >= totalPages || isLoading"
          aria-label="下一页"
          @click="goToPage(pageNum + 1)"
        >
          下一页
          <IconChevronRight aria-hidden="true" />
        </button>
      </nav>
    </div>
  </main>
</template>

<style scoped>
.suggestion-inbox-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: radial-gradient(circle at 12% 18%, rgba(255, 237, 213, 0.72), transparent 28%),
    radial-gradient(circle at 88% 12%, rgba(191, 219, 254, 0.58), transparent 24%),
    linear-gradient(180deg, #fffaf5 0%, #f8fbff 48%, #eef4ff 100%);
  color: #0f172a;
}

.suggestion-inbox-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.suggestion-inbox-bg__orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(8px);
  opacity: 0.7;
}

.suggestion-inbox-bg__orb--one {
  top: 8%;
  left: -40px;
  width: 180px;
  height: 180px;
  background: rgba(253, 186, 116, 0.34);
}

.suggestion-inbox-bg__orb--two {
  top: 24%;
  right: -60px;
  width: 220px;
  height: 220px;
  background: rgba(125, 211, 252, 0.28);
}

.suggestion-inbox-bg__orb--three {
  bottom: -80px;
  left: 42%;
  width: 260px;
  height: 260px;
  background: rgba(196, 181, 253, 0.24);
}

.suggestion-inbox-shell {
  position: relative;
  z-index: 1;
  width: min(1320px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 28px 0 48px;
}

.inbox-back-btn {
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: #334155;
  padding: 8px 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 28px -22px rgba(15, 23, 42, 0.35);
  transition:
    transform 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.inbox-back-btn:hover,
.inbox-back-btn:focus-visible {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  outline: none;
}

.inbox-back-btn svg {
  width: 16px;
  height: 16px;
}

.inbox-hero {
  margin-top: 18px;
}

.inbox-hero__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-top: 22px;
}

.inbox-hero__brand {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 22px;
}

.inbox-hero__visual {
  position: relative;
  width: 92px;
  height: 72px;
  flex: 0 0 auto;
}

.inbox-hero__mailbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 22px;
  background: linear-gradient(135deg, #fde68a, #fdba74);
  color: #c2410c;
  box-shadow:
    0 18px 34px -18px rgba(234, 88, 12, 0.48),
    inset 0 1px 0 rgba(255, 255, 255, 0.58);
  animation: inbox-mailbox-bob 3s ease-in-out infinite;
}

.inbox-hero__mailbox svg {
  width: 34px;
  height: 34px;
}

.inbox-hero__sparkle {
  position: absolute;
  color: #f59e0b;
}

.inbox-hero__sparkle svg {
  width: 16px;
  height: 16px;
}

.inbox-hero__sparkle--one {
  top: 0;
  right: 4px;
  animation: inbox-sparkle 2.4s ease-in-out infinite;
}

.inbox-hero__sparkle--two {
  bottom: 6px;
  right: 22px;
  animation: inbox-sparkle 2.4s ease-in-out 0.7s infinite;
}

.inbox-hero__copy {
  min-width: 0;
}

.inbox-hero__kicker {
  margin: 0 0 8px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.inbox-hero__copy h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 42px);
  font-weight: 950;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.inbox-stats {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.inbox-stat-card {
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.76);
  backdrop-filter: blur(14px);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 16px 34px -26px rgba(15, 23, 42, 0.35);
  text-align: left;
}

.inbox-stat-card.is-clickable {
  font: inherit;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.inbox-stat-card.is-clickable:hover,
.inbox-stat-card.is-clickable:focus-visible {
  transform: translateY(-1px);
  border-color: rgba(245, 158, 11, 0.72);
  outline: none;
}

.inbox-stat-card.is-clickable.is-active {
  border-color: rgba(245, 158, 11, 0.88);
  box-shadow:
    0 16px 34px -26px rgba(15, 23, 42, 0.35),
    0 0 0 3px rgba(245, 158, 11, 0.12);
}

.inbox-stat-card strong {
  color: #0f172a;
  font-size: 24px;
  font-weight: 950;
  line-height: 1;
}

.inbox-stat-card span {
  color: #64748b;
  font-size: 12px;
  font-weight: 750;
}

.inbox-stat-card.is-today {
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.94), rgba(254, 215, 170, 0.72));
}

.inbox-stat-card.is-category {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), var(--stat-soft));
}

.inbox-stat-card.is-category strong {
  color: var(--stat-accent);
}

.inbox-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.inbox-search {
  min-width: 320px;
  height: 38px;
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  padding-left: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 12px 28px -24px rgba(15, 23, 42, 0.38);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.inbox-search:focus-within {
  border-color: rgba(245, 158, 11, 0.78);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
}

.inbox-search svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: #94a3b8;
}

.inbox-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: #334155;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
}

.inbox-search input::placeholder {
  color: #94a3b8;
}

.inbox-search input::-webkit-search-cancel-button {
  cursor: pointer;
}

.inbox-search button {
  align-self: stretch;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #fbbf24, #fb923c);
  color: #7c2d12;
  padding: 0 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.inbox-refresh-btn {
  flex: 0 0 auto;
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: #334155;
  padding: 8px 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    background 0.18s ease;
}

.inbox-refresh-btn:hover:not(:disabled),
.inbox-refresh-btn:focus-visible {
  transform: translateY(-1px);
  background: #ffffff;
  outline: none;
}

.inbox-refresh-btn:disabled {
  cursor: wait;
  opacity: 0.72;
}

.inbox-refresh-btn svg {
  width: 16px;
  height: 16px;
}

.inbox-refresh-btn svg.is-spinning {
  animation: inbox-spin 0.8s linear infinite;
}

.inbox-state {
  margin-top: 24px;
}

.inbox-feed {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.inbox-letter {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.88);
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), var(--letter-soft)),
    rgba(255, 255, 255, 0.88);
  padding: 22px 22px 18px;
  box-shadow:
    0 20px 40px -28px rgba(15, 23, 42, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  animation: inbox-letter-rise 0.42s ease both;
  animation-delay: var(--letter-delay);
}

.inbox-letter__stamp {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 58px;
  height: 58px;
  border: 2px dashed rgba(148, 163, 184, 0.42);
  border-radius: 999px;
  color: var(--letter-ink);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transform: rotate(12deg);
  opacity: 0.72;
}

.inbox-letter__stamp span {
  font-size: 18px;
  line-height: 1;
}

.inbox-letter__stamp em {
  font-size: 9px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.inbox-letter__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-right: 72px;
}

.inbox-letter__author {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.inbox-letter__avatar {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    var(--letter-accent),
    color-mix(in srgb, var(--letter-accent) 42%, white)
  );
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 900;
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28);
}

.inbox-letter__author div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inbox-letter__author strong {
  overflow: hidden;
  color: #0f172a;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-letter__author span {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-letter__meta {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.inbox-letter__category {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--letter-ink);
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 850;
}

.inbox-letter__meta time {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
}

.inbox-letter__content {
  margin: 16px 0 0;
  color: #1e293b;
  font-size: 15px;
  line-height: 1.75;
  font-weight: 600;
  white-space: pre-wrap;
}

.inbox-pagination {
  margin-top: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.inbox-pagination span {
  color: #64748b;
  font-size: 13px;
  font-weight: 750;
}

.inbox-pagination button {
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: #334155;
  padding: 8px 13px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.inbox-pagination button:hover:not(:disabled),
.inbox-pagination button:focus-visible {
  transform: translateY(-1px);
  border-color: rgba(245, 158, 11, 0.7);
  background: #ffffff;
  outline: none;
}

.inbox-pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.inbox-pagination button svg {
  width: 15px;
  height: 15px;
}

@keyframes inbox-mailbox-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes inbox-sparkle {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes inbox-letter-rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes inbox-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1080px) {
  .inbox-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .suggestion-inbox-shell {
    width: min(100vw - 24px, 1320px);
    padding-top: 18px;
  }

  .inbox-hero__main {
    flex-direction: column;
    align-items: stretch;
  }

  .inbox-hero__brand {
    align-items: flex-start;
  }

  .inbox-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .inbox-search {
    min-width: 0;
    flex: 1;
  }

  .inbox-refresh-btn {
    justify-content: center;
  }

  .inbox-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .inbox-letter__header {
    flex-direction: column;
    padding-right: 0;
  }

  .inbox-letter__meta {
    align-items: flex-start;
  }

  .inbox-letter__stamp {
    top: auto;
    bottom: 16px;
    right: 16px;
  }

  .inbox-pagination {
    flex-wrap: wrap;
    gap: 10px;
  }

  .inbox-pagination span {
    width: 100%;
    order: -1;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .inbox-hero__mailbox,
  .inbox-hero__sparkle,
  .inbox-letter,
  .inbox-refresh-btn svg.is-spinning {
    animation: none;
  }
}
</style>
