<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import IconBell from '~icons/lucide/bell'
import IconCheckCheck from '~icons/lucide/check-check'
import IconExternalLink from '~icons/lucide/external-link'
import IconTrash2 from '~icons/lucide/trash-2'
import IconX from '~icons/lucide/x'
import AppStateBlock from '@/shared/components/state/AppStateBlock.vue'
import type { InboxItem } from '@/modules/home/dashboard/notification.inbox'
import { useDashboardGlassSettings } from '@/modules/home/dashboard/useDashboardGlassSettings'
import { useDashboardNotifications } from '@/modules/home/dashboard/useDashboardNotifications'

const props = withDefaults(
  defineProps<{
    layout?: 'popover' | 'embedded'
    open?: boolean
    usePortal?: boolean
    portalTarget?: HTMLElement | null
  }>(),
  {
    layout: 'popover',
    open: false,
    usePortal: false,
    portalTarget: null,
  },
)

const emit = defineEmits<{
  'calendar-refresh': []
  'open-todo': [payload: { id: string; date?: string; source?: 'pending-inbox' }]
  close: []
  'update:open': [value: boolean]
}>()

interface NotificationPanelPosition {
  top: number
  width: number
  arrowCenter: number
  right?: number
  left?: number
}

const notificationPanelRef = ref<HTMLElement | null>(null)
const notificationPanelPortalRef = ref<HTMLElement | null>(null)
const notificationPanelPosition = ref<NotificationPanelPosition>({
  top: 0,
  right: 16,
  width: 400,
  arrowCenter: 123,
})
const notificationBackdropTop = ref(0)
const { glassStyle } = useDashboardGlassSettings()

const isScopedPortal = computed(() => props.usePortal && Boolean(props.portalTarget))
const teleportTarget = computed(() => props.portalTarget ?? 'body')

function closePanel() {
  emit('update:open', false)
  emit('close')
}

const {
  inboxFilter,
  isInboxLoading,
  isInboxLoadingMore,
  isInboxListLoading,
  inboxError,
  filteredInboxItems,
  actionableInboxCount,
  inboxTotalCount,
  unreadNotificationCount,
  processingSysMessageId,
  pendingError,
  activeActionId,
  activeActionMode,
  rejectReason,
  processingId,
  hasMoreInboxMessages,
  formatInboxTime,
  isInboxItemOpenable,
  refreshInbox,
  loadMoreInboxMessages,
  setInboxFilter,
  handleMarkInboxItemRead,
  handleMarkAllInboxRead,
  handleDeleteInboxItem,
  handleOpenInboxItem,
  refreshPendingTodos,
  resetPendingAction,
  togglePendingAction,
  handleAcceptTodo,
  handleRejectTodo,
  refreshNotificationsOnOpen,
} = useDashboardNotifications({
  onCalendarRefresh: () => emit('calendar-refresh'),
  onOpenTodo: (payload) => emit('open-todo', payload),
  onClose: () => closePanel(),
})

const isEmbedded = computed(() => props.layout === 'embedded')
const isPopoverOpen = computed(() => (isEmbedded.value ? true : props.open))

function shouldShowInboxSummary(item: InboxItem) {
  if (item.kind === 'todo_pending') return Boolean(item.summary)
  return Boolean(item.summary)
}

function shouldShowInboxDetails(item: InboxItem) {
  return item.details.length > 0
}

const scopedBackdropStyle = computed(() => {
  if (!isScopedPortal.value) return undefined
  return {
    top: `${notificationBackdropTop.value}px`,
  }
})

const notificationPanelStyle = computed(() => {
  if (isEmbedded.value) return undefined
  if (props.usePortal) {
    const position = notificationPanelPosition.value
    const style: Record<string, string> = {
      width: `${position.width}px`,
      ...glassStyle.value,
      '--notification-arrow-center': `${position.arrowCenter}px`,
    }

    if (isScopedPortal.value) {
      style.top = `${position.top}px`
      style.right = `${position.right}px`
      style.left = 'auto'
    } else {
      style.top = `${position.top}px`
      style.left = `${position.left ?? 16}px`
    }

    return style
  }
  return undefined
})

