<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CalendarEvent, CalendarUser } from '@/modules/home/dashboard/config/types'
import { resolveHomeGreetingText } from '@/modules/home/dashboard/helpers/homeTimeOfDay'
import {
  formatEventTimeForDayList,
  getBackendTodoStatusLabel,
  getTodoListDisplayText,
  getTodoListRemarkLine,
  hasTodoRemark,
  isMeetingTodoEvent,
  ymd,
} from '@/modules/home/dashboard/helpers/todoDisplay'
import { useUserStore } from '@/stores/user.store'
import MobileDetailPanel from './components/MobileDetailPanel.vue'
import { useH5Todos } from './composables/useH5Todos'

const emit = defineEmits<{
  unauthorized: []
}>()

const userStore = useUserStore()
const activeDetailId = ref('')
const now = ref(new Date())

let clockTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 60_000)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const currentUser = computed<CalendarUser>(() => ({
  id: userStore.profile?.id ?? '',
  name: userStore.profile?.name ?? '未登录',
  role: userStore.profile?.role ?? 'employee',
  department: userStore.profile?.department,
  avatar: userStore.profile?.avatar,
}))

const {
  selectedDate,
  weekDays,
  selectedDayEvents,
  isLoading,
  loadError,
  detailEvent,
  isDetailLoading,
  detailError,
  isDetailOpen,
  refreshTodos,
  selectDate,
  shiftWeek,
  goToday,
  openDetail,
  closeDetail,
} = useH5Todos({
  currentUser: () => currentUser.value,
  onUnauthorized: () => emit('unauthorized'),
})

const selectedDateObj = computed(() => new Date(`${selectedDate.value}T12:00:00`))

const displayDateTitle = computed(
  () => `${selectedDateObj.value.getMonth() + 1}月${selectedDateObj.value.getDate()}日`,
)

const displayWeekdayCn = computed(() => {
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
    selectedDateObj.value.getDay()
  ]
  return weekday
})

const isTodaySelected = computed(() => selectedDate.value === ymd(new Date()))
const greetingText = computed(() => resolveHomeGreetingText(now.value))
const displayName = computed(() => userStore.profile?.name?.trim() || '未登录')

function getTimeLabel(event: CalendarEvent) {
  return formatEventTimeForDayList(event, selectedDate.value, {
    isToday: isTodaySelected.value,
    todayText: '今天',
  })
}

function getStatusTone(event: CalendarEvent) {
  const label = getBackendTodoStatusLabel(event)
  if (label === '已完成') return 'done'
  if (label === '已拒绝') return 'rejected'
  if (label === '已接受') return 'accepted'
  return 'pending'
}

function handleOpenDetail(id: string) {
  activeDetailId.value = id
  void openDetail(id)
}

function handleRetryDetail() {
  if (!activeDetailId.value) return
  void openDetail(activeDetailId.value)
}
</script>

