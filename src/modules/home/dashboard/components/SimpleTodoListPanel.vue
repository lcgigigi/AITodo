<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconCheck from '~icons/lucide/check'
import IconInbox from '~icons/lucide/inbox'
import IconLayoutList from '~icons/lucide/layout-list'
import IconPresentation from '~icons/lucide/presentation'
import IconSend from '~icons/lucide/send'
import IconSquareCheck from '~icons/lucide/square-check'
import { routeConfig } from '@/config/route.config'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import { useFeedbackStore } from '@/stores/feedback.store'
import { useDashboardGlassSettings } from '../composables/useDashboardGlassSettings'
import { useDashboardTodos } from '../composables/useDashboardTodos'
import type { CalendarEvent, CalendarEventStatus } from '../config/types'
import { runDashboardTodoAction } from '../helpers/dashboardTodoActions'
import {
  eventTypeLabel,
  filterEventsByScope,
  filterEventsByType,
  isMeetingEvent,
  type TodoScopeFilter,
  type TodoTypeFilter,
} from '../helpers/dayPreviewPanel.helpers'
import {
  compareEvents,
  countTodoScopeEvents,
  formatEventTime,
  formatEventTimeForDayList,
  getTodoListDisplayText,
  getTodoScopeBadge,
  isRejectedTodo,
  isRangeEvent,
  isSameDayRangeEvent,
  ymd,
} from '../helpers/todoDisplay'
import { getTodoWeekRange } from '../services/todo.service'

defineOptions({
  name: 'SimpleTodoListPanel',
})

const now = ref(new Date())
const categoryFilter = ref<TodoTypeFilter>('all')
const scopeFilter = ref<TodoScopeFilter>('all')

const router = useRouter()
const feedbackStore = useFeedbackStore()
const { glassStyle } = useDashboardGlassSettings()

const {
  eventMap,
  initializeDashboardTodos,
  isLoading,
  isTodoStatusUpdating,
  refreshTodos,
  updateTodoStatusOptimistically,
} = useDashboardTodos({
  getLoadRange: getActiveTodoLoadRange,
  onUnauthorized: redirectToLogin,
})

let hasInitializedTodoRange = false
let clockTimer: ReturnType<typeof setInterval> | undefined

const todayDate = computed(() => ymd(now.value))
const todayEvents = computed(() => eventMap.value.get(todayDate.value) ?? [])
const todayTasks = computed(() =>
  filterEventsByScope(
    filterEventsByType([...todayEvents.value].sort(compareEvents), categoryFilter.value),
    scopeFilter.value,
  ),
)
const assignedByMeCount = computed(() =>
  countTodoScopeEvents(todayEvents.value, 'assigned_by_me'),
)
const assignedToMeCount = computed(() =>
  countTodoScopeEvents(todayEvents.value, 'assigned_to_me'),
)
const filterColumns = computed(() => {
  let count = 3
  if (assignedByMeCount.value > 0) count += 1
  if (assignedToMeCount.value > 0) count += 1
  return count
})
const todayAllCount = computed(() => todayEvents.value.length)
const todayTodoCount = computed(
  () => todayEvents.value.filter((event) => !isMeetingEvent(event)).length,
)
const todayMeetingCount = computed(
  () => todayEvents.value.filter((event) => isMeetingEvent(event)).length,
)

const emptyTitle = computed(() => {
  if (categoryFilter.value === 'task') return '今日暂无待办事项'
  if (categoryFilter.value === 'meeting') return '今日暂无会议信息'
  return '今日暂无待办'
})

const todoLoadRangeKey = computed(() => {
  const range = getTodoWeekRange(todayDate.value)
  return `${range.startDate}:${range.endDate}`
})

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 60_000)
  void initializeDashboardData()
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
})

function getActiveTodoLoadRange() {
  return getTodoWeekRange(todayDate.value)
}

function redirectToLogin() {
  void router.replace({
    path: routeConfig.loginRoute,
    query: { redirect: router.currentRoute.value.fullPath },
  })
}

async function initializeDashboardData() {
  const initialized = await initializeDashboardTodos()
  if (!initialized) return
  hasInitializedTodoRange = true
}