function getNotificationAnchorRect(wrap: HTMLElement) {
  const bellButton = wrap.querySelector('.notification-bell')
  return (bellButton instanceof HTMLElement ? bellButton : wrap).getBoundingClientRect()
}

function updateNotificationPanelPosition() {
  const wrap = notificationPanelRef.value
  if (!wrap) return

  const padding = 12
  const anchorRect = getNotificationAnchorRect(wrap)

  if (isScopedPortal.value && props.portalTarget) {
    const containerRect = props.portalTarget.getBoundingClientRect()
    const topbar = props.portalTarget.querySelector('.dashboard-topbar.is-embedded')
    const topbarBottom =
      topbar instanceof HTMLElement
        ? Math.max(0, topbar.getBoundingClientRect().bottom - containerRect.top)
        : 56
    notificationBackdropTop.value = topbarBottom

    const bellRightOffset = Math.max(padding, containerRect.right - anchorRect.right)
    const right = bellRightOffset
    const maxWidthAtAnchor = containerRect.width - right - padding
    const panelWidth = Math.min(400, containerRect.width - padding * 2, maxWidthAtAnchor)
    const top = Math.max(topbarBottom + 4, anchorRect.bottom - containerRect.top + 6)
    const panelRightAbs = containerRect.right - right
    const bellCenterX = anchorRect.left + anchorRect.width / 2
    const arrowCenter = Math.max(28, Math.min(panelWidth - 28, panelRightAbs - bellCenterX))

    notificationPanelPosition.value = {
      top,
      right,
      width: panelWidth,
      arrowCenter,
    }
    return
  }

  const panelWidth = Math.min(400, window.innerWidth - 32)
  let left = anchorRect.right - panelWidth - 64
  left = Math.max(16, Math.min(left, window.innerWidth - panelWidth - 16))

  notificationPanelPosition.value = {
    top: anchorRect.bottom + 16,
    left,
    width: panelWidth,
    arrowCenter: 123,
  }
}

async function togglePanel() {
  if (isEmbedded.value) return

  if (!props.open) {
    if (props.usePortal) updateNotificationPanelPosition()
    emit('update:open', true)

    if (props.usePortal) {
      await nextTick()
      updateNotificationPanelPosition()
    }

    void refreshNotificationsOnOpen()
    return
  }

  emit('update:open', false)
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (isEmbedded.value || !props.open) return

  const target = event.target as Node
  const insideNotification =
    notificationPanelRef.value?.contains(target) ||
    notificationPanelPortalRef.value?.contains(target)

  if (!insideNotification) {
    closePanel()
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (isEmbedded.value || !props.open) return
  if (event.key === 'Escape') closePanel()
}

onMounted(() => {
  if (!isEmbedded.value) {
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleDocumentKeydown)
  }
})

onBeforeUnmount(() => {
  if (!isEmbedded.value) {
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
    document.removeEventListener('keydown', handleDocumentKeydown)
  }
})

watch(
  () => props.open,
  async (nextOpen) => {
    if (nextOpen && props.usePortal) {
      await nextTick()
      updateNotificationPanelPosition()
    }
  },
)

watch(
  () => props.portalTarget,
  () => {
    if (props.open && props.usePortal) updateNotificationPanelPosition()
  },
)

defineExpose({
  unreadNotificationCount,
  updateNotificationPanelPosition,
  refreshPendingTodos,
})
</script>