<template>
  <div class="st-app">
    <header class="st-hero">
      <div class="st-hero__bar">
        <div class="st-hero__tools">
          <button v-if="!isTodaySelected" type="button" class="st-chip" @click="goToday">
            今天
          </button>
          <button
            type="button"
            class="st-icon-btn"
            :class="{ 'is-loading': isLoading }"
            :disabled="isLoading"
            :aria-label="isLoading ? '正在刷新' : '刷新日程'"
            :aria-busy="isLoading"
            @click="refreshTodos"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20 12a8 8 0 1 1-2.34-5.66"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
              <path
                d="M20 4v4h-4"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div class="st-hero__date">
        <div class="st-hero__date-main">
          <h1>{{ displayDateTitle }}</h1>
          <p>{{ displayWeekdayCn }}</p>
        </div>
        <div class="st-hero__who">
          <span class="st-hero__greet">{{ greetingText }}</span>
          <span class="st-hero__name">{{ displayName }}</span>
        </div>
      </div>

      <nav class="st-week" aria-label="周视图">
        <button type="button" class="st-week__arrow" aria-label="上一周" @click="shiftWeek(-7)">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <div class="st-week__days">
          <button
            v-for="day in weekDays"
            :key="day.date"
            type="button"
            class="st-day"
            :class="{ 'is-on': day.isSelected, 'is-now': day.isToday }"
            :aria-label="`${day.date}${day.hasMeeting ? '，有会议' : ''}${day.hasTask ? '，有待办' : ''}`"
            @click="selectDate(day.date)"
          >
            <span class="st-day__w">{{ day.weekday }}</span>
            <span class="st-day__n">
              <span v-if="day.hasMeeting || day.hasTask" class="st-day__dots" aria-hidden="true">
                <i v-if="day.hasMeeting" class="st-day__dot is-meeting" />
                <i v-if="day.hasTask" class="st-day__dot is-todo" />
              </span>
              <span>{{ day.day }}</span>
            </span>
          </button>
        </div>

        <button type="button" class="st-week__arrow" aria-label="下一周" @click="shiftWeek(7)">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 18l6-6-6-6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </nav>
    </header>

    <main class="st-main">
      <div class="st-sheet">
        <div class="st-sheet__head">
          <div>
            <p class="st-sheet__eyebrow">Schedule</p>
            <h2>{{ isTodaySelected ? '今日安排' : displayDateTitle }}</h2>
          </div>
          <span class="st-sheet__count">{{ selectedDayEvents.length }}</span>
        </div>

        <div v-if="isLoading" class="st-list-skeleton" role="status" aria-label="正在加载日程">
          <div v-for="index in 3" :key="index" class="st-list-skeleton__row">
            <div class="st-list-skeleton__time">
              <span class="st-skeleton st-skeleton--short" />
            </div>
            <div class="st-list-skeleton__body">
              <span class="st-skeleton st-skeleton--label" />
              <span class="st-skeleton st-skeleton--title" />
              <span class="st-skeleton st-skeleton--note" />
            </div>
          </div>
          <span class="st-sr-only">正在加载日程</span>
        </div>
        <div v-else-if="loadError" class="st-empty st-empty--error">
          <p>{{ loadError }}</p>
          <button type="button" class="st-link" @click="refreshTodos">重试</button>
        </div>
        <div v-else-if="!selectedDayEvents.length" class="st-empty">
          <div class="st-empty__visual" aria-hidden="true">
            <svg viewBox="0 0 80 72" fill="none">
              <path
                d="M18 19.5h44a7 7 0 0 1 7 7V58a7 7 0 0 1-7 7H18a7 7 0 0 1-7-7V26.5a7 7 0 0 1 7-7Z"
                fill="currentColor"
                fill-opacity=".08"
                stroke="currentColor"
                stroke-width="2.5"
              />
              <path d="M12 33h56" stroke="currentColor" stroke-width="2.5" />
              <path
                d="M25 12v14M55 12v14"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
              />
              <path
                d="m30 48 6 6 14-14"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <p class="st-empty__title">暂无安排</p>
          <p class="st-empty__sub">这一天暂时空着，切换日期看看吧</p>
        </div>

        <ul v-else class="st-events">
          <li v-for="event in selectedDayEvents" :key="event.id">
            <button
              type="button"
              class="st-event"
              :class="{
                'is-meeting': isMeetingTodoEvent(event),
                'is-task': !isMeetingTodoEvent(event),
                'is-done': event.status === 'done',
              }"
              @click="handleOpenDetail(event.id)"
            >
              <div class="st-event__rail">
                <time>{{ getTimeLabel(event) }}</time>
              </div>
              <div class="st-event__body">
                <div class="st-event__top">
                  <span class="st-event__kind">{{
                    isMeetingTodoEvent(event) ? '会议' : '待办'
                  }}</span>
                  <span class="st-event__status" :class="`tone-${getStatusTone(event)}`">{{
                    getBackendTodoStatusLabel(event)
                  }}</span>
                </div>
                <h3 class="st-event__title">{{ getTodoListDisplayText(event) }}</h3>
                <p class="st-event__note" :class="{ 'is-muted': !hasTodoRemark(event) }">
                  {{ getTodoListRemarkLine(event) }}
                </p>
              </div>
              <span class="st-event__go" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </main>

    <MobileDetailPanel
      :open="isDetailOpen"
      :loading="isDetailLoading"
      :error="detailError"
      :event="detailEvent"
      :current-user="currentUser"
      @close="closeDetail"
      @retry="handleRetryDetail"
    />
  </div>
</template>
