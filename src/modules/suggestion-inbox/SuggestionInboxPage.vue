<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import IconArrowLeft from '~icons/lucide/arrow-left'
import IconMailbox from '~icons/lucide/mailbox'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconSparkles from '~icons/lucide/sparkles'
import {
  loadSuggestions,
  type SuggestionCategory,
  type SuggestionRecord,
} from '@/modules/home/dashboard/suggestion.service'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'

defineOptions({
  name: 'SuggestionInboxPage',
})

type FilterCategory = 'all' | SuggestionCategory

const categoryMeta: Record<
  SuggestionCategory,
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

const filterOptions: Array<{ value: FilterCategory; label: string; emoji?: string }> = [
  { value: 'all', label: '全部', emoji: '📬' },
  { value: 'feature', label: '功能建议', emoji: '💡' },
  { value: 'experience', label: '体验感受', emoji: '✨' },
  { value: 'bug', label: '发现问题', emoji: '🐛' },
  { value: 'other', label: '其他想法', emoji: '💬' },
]

const router = useRouter()
const suggestions = ref<SuggestionRecord[]>([])
const activeFilter = ref<FilterCategory>('all')
const isLoading = ref(true)
const loadError = ref('')

const filteredSuggestions = computed(() => {
  if (activeFilter.value === 'all') return suggestions.value
  return suggestions.value.filter((item) => item.category === activeFilter.value)
})

const totalCount = computed(() => suggestions.value.length)