<template>
  <div
    ref="notificationPanelRef"
    class="notification-center"
    :class="{
      'is-embedded': isEmbedded,
      'is-popover': !isEmbedded,
      'is-open': !isEmbedded && open,
    }"
  >
    <button
      v-if="!isEmbedded"
      class="notification-bell icon-button has-badge"
      type="button"
      aria-label="消息通知"
      aria-controls="dashboard-notification-panel"
      :aria-expanded="isPopoverOpen"
      data-tour-target="notifications"
      @click="togglePanel"
    >
      <IconBell />
      <span v-if="unreadNotificationCount">{{ unreadNotificationCount }}</span>
    </button>

    <Teleport :to="teleportTarget" :disabled="!usePortal">
      <Transition name="notification-backdrop">
        <button
          v-if="!isEmbedded && usePortal && open"
          type="button"
          class="notification-backdrop"
          :class="{ 'is-scoped': isScopedPortal }"
          :style="scopedBackdropStyle"
          aria-label="关闭消息通知"
          @click="closePanel"
        />
      </Transition>
      <Transition name="notification-popover">
        <section
          v-if="isPopoverOpen"
          ref="notificationPanelPortalRef"
          id="dashboard-notification-panel"
          class="notification-panel"
          :class="{
            'is-portal': usePortal && !isScopedPortal,
            'is-scoped-portal': isScopedPortal,
            'is-embedded-panel': isEmbedded,
          }"
          :style="notificationPanelStyle"
          aria-label="消息通知"
          data-tour-target="notification-panel"
        >
          <span
            v-if="!isEmbedded && (!usePortal || isScopedPortal)"
            class="notification-panel__arrow"
            aria-hidden="true"
          />
          <header class="notification-panel__header">
            <div>
              <strong>消息中心</strong>
            </div>
            <button
              type="button"
              aria-label="全部标记已读"
              title="全部标记已读"
              :disabled="actionableInboxCount === 0 || processingSysMessageId === 'all'"
              @click="handleMarkAllInboxRead()"
            >
              <IconCheckCheck />
            </button>
            <button
              v-if="!isEmbedded"
              type="button"
              aria-label="关闭消息通知"
              title="关闭消息通知"
              @click="closePanel"
            >
              <IconX />
            </button>
          </header>

          <div class="notification-filter" aria-label="消息筛选">
            <button
              type="button"
              :class="{ active: inboxFilter === 'actionable' }"
              @click="setInboxFilter('actionable')"
            >
              待处理
              <span>{{ actionableInboxCount }}</span>
            </button>
            <button
              type="button"
              :class="{ active: inboxFilter === 'all' }"
              @click="setInboxFilter('all')"
            >
              全部
              <span>{{ inboxTotalCount }}</span>
            </button>
          </div>

          <div class="notification-list" data-tour-target="notification-list">
            <AppStateBlock
              v-if="inboxError || pendingError"
              class="notification-state"
              type="error"
              title="消息加载失败"
              :description="inboxError || pendingError"
              action-label="重新加载"
              size="sm"
              variant="inline"
              @action="refreshInbox()"
            />
            <AppStateBlock
              v-else-if="isInboxListLoading"
              class="notification-state"
              type="loading"
              title="正在加载消息"
              description="待办通知和协作消息会在这里汇总展示。"
              size="sm"
              variant="inline"
            />
            <AppStateBlock
              v-else-if="!filteredInboxItems.length"
              class="notification-state"
              type="empty"
              :title="inboxFilter === 'actionable' ? '暂无待处理消息' : '暂无消息'"
              description="别人派发给你的待办、会议提醒和系统通知都会出现在这里。"
              size="sm"
              variant="inline"
            />

            <article
              v-for="item in filteredInboxItems"
              :key="item.id"
              class="notification-item"
              :class="{
                'is-unread': item.isUnread,
                'is-clickable': item.kind === 'todo_pending',
              }"
              :role="item.kind === 'todo_pending' ? 'button' : undefined"
              :tabindex="item.kind === 'todo_pending' ? 0 : undefined"
              @click="item.kind === 'todo_pending' ? handleOpenInboxItem(item) : undefined"
              @keydown.enter="item.kind === 'todo_pending' ? handleOpenInboxItem(item) : undefined"
              @keydown.space.prevent="
                item.kind === 'todo_pending' ? handleOpenInboxItem(item) : undefined
              "
            >
              <span
                class="notification-item__marker"
                :class="item.markerClass"
                aria-hidden="true"
              />
              <div class="notification-item__content">
                <div class="notification-item__meta-row">
                  <span
                    class="notification-item__tag"
                    :class="{
                      'is-pending': item.kind === 'todo_pending',
                      'is-meeting': item.kind === 'meeting',
                    }"
                  >
                    {{ item.statusLabel }}
                  </span>
                  <time>{{ formatInboxTime(item.createTime) }}</time>
                </div>

                <strong class="notification-item__title">{{ item.title }}</strong>

                <p v-if="shouldShowInboxSummary(item)" class="notification-item__summary">
                  {{ item.summary }}
                </p>

                <dl v-if="shouldShowInboxDetails(item)" class="notification-item__details">
                  <div
                    v-for="detail in item.details"
                    :key="`${item.id}-${detail.label}`"
                    class="notification-item__detail"
                  >
                    <dt>{{ detail.label }}</dt>
                    <dd>{{ detail.value }}</dd>
                  </div>
                </dl>

                <div class="notification-item__actions" @click.stop>
                  <template v-if="item.kind === 'todo_pending'">
                    <button
                      type="button"
                      class="action-btn is-accept"
                      :disabled="processingId === item.todoId"
                      @click="handleAcceptTodo(item.todoId!)"
                    >
                      {{
                        processingId === item.todoId && activeActionMode !== 'reject'
                          ? '处理中…'
                          : '接受'
                      }}
                    </button>
                    <button
                      type="button"
                      class="action-btn is-reject"
                      :disabled="processingId === item.todoId"
                      @click="togglePendingAction(item.todoId!, 'reject')"
                    >
                      拒绝
                    </button>
                    <button
                      type="button"
                      class="action-btn is-view"
                      @click="handleOpenInboxItem(item)"
                    >
                      查看
                    </button>
                  </template>

                  <template v-else>
                    <button
                      v-if="isInboxItemOpenable(item)"
                      type="button"
                      class="action-btn is-view has-icon"
                      :disabled="processingSysMessageId === item.id"
                      @click="handleOpenInboxItem(item)"
                    >
                      <IconExternalLink aria-hidden="true" />
                      <span>{{ processingSysMessageId === item.id ? '打开中…' : '查看' }}</span>
                    </button>
                    <button
                      v-if="item.isUnread"
                      type="button"
                      class="action-btn is-accept has-icon"
                      :disabled="processingSysMessageId === item.id"
                      @click="handleMarkInboxItemRead(item)"
                    >
                      <IconCheckCheck aria-hidden="true" />
                      <span>已读</span>
                    </button>
                    <button
                      type="button"
                      class="action-btn is-reject has-icon"
                      :disabled="processingSysMessageId === item.id"
                      @click="handleDeleteInboxItem(item)"
                    >
                      <IconTrash2 aria-hidden="true" />
                      <span>删除</span>
                    </button>
                  </template>
                </div>

                <div
                  v-if="
                    item.kind === 'todo_pending' &&
                    activeActionId === item.todoId &&
                    activeActionMode === 'reject'
                  "
                  class="notification-item__form"
                  @click.stop
                >
                  <input
                    v-model="rejectReason"
                    type="text"
                    class="notification-input"
                    placeholder="拒绝原因（可选）"
                  />
                  <div class="notification-item__form-actions">
                    <button
                      type="button"
                      class="action-btn is-reject"
                      :disabled="processingId === item.todoId"
                      @click="handleRejectTodo(item.todoId!)"
                    >
                      确认拒绝
                    </button>
                    <button type="button" class="action-btn is-muted" @click="resetPendingAction()">
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </article>

            <button
              v-if="hasMoreInboxMessages && !isInboxLoading && inboxFilter === 'all'"
              type="button"
              class="notification-load-more"
              :disabled="isInboxLoadingMore"
              @click="loadMoreInboxMessages()"
            >
              {{ isInboxLoadingMore ? '加载中…' : '加载更多' }}
            </button>
          </div>
        </section>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.notification-center.is-popover {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.notification-center.is-open {
  z-index: 1;
}

.notification-center.is-open .notification-bell {
  border-color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.62);
  color: #111827;
  box-shadow: 0 12px 26px -18px rgba(15, 23, 42, 0.42);
}

