<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CalendarEvent, CalendarUser } from '@/modules/home/dashboard/config/types'
import { buildTodoDetailPanelViewModel } from '@/modules/home/dashboard/helpers/todoDetailPanel.helpers'

const props = defineProps<{
  open: boolean
  loading?: boolean
  error?: string
  event: CalendarEvent | null
  currentUser: CalendarUser
}>()

const emit = defineEmits<{
  close: []
  retry: []
}>()

const drawerBody = ref<HTMLElement | null>(null)
const dragOffset = ref(0)
const isDragging = ref(false)
const isDismissing = ref(false)

let gestureCanDismiss = false
let gestureStartY = 0
let gestureStartTime = 0

const drawerStyle = computed(() => ({
  transform: `translate3d(0, ${dragOffset.value}px, 0)`,
}))

const maskStyle = computed(() => ({
  opacity: String(Math.max(0, 1 - dragOffset.value / 360)),
}))

const panel = computed(() => {
  if (!props.event) return null
  return buildTodoDetailPanelViewModel(props.event, props.currentUser)
})

const timeText = computed(() => {
  if (!panel.value) return ''
  return Array.isArray(panel.value.time) ? panel.value.time.join(' · ') : panel.value.time
})

function toneClass(tone: string) {
  if (tone === 'done') return 'tone-done'
  if (tone === 'rejected') return 'tone-rejected'
  if (tone === 'accepted') return 'tone-accepted'
  return 'tone-pending'
}

function getNameInitial(name: string) {
  return name.trim().slice(0, 1) || '·'
}

function resetDrag() {
  isDragging.value = false
  isDismissing.value = false
  dragOffset.value = 0
  gestureCanDismiss = false
}

function handleTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1 || isDismissing.value) return

  gestureCanDismiss = (drawerBody.value?.scrollTop ?? 0) <= 0
  gestureStartY = event.touches[0]?.clientY ?? 0
  gestureStartTime = performance.now()
  isDragging.value = false
}

function handleTouchMove(event: TouchEvent) {
  if (!gestureCanDismiss || event.touches.length !== 1) return

  const currentY = event.touches[0]?.clientY ?? gestureStartY
  const deltaY = currentY - gestureStartY

  if (deltaY <= 0) {
    dragOffset.value = 0
    return
  }

  event.preventDefault()
  isDragging.value = true
  dragOffset.value = Math.min(deltaY * 0.82, window.innerHeight * 0.58)
}

function handleTouchEnd() {
  if (!gestureCanDismiss) return

  const elapsed = Math.max(performance.now() - gestureStartTime, 1)
  const velocity = dragOffset.value / elapsed
  const shouldDismiss = dragOffset.value >= 110 || velocity >= 0.55

  gestureCanDismiss = false
  isDragging.value = false

  if (!shouldDismiss) {
    dragOffset.value = 0
    return
  }

  isDismissing.value = true
  dragOffset.value = window.innerHeight
  window.setTimeout(() => {
    emit('close')
    resetDrag()
  }, 220)
}