const todayCount = computed(() => {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`

  return suggestions.value.filter((item) => {
    if (!item.createTime) return false
    const date = new Date(item.createTime.replace(' ', 'T'))
    if (Number.isNaN(date.getTime())) return false
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    return key === todayKey
  }).length
})

const categoryCounts = computed(() => {
  const counts: Record<SuggestionCategory, number> = {
    feature: 0,
    experience: 0,
    bug: 0,
    other: 0,
  }

  suggestions.value.forEach((item) => {
    counts[item.category] += 1
  })

  return counts
})

const pageStateType = computed(() => {
  if (isLoading.value) return 'loading'
  if (loadError.value) return 'error'
  if (filteredSuggestions.value.length === 0) return 'empty'
  return null
})

function formatSuggestionTime(value?: string) {
  if (!value) return '刚刚投递'

  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value

  const diff = Date.now() - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`

  const month = date.getMonth() + 1
  const dayOfMonth = date.getDate()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}月${dayOfMonth}日 ${hours}:${minutes}`
}

function formatViewMode(viewMode?: SuggestionRecord['viewMode']) {
  if (viewMode === 'simple') return '简约模式'
  if (viewMode === 'detail') return '详细模式'
  return '未知场景'
}

function getInitial(name: string) {
  return name.trim().slice(0, 1) || '同'
}

async function refreshSuggestions() {
  isLoading.value = true
  loadError.value = ''

  try {
    suggestions.value = await loadSuggestions()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '加载建议列表失败'
    suggestions.value = []
  } finally {
    isLoading.value = false
  }
}

function goHome() {
  void router.push({ name: 'Home' })
}

onMounted(() => {
  void refreshSuggestions()
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
            <p>同事们投递的每一条体验反馈，都会在这里静静排好队等你翻阅。</p>
          </div>
        </div>

        <div class="inbox-stats" aria-label="反馈统计">
          <article class="inbox-stat-card">
            <strong>{{ totalCount }}</strong>
            <span>累计心声</span>
          </article>
          <article class="inbox-stat-card is-today">
            <strong>{{ todayCount }}</strong>
            <span>今日新增</span>
          </article>
          <article
            v-for="category in (['feature', 'experience', 'bug', 'other'] as SuggestionCategory[])"
            :key="category"
            class="inbox-stat-card is-category"
            :style="{
              '--stat-accent': categoryMeta[category].tone,
              '--stat-soft': categoryMeta[category].soft,
            }"
          >
            <strong>{{ categoryCounts[category] }}</strong>
            <span>{{ categoryMeta[category].emoji }} {{ categoryMeta[category].label }}</span>
          </article>
        </div>
      </header>

      <section class="inbox-toolbar" aria-label="反馈筛选">
        <div class="inbox-filters" role="tablist" aria-label="建议类型筛选">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            class="inbox-filter"
            :class="{ 'is-active': activeFilter === option.value }"
            role="tab"
            :aria-selected="activeFilter === option.value"
            @click="activeFilter = option.value"
          >
            <span v-if="option.emoji" aria-hidden="true">{{ option.emoji }}</span>
            <span>{{ option.label }}</span>
            <em v-if="option.value === 'all'">{{ totalCount }}</em>
            <em v-else>{{ categoryCounts[option.value] }}</em>
          </button>
        </div>

        <button
          type="button"
          class="inbox-refresh-btn"
          :disabled="isLoading"
          aria-label="刷新建议列表"
          @click="refreshSuggestions"
        >
          <IconRefreshCw aria-hidden="true" :class="{ 'is-spinning': isLoading }" />
          <span>{{ isLoading ? '刷新中…' : '刷新' }}</span>
        </button>
      </section>

      <AppStateBlock
        v-if="pageStateType"
        class="inbox-state"
        :type="pageStateType"
        :title="pageStateType === 'empty' ? '这个分类还没有心声' : undefined"
        :description="
          pageStateType === 'empty'
            ? '换个筛选看看，或者等同事们投递第一条反馈。'
            : loadError || undefined
        "
        :action-label="pageStateType === 'error' ? '重新加载' : undefined"
        size="sm"
        variant="inline"
        @action="refreshSuggestions"
      />

      <section v-else class="inbox-feed" aria-label="反馈列表">
        <article
          v-for="(item, index) in filteredSuggestions"
          :key="item.id"
          class="inbox-letter"
          :style="{
            '--letter-accent': categoryMeta[item.category].tone,
            '--letter-soft': categoryMeta[item.category].soft,
            '--letter-ink': categoryMeta[item.category].ink,
            '--letter-delay': `${Math.min(index, 8) * 40}ms`,
          }"
        >
          <div class="inbox-letter__stamp" aria-hidden="true">
            <span>{{ categoryMeta[item.category].emoji }}</span>
            <em>VOICE</em>
          </div>

          <header class="inbox-letter__header">
            <div class="inbox-letter__author">
              <span class="inbox-letter__avatar">{{ getInitial(item.userName) }}</span>
              <div>
                <strong>{{ item.userName }}</strong>
                <span>{{ item.department || '未填写部门' }}</span>
              </div>
            </div>

            <div class="inbox-letter__meta">
              <span class="inbox-letter__category">{{ categoryMeta[item.category].label }}</span>
              <time>{{ formatSuggestionTime(item.createTime) }}</time>
            </div>
          </header>

          <p class="inbox-letter__content">{{ item.content }}</p>

          <footer class="inbox-letter__footer">
            <span class="inbox-letter__chip">{{ formatViewMode(item.viewMode) }}</span>
            <span v-if="item.pageUrl" class="inbox-letter__chip is-muted">来自当前页面场景</span>
          </footer>
        </article>
      </section>
    </div>
  </main>
</template>

<style scoped>
.suggestion-inbox-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 18%, rgba(255, 237, 213, 0.72), transparent 28%),
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
  width: min(1120px, calc(100vw - 40px));
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
  gap: 22px;
  margin-top: 22px;
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
  margin: 0 0 8px;
  font-size: clamp(30px, 4vw, 42px);
  font-weight: 950;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.inbox-hero__copy p {
  margin: 0;
  max-width: 640px;
  color: #64748b;
  font-size: 15px;
  line-height: 1.6;
  font-weight: 600;
}

.inbox-stats {
  margin-top: 24px;
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
  margin-top: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.inbox-filters {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.inbox-filter {
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #475569;
  padding: 8px 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.inbox-filter em {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.96);
  color: #64748b;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}

.inbox-filter:hover,
.inbox-filter:focus-visible {
  transform: translateY(-1px);
  border-color: rgba(251, 191, 36, 0.72);
  color: #9a3412;
  outline: none;
}

.inbox-filter.is-active {
  border-color: rgba(245, 158, 11, 0.88);
  background: linear-gradient(135deg, rgba(254, 243, 199, 0.96), rgba(254, 215, 170, 0.88));
  color: #9a3412;
  box-shadow: 0 12px 24px -18px rgba(234, 88, 12, 0.45);
}

.inbox-filter.is-active em {
  background: rgba(255, 255, 255, 0.72);
  color: #c2410c;
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
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), var(--letter-soft)),
    rgba(255, 255, 255, 0.88);
  padding: 22px 22px 18px;
  box-shadow:
    0 20px 40px -28px rgba(15, 23, 42, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  animation: inbox-letter-rise 0.42s ease both;
  animation-delay: var(--letter-delay);
}

.inbox-letter::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 100%;
  background: linear-gradient(180deg, var(--letter-accent), transparent);
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
  background: linear-gradient(135deg, var(--letter-accent), color-mix(in srgb, var(--letter-accent) 42%, white));
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

.inbox-letter__footer {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.inbox-letter__chip {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--letter-ink);
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 800;
}

.inbox-letter__chip.is-muted {
  color: #64748b;
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
    width: min(100vw - 24px, 1120px);
    padding-top: 18px;
  }

  .inbox-hero__main {
    flex-direction: column;
    align-items: flex-start;
  }

  .inbox-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .inbox-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .inbox-refresh-btn {
    justify-content: center;
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