watch(todoLoadRangeKey, () => {
  if (!hasInitializedTodoRange) return
  void refreshTodos()
})

function selectCategoryFilter(filter: TodoTypeFilter) {
  categoryFilter.value = filter
  scopeFilter.value = 'all'
}

function selectScopeFilter(filter: Exclude<TodoScopeFilter, 'all'>) {
  scopeFilter.value = scopeFilter.value === filter ? 'all' : filter
  if (scopeFilter.value !== 'all') {
    categoryFilter.value = 'all'
  }
}

function formatTodoMeta(event: CalendarEvent) {
  return formatEventTimeForDayList(event, todayDate.value, {
    isToday: true,
    todayText: '今天',
  })
}

function formatTodoTimeTitle(event: CalendarEvent) {
  return formatEventTime(event)
}

function isCrossDayRangeOnList(event: CalendarEvent) {
  return isRangeEvent(event) && !isSameDayRangeEvent(event)
}

async function toggleTaskStatus(event: CalendarEvent) {
  if (isTodoStatusUpdating(event.id)) return

  if (event.completable === false) {
    feedbackStore.info('当前待办不可由你完成')
    return
  }

  const nextStatus: CalendarEventStatus = event.status === 'done' ? 'todo' : 'done'
  await runDashboardTodoAction(async () => {
    const updated = await updateTodoStatusOptimistically(event.id, nextStatus)
    if (!updated) throw new Error('待办状态正在更新')
    feedbackStore.success(nextStatus === 'done' ? '已标记完成' : '已撤销完成')
  })
}
</script>