.notification-center.is-embedded {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.icon-button {
  position: relative;
  width: 40px;
  height: 40px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: #21304f;
  cursor: pointer;
  font: inherit;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.icon-button svg {
  width: 18px;
  height: 18px;
}

.icon-button:hover {
  border-color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.62);
  color: #111827;
  transform: translateY(-1px);
  box-shadow: 0 12px 26px -18px rgba(15, 23, 42, 0.42);
}

.icon-button:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.34);
  outline-offset: 3px;
}

.icon-button.has-badge span {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  box-sizing: border-box;
  border: 0;
  border-radius: 999px;
  background: #ef4444;
  color: #ffffff;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.notification-panel {
  --notification-arrow-center: 123px;
  position: absolute;
  top: calc(100% + 14px);
  right: -104px;
  width: min(420px, calc(100vw - 28px));
  box-sizing: border-box;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(24px);
  box-shadow:
    0 26px 58px -28px rgba(15, 23, 42, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  padding: 14px;
  z-index: 30;
}

.notification-panel.is-scoped-portal {
  position: absolute;
  top: auto;
  right: auto;
  left: auto;
  z-index: 12;
  max-height: min(560px, calc(100% - 72px));
  overflow: visible;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, var(--glass-border-opacity, 0.58));
  border-radius: 22px;
  background: radial-gradient(
      circle at 22% 20%,
      rgba(255, 255, 255, var(--glass-highlight-opacity, 0.62)),
      rgba(255, 255, 255, 0) 34%
    ),
    linear-gradient(
      145deg,
      rgba(255, 255, 255, var(--glass-gradient-start, 0.24)),
      rgba(238, 246, 255, var(--glass-gradient-end, 0.16))
    ),
    rgba(248, 252, 255, calc(var(--glass-base-opacity, 0.18) + 0.04));
  backdrop-filter: blur(calc(var(--glass-blur, 24px) + 4px))
    saturate(calc(var(--glass-saturate, 1.16) + 0.12));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur, 24px) + 4px))
    saturate(calc(var(--glass-saturate, 1.16) + 0.12));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.68),
    0 20px 36px -24px rgba(15, 23, 42, 0.24);
}