function handleTouchCancel() {
  resetDrag()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="st-drawer" role="dialog" aria-modal="true" aria-label="待办详情">
      <button
        type="button"
        class="st-drawer__mask"
        :class="{ 'is-dragging': isDragging }"
        :style="maskStyle"
        aria-label="关闭"
        @click="emit('close')"
      />

      <div
        class="st-drawer__panel"
        :class="{ 'is-dragging': isDragging, 'is-dismissing': isDismissing }"
        :style="drawerStyle"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchCancel"
      >
        <div class="st-drawer__grab" aria-hidden="true" />

        <header class="st-drawer__head">
          <button
            type="button"
            class="st-drawer__close"
            aria-label="关闭详情"
            @click="emit('close')"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </header>

        <div ref="drawerBody" class="st-drawer__body">
          <div v-if="loading" class="st-detail-skeleton" role="status" aria-label="正在加载详情">
            <div class="st-detail-skeleton__hero">
              <div class="st-detail-skeleton__tags">
                <span class="st-skeleton st-skeleton--pill" />
                <span class="st-skeleton st-skeleton--pill is-small" />
              </div>
              <span class="st-skeleton st-skeleton--detail-title" />
              <span class="st-skeleton st-skeleton--detail-title is-short" />
              <span class="st-skeleton st-skeleton--detail-copy" />
            </div>
            <div v-for="index in 2" :key="index" class="st-detail-skeleton__section">
              <span class="st-skeleton st-skeleton--section-label" />
              <span class="st-skeleton st-skeleton--section-line" />
              <span class="st-skeleton st-skeleton--section-line is-short" />
            </div>
            <span class="st-sr-only">正在加载详情</span>
          </div>
          <div v-else-if="error" class="st-empty st-empty--error">
            <p>{{ error }}</p>
            <button type="button" class="st-link" @click="emit('retry')">重试</button>
          </div>

          <template v-else-if="panel">
            <div
              class="st-detail-hero"
              :class="panel.typeTone === 'meeting' ? 'is-meeting' : 'is-task'"
            >
              <div class="st-detail-hero__tags">
                <span class="st-badge" :class="toneClass(panel.statusTone)">{{
                  panel.statusLabel
                }}</span>
                <span
                  class="st-badge"
                  :class="panel.typeTone === 'meeting' ? 'is-meeting' : 'is-task'"
                  >{{ panel.typeLabel }}</span
                >
              </div>
              <h2>{{ panel.content }}</h2>
              <p v-if="!panel.remarkIsEmpty" class="st-detail-hero__desc">{{ panel.remark }}</p>
              <p v-if="panel.rejectionNote" class="st-detail-hero__alert">
                {{ panel.rejectionNote }}
              </p>
            </div>

            <section class="st-block st-block--time">
              <div class="st-block__title">
                <span class="st-block__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                    />
                  </svg>
                </span>
                <div>
                  <h3>时间安排</h3>
                  <p>日程时间</p>
                </div>
              </div>
              <p class="st-time-value">{{ timeText }}</p>
            </section>

            <section class="st-block">
              <div class="st-section-heading">
                <h3>基本信息</h3>
                <span>DETAILS</span>
              </div>
              <dl class="st-kv">
                <div v-for="item in panel.meta" :key="item.key">
                  <dt>{{ item.label }}</dt>
                  <dd>{{ item.value }}</dd>
                </div>
              </dl>
            </section>

            <section v-if="panel.assigneeProgress?.length" class="st-block">
              <div class="st-section-heading">
                <h3>执行进度</h3>
                <span>{{ panel.assigneeProgress.length }} 人</span>
              </div>
              <ul class="st-notes st-notes--people">
                <li v-for="item in panel.assigneeProgress" :key="item.id">
                  <span class="st-notes__avatar" aria-hidden="true">{{
                    getNameInitial(item.name)
                  }}</span>
                  <div class="st-notes__content">
                    <div class="st-notes__head">
                      <strong>{{ item.name }}</strong>
                      <span class="st-badge" :class="toneClass(item.statusTone)">{{
                        item.statusLabel
                      }}</span>
                    </div>
                    <p v-if="item.lastProcess">{{ item.lastProcess }}</p>
                    <p v-else-if="item.note">{{ item.note }}</p>
                  </div>
                </li>
              </ul>
            </section>

            <section v-if="panel.processSection?.items.length" class="st-block">
              <div class="st-section-heading">
                <h3>进展记录</h3>
                <span>{{ panel.processSection.items.length }} 条</span>
              </div>
              <ul class="st-notes st-notes--timeline">
                <li v-for="item in panel.processSection.items" :key="item.processId">
                  <span class="st-notes__avatar" aria-hidden="true">{{
                    getNameInitial(item.creatorName)
                  }}</span>
                  <div class="st-notes__content">
                    <div class="st-notes__head">
                      <strong>{{ item.creatorName }}</strong>
                      <time>{{ item.createTime }}</time>
                    </div>
                    <p>{{ item.todoProcess }}</p>
                  </div>
                </li>
              </ul>
            </section>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