<template>
  <section
    class="simple-todo-panel dashboard-glass-surface"
    :style="glassStyle"
    aria-label="今日待办"
  >
    <div class="simple-todo-body">
      <div
        class="simple-todo-filter-row"
        :style="{ '--simple-todo-filter-columns': filterColumns }"
        aria-label="今日待办统计"
      >
        <div class="simple-todo-stats">
          <button
            type="button"
            class="simple-todo-stat all-stat"
            :class="{
              active: categoryFilter === 'all' && scopeFilter === 'all',
            }"
            :aria-pressed="categoryFilter === 'all' && scopeFilter === 'all'"
            aria-label="今日全部待办"
            @click.stop="selectCategoryFilter('all')"
          >
            <span class="simple-todo-stat-icon" aria-hidden="true">
              <IconLayoutList />
            </span>
            <span class="simple-todo-stat-copy">
              <span>全部</span>
              <strong>{{ todayAllCount }}</strong>
            </span>
          </button>
          <button
            type="button"
            class="simple-todo-stat task-stat"
            :class="{ active: categoryFilter === 'task' }"
            :aria-pressed="categoryFilter === 'task'"
            aria-label="今日待办事项"
            @click.stop="selectCategoryFilter('task')"
          >
            <span class="simple-todo-stat-icon" aria-hidden="true">
              <IconSquareCheck />
            </span>
            <span class="simple-todo-stat-copy">
              <span>待办</span>
              <strong>{{ todayTodoCount }}</strong>
            </span>
          </button>
          <button
            type="button"
            class="simple-todo-stat meeting-stat"
            :class="{ active: categoryFilter === 'meeting' }"
            :aria-pressed="categoryFilter === 'meeting'"
            aria-label="今日会议"
            @click.stop="selectCategoryFilter('meeting')"
          >
            <span class="simple-todo-stat-icon" aria-hidden="true">
              <IconPresentation />
            </span>
            <span class="simple-todo-stat-copy">
              <span>会议</span>
              <strong>{{ todayMeetingCount }}</strong>
            </span>
          </button>
          <button
            v-if="assignedByMeCount > 0"
            type="button"
            class="simple-todo-stat outgoing-stat"
            :class="{ active: scopeFilter === 'assigned_by_me' }"
            :aria-pressed="scopeFilter === 'assigned_by_me'"
            aria-label="今日我派发的待办"
            @click.stop="selectScopeFilter('assigned_by_me')"
          >
            <span class="simple-todo-stat-icon" aria-hidden="true">
              <IconSend />
            </span>
            <span class="simple-todo-stat-copy">
              <span>我派发</span>
              <strong>{{ assignedByMeCount }}</strong>
            </span>
          </button>
          <button
            v-if="assignedToMeCount > 0"
            type="button"
            class="simple-todo-stat incoming-stat"
            :class="{ active: scopeFilter === 'assigned_to_me' }"
            :aria-pressed="scopeFilter === 'assigned_to_me'"
            aria-label="今日别人派发的待办"
            @click.stop="selectScopeFilter('assigned_to_me')"
          >
            <span class="simple-todo-stat-icon" aria-hidden="true">
              <IconInbox />
            </span>
            <span class="simple-todo-stat-copy">
              <span>派给我</span>
              <strong>{{ assignedToMeCount }}</strong>
            </span>
          </button>
        </div>
      </div>

      <section class="simple-todo-list-panel">
        <div class="simple-todo-scroll" aria-label="今日待办列表">
          <AppStateBlock
            v-if="isLoading"
            class="simple-todo-empty-state"
            type="loading"
            title="正在加载待办"
            description="同步完成后会自动展示在这里。"
            size="sm"
            variant="inline"
          />
          <AppStateBlock
            v-else-if="!todayTasks.length"
            class="simple-todo-empty-state"
            type="empty"
            :title="emptyTitle"
            description="切换筛选条件后可查看其他待办。"
            size="sm"
            variant="inline"
          />
          <article
            v-for="task in todayTasks"
            :key="task.id"
            class="simple-todo-item"
            :class="{
              'is-done': task.status === 'done',
              'is-rejected': isRejectedTodo(task),
              meeting: task.type === 'meeting',
              todo: task.type !== 'meeting',
              'scope-assigned_by_me': task.scope === 'assigned_by_me',
              'scope-assigned_to_me': task.scope === 'assigned_to_me',
            }"
          >
            <div class="simple-todo-item-leading">
              <div v-if="!isRejectedTodo(task)" class="simple-todo-check-wrap" @click.stop>
                <button
                  type="button"
                  class="simple-todo-check"
                  :class="{
                    checked: task.status === 'done',
                    'is-syncing': isTodoStatusUpdating(task.id),
                  }"
                  :aria-label="task.status === 'done' ? '撤销完成' : '标记完成'"
                  :disabled="task.completable === false || isTodoStatusUpdating(task.id)"
                  :aria-busy="isTodoStatusUpdating(task.id)"
                  @click="toggleTaskStatus(task)"
                >
                  <IconCheck v-if="task.status === 'done'" aria-hidden="true" />
                </button>
              </div>
              <time
                class="simple-todo-item-time"
                :class="{
                  'is-range': isRangeEvent(task),
                  'is-cross-range': isCrossDayRangeOnList(task),
                }"
                :title="formatTodoTimeTitle(task)"
              >
                {{ formatTodoMeta(task) }}
              </time>
            </div>
            <div class="simple-todo-item-main">
              <span
                class="simple-todo-type-tag"
                :class="isMeetingEvent(task) ? 'is-meeting' : 'is-task'"
              >
                {{ eventTypeLabel(task) }}
              </span>
              <span
                v-if="getTodoScopeBadge(task)"
                class="todo-scope-badge simple-todo-scope-badge"
                :class="`tone-${getTodoScopeBadge(task)!.tone}`"
              >
                {{ getTodoScopeBadge(task)!.label }}
              </span>
              <span class="simple-todo-item-title">{{ getTodoListDisplayText(task) }}</span>
            </div>
            <div class="simple-todo-item-aside">
              <span v-if="isRejectedTodo(task)" class="simple-todo-status-tag is-rejected">
                已拒绝
              </span>
              <span v-else-if="task.status === 'done'" class="simple-todo-status-tag">
                <IconCheck aria-hidden="true" />
                已完成
              </span>
            </div>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.simple-todo-panel {
  --simple-todo-ink: #13203a;
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  border-radius: 20px;
  padding: 0;
  box-sizing: border-box;
}

.simple-todo-body {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.58);
  padding: 7px 9px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.simple-todo-filter-row {
  flex: 0 0 auto;
  min-width: 0;
}

.simple-todo-stats {
  display: grid;
  grid-template-columns: repeat(var(--simple-todo-filter-columns, 3), minmax(0, 1fr));
  gap: 10px;
}