.notification-panel.is-scoped-portal .notification-panel__arrow {
  top: -10px;
  filter: drop-shadow(0 -1px 1px rgba(15, 23, 42, 0.08));
}

.notification-panel.is-scoped-portal .notification-panel__arrow::before {
  width: 14px;
  height: 14px;
  bottom: -7px;
  border-color: rgba(255, 255, 255, var(--glass-border-opacity, 0.64));
  background: rgba(248, 252, 255, calc(var(--glass-base-opacity, 0.18) + 0.34));
  backdrop-filter: blur(var(--glass-blur, 24px));
  -webkit-backdrop-filter: blur(var(--glass-blur, 24px));
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.72),
    0 -2px 6px -4px rgba(15, 23, 42, 0.12);
}

.notification-panel.is-scoped-portal .notification-tabs,
.notification-panel.is-scoped-portal .notification-filter,
.notification-panel.is-scoped-portal .notification-list {
  position: relative;
  z-index: 1;
  background: inherit;
}

.notification-panel.is-scoped-portal .notification-panel__header {
  border-radius: 22px 22px 0 0;
}

.notification-panel.is-scoped-portal .notification-list {
  max-height: min(420px, calc(100% - 240px));
  border-radius: 0 0 22px 22px;
  overflow: auto;
}

.notification-backdrop.is-scoped {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 11;
  border-radius: inherit;
  background: rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(2px) saturate(1.02);
  -webkit-backdrop-filter: blur(2px) saturate(1.02);
}