.simple-todo-stat {
  min-width: 0;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.simple-todo-stat.active {
  background: rgba(255, 255, 255, 0.92);
  box-shadow: inset 0 0 0 1px rgba(67, 139, 255, 0.18);
}

.simple-todo-stat-icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.simple-todo-stat-icon svg {
  width: 16px;
  height: 16px;
}

.all-stat .simple-todo-stat-icon {
  background: rgba(67, 139, 255, 0.14);
  color: #438bff;
}

.task-stat .simple-todo-stat-icon {
  background: rgba(40, 200, 121, 0.14);
  color: #28c879;
}

.meeting-stat .simple-todo-stat-icon {
  background: rgba(67, 139, 255, 0.14);
  color: #2f66c9;
}

.outgoing-stat .simple-todo-stat-icon {
  background: rgba(14, 116, 144, 0.14);
  color: #0e7490;
}

.incoming-stat .simple-todo-stat-icon {
  background: rgba(217, 119, 6, 0.14);
  color: #b45309;
}

.simple-todo-stat-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.simple-todo-stat-copy > span {
  color: #6d7c93;
  font-size: 11px;
  font-weight: 850;
}

.simple-todo-stat-copy strong {
  color: var(--simple-todo-ink);
  font-size: 18px;
  font-weight: 950;
  line-height: 1;
}

.simple-todo-list-panel {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.34);
  overflow: hidden;
}

.simple-todo-scroll {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  overflow-y: auto;
}

.simple-todo-empty-state {
  flex: 1 1 auto;
  min-height: 0;
  align-content: center;
}

.simple-todo-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 50px;
  padding: 0 14px 0 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.692);
}

.simple-todo-item.scope-assigned_by_me {
  background: linear-gradient(90deg, rgba(236, 254, 255, 0.72), rgba(255, 255, 255, 0)), #ffffff;
}

.simple-todo-item.scope-assigned_to_me {
  background: linear-gradient(90deg, rgba(255, 251, 235, 0.82), rgba(255, 255, 255, 0)), #ffffff;
}

.simple-todo-item-leading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.simple-todo-check {
  width: 21px;
  height: 21px;
  border: 2px solid #c6d2e2;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.96);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.simple-todo-check.checked {
  border-color: #16a34a;
  background: linear-gradient(180deg, #22c55e, #16a34a);
}

.simple-todo-check svg {
  width: 14px;
  height: 14px;
}

.simple-todo-item-main {
  min-width: 0;
  padding: 11px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.simple-todo-scope-badge {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
}

.simple-todo-item-title {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 14px;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.simple-todo-item-time {
  min-width: 3.1rem;
  color: #64748b;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
}

.simple-todo-item.todo .simple-todo-item-time {
  color: #059669;
}

.simple-todo-item.meeting .simple-todo-item-time {
  color: #2563eb;
}

.simple-todo-type-tag {
  flex: 0 0 auto;
  min-height: 22px;
  border-radius: 999px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 850;
}

.simple-todo-type-tag.is-task {
  background: rgba(218, 247, 232, 0.86);
  color: #08724f;
}

.simple-todo-type-tag.is-meeting {
  background: rgba(219, 234, 254, 0.92);
  color: #2f66c9;
}

.simple-todo-item-aside {
  display: flex;
  align-items: center;
}

.simple-todo-status-tag {
  min-height: 24px;
  border: 1px solid rgba(21, 128, 61, 0.2);
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.1);
  color: #15803d;
  padding: 0 8px 0 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 900;
}

.simple-todo-status-tag svg {
  width: 12px;
  height: 12px;
}

.simple-todo-status-tag.is-rejected {
  border-color: rgba(220, 38, 38, 0.22);
  background: rgba(254, 226, 226, 0.92);
  color: #991b1b;
}

.simple-todo-item.is-done {
  opacity: 0.85;
}

.simple-todo-item.is-done .simple-todo-item-title {
  color: #94a3b8;
  text-decoration: line-through;
}

.simple-todo-item.is-rejected {
  background: linear-gradient(90deg, rgba(254, 242, 242, 0.92), rgba(255, 255, 255, 0.72));
}
</style>