.notification-panel.is-portal {
  position: fixed;
  top: auto;
  right: auto;
  z-index: 120;
  max-height: min(560px, calc(100vh - 96px));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, var(--glass-border-opacity, 0.58));
  border-radius: 24px;
  background: radial-gradient(
      circle at 22% 20%,
      rgba(255, 255, 255, var(--glass-highlight-opacity, 0.62)),
      rgba(255, 255, 255, 0) 34%
    ),
    linear-gradient(
      145deg,
      rgba(255, 255, 255, var(--glass-gradient-start, 0.24)),
      rgba(238, 246, 255, var(--glass-gradient-end, 0.16))
    ),
    rgba(248, 252, 255, calc(var(--glass-base-opacity, 0.18) + 0.04));
  backdrop-filter: blur(calc(var(--glass-blur, 24px) + 4px))
    saturate(calc(var(--glass-saturate, 1.16) + 0.12));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur, 24px) + 4px))
    saturate(calc(var(--glass-saturate, 1.16) + 0.12));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.68),
    0 28px 56px -24px rgba(15, 23, 42, 0.28);
}

.notification-panel.is-portal .notification-list {
  max-height: min(420px, calc(100vh - 240px));
}

.notification-panel.is-embedded-panel {
  position: relative;
  top: auto;
  right: auto;
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  padding: 18px 20px 20px;
}

.notification-panel.is-embedded-panel .notification-list {
  flex: 1;
  min-height: 0;
  max-height: none;
}

.notification-backdrop {
  position: fixed;
  inset: 0;
  z-index: 119;
  border: 0;
  padding: 0;
  background: rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(3px) saturate(1.04);
  -webkit-backdrop-filter: blur(3px) saturate(1.04);
  cursor: default;
}

.notification-backdrop-enter-active,
.notification-backdrop-leave-active {
  transition: opacity 0.22s ease;
}

.notification-backdrop-enter-from,
.notification-backdrop-leave-to {
  opacity: 0;
}

.notification-panel__arrow {
  position: absolute;
  top: -11px;
  right: calc(var(--notification-arrow-center) - 11px);
  width: 22px;
  height: 11px;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}

.notification-panel__arrow::before {
  position: absolute;
  left: 50%;
  bottom: -8px;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.82);
  transform: translateX(-50%) rotate(45deg);
  content: '';
}

.notification-panel__header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 8px;
  padding: 2px 2px 12px;
  flex: 0 0 auto;
}

.notification-panel__header div {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notification-panel__header strong {
  color: #0f172a;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 900;
}

.notification-panel__header span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 800;
}

.notification-panel__header button {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.92);
  color: #64748b;
  cursor: pointer;
  font: inherit;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.notification-panel__header button:hover {
  background: #e2e8f0;
  color: #0f172a;
  transform: translateY(-1px);
}

.notification-panel__header button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
}

.notification-panel__header button svg {
  width: 16px;
  height: 16px;
}

.notification-tabs,
.notification-filter {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.notification-tabs {
  gap: 6px;
  margin-bottom: 10px;
  border-radius: 14px;
  background: rgba(241, 245, 249, 0.78);
  padding: 4px;
}

.notification-tabs button,
.notification-filter button {
  border: 0;
  font: inherit;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.notification-tabs button {
  min-width: 0;
  min-height: 34px;
  flex: 1 1 0;
  border-radius: 11px;
  background: transparent;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  line-height: 1;
  font-weight: 850;
}

.notification-tabs button.active {
  background: rgba(255, 255, 255, 0.94);
  color: #0f172a;
  box-shadow: 0 8px 16px -14px rgba(15, 23, 42, 0.48);
}

.notification-tabs button span {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.88);
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
}

.notification-tabs button.active span {
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
}

.notification-filter {
  gap: 6px;
  margin: 0 0 10px;
  border-radius: 14px;
  background: rgba(241, 245, 249, 0.78);
  padding: 4px;
}

.notification-filter button {
  min-width: 0;
  min-height: 34px;
  flex: 1 1 0;
  border-radius: 11px;
  background: transparent;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 1;
  font-weight: 850;
}

.notification-filter button.active {
  background: rgba(255, 255, 255, 0.94);
  color: #0f172a;
  box-shadow: 0 8px 16px -14px rgba(15, 23, 42, 0.48);
}

.notification-filter button span {
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.88);
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 900;
}

.notification-filter button.active span {
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
}

.notification-list {
  position: relative;
  z-index: 1;
  max-height: min(430px, calc(100vh - 150px));
  overflow-y: auto;
  padding: 0 8px 8px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-color: rgba(81, 120, 173, 0.18) transparent;
  scrollbar-width: thin;
}

.notification-list::-webkit-scrollbar {
  width: 6px;
}

.notification-list::-webkit-scrollbar-thumb {
  background: rgba(81, 120, 173, 0.16);
  border-radius: 10px;
}

.notification-item {
  position: relative;
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.74);
  padding: 12px 12px 12px 34px;
  display: flex;
  gap: 10px;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.notification-item:hover {
  border-color: rgba(191, 219, 254, 0.96);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.notification-item.is-unread {
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.95), rgba(255, 255, 255, 0.92));
}

.notification-item.is-clickable {
  cursor: pointer;
}

.notification-item__marker {
  position: absolute;
  top: 17px;
  left: 14px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  box-shadow: 0 0 0 4px rgba(226, 232, 240, 0.74);
}

.notification-item__marker.is-blue {
  background: #2563eb;
  box-shadow: 0 0 0 4px rgba(191, 219, 254, 0.78);
}

.notification-item__marker.is-green {
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(187, 247, 208, 0.72);
}

.notification-item__marker.is-amber {
  background: #f59e0b;
  box-shadow: 0 0 0 4px rgba(254, 240, 138, 0.7);
}

.notification-item__content {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.notification-item__meta-row {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.notification-item__title {
  min-width: 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-item__tag {
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.96);
  color: #64748b;
  font-size: 10px;
  line-height: 1;
  font-weight: 850;
  padding: 3px 6px;
}

.notification-item__tag.is-pending {
  background: rgba(254, 243, 199, 0.92);
  color: #b45309;
}

.notification-item__tag.is-meeting {
  background: rgba(220, 252, 231, 0.92);
  color: #15803d;
}

.notification-item__meta-row time {
  flex: 0 0 auto;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 800;
}

.notification-item__summary {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 700;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.notification-item__details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.72);
}

.notification-item__detail {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.notification-item__detail dt {
  margin: 0;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 800;
}

.notification-item__detail dd {
  margin: 0;
  min-width: 0;
  color: #334155;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 700;
  word-break: break-word;
}

.notification-state {
  flex: 0 0 auto;
}

.notification-item__actions,
.notification-item__form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.notification-item__actions {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid rgba(226, 232, 240, 0.72);
}

.notification-item__form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
  overflow: visible;
}

.notification-input {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 10px;
  background: #ffffff;
  color: #0f172a;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  padding: 0 10px;
}

.notification-input:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.28);
  outline-offset: 2px;
}

.action-btn {
  border: 0;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.92);
  color: #334155;
  font: inherit;
  font-size: 11px;
  font-weight: 850;
  line-height: 1;
  padding: 7px 10px;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.action-btn.is-accept {
  background: rgba(220, 252, 231, 0.92);
  color: #047857;
}

.action-btn.is-reject {
  background: rgba(254, 226, 226, 0.92);
  color: #b91c1c;
}

.action-btn.is-view {
  background: rgba(219, 234, 254, 0.92);
  color: #1d4ed8;
}

.action-btn.is-muted {
  background: rgba(241, 245, 249, 0.92);
  color: #64748b;
}

.action-btn.has-icon {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.action-btn.has-icon svg {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
}

.notification-load-more {
  min-height: 34px;
  border: 1px dashed rgba(203, 213, 225, 0.92);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.72);
  color: #475569;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.notification-load-more:hover:not(:disabled) {
  border-color: rgba(147, 197, 253, 0.9);
  background: rgba(239, 246, 255, 0.82);
  color: #1d4ed8;
}

.notification-load-more:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.notification-popover-enter-active,
.notification-popover-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.notification-popover-enter-from,
.notification-popover-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
