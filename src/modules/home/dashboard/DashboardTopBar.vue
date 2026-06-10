<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconSettings from '~icons/lucide/settings'
import IconX from '~icons/lucide/x'
import girlImage from '@/assets/libao.png'
import logoDarkImage from '@/assets/logoDark1.png'
import { useUserStore } from '@/stores/user.store'

const userStore = useUserStore()

type NotificationTone = 'blue' | 'green' | 'amber' | 'violet'

interface NotificationItem {
  id: string
  title: string
  content: string
  time: string
  source: string
  unread?: boolean
  tone: NotificationTone
}

const notificationPanelRef = ref<HTMLElement | null>(null)
const isNotificationPanelOpen = ref(false)

const notifications: NotificationItem[] = [
  {
    id: 'risk-check',
    title: '检查上线风险',
    content: '今日 15:00 的待办即将开始，请提前确认上线风险项。',
    time: '10 分钟前',
    source: '待办提醒',
    unread: true,
    tone: 'blue',
  },
  {
    id: 'ppt-draft',
    title: '生成汇报 PPT 初稿',
    content: '智能 PPT 已生成初稿，可进入月历待办继续完善内容。',
    time: '32 分钟前',
    source: '智体工坊',
    unread: true,
    tone: 'violet',
  },
  {
    id: 'budget-approval',
    title: '预算申请复核',
    content: '有 1 条预算申请等待审批，建议今日处理。',
    time: '今天 09:20',
    source: '审批中心',
    unread: true,
    tone: 'amber',
  },
  {
    id: 'weekly-plan',
    title: '周计划校准',
    content: '本周任务推进已同步，10 项待推进事项已更新。',
    time: '昨天 18:40',
    source: '日程助手',
    tone: 'green',
  },
  {
    id: 'knowledge-sync',
    title: '知识库问答灰度',
    content: '知识库问答灰度范围已调整，相关任务已写入本月计划。',
    time: '6 月 3 日',
    source: '力宝百问',
    tone: 'blue',
  },
]

const displayName = computed(() => userStore.profile?.name ?? '刘美华')
const department = computed(() => userStore.profile?.department ?? '信息技术部')
const avatarUrl = computed(() => userStore.profile?.avatar ?? girlImage)
const unreadNotificationCount = computed(() => notifications.filter((item) => item.unread).length)

function toggleNotificationPanel() {
  isNotificationPanelOpen.value = !isNotificationPanelOpen.value
}

function closeNotificationPanel() {
  isNotificationPanelOpen.value = false
}

function handleDocumentPointerDown(event: PointerEvent) {
  const panelElement = notificationPanelRef.value

  if (!panelElement || panelElement.contains(event.target as Node)) {
    return
  }

  closeNotificationPanel()
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeNotificationPanel()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <header class="dashboard-topbar" aria-label="顶部导航">
    <div class="brand-block" aria-label="华力企业级AI平台">
      <span class="logo-mark" aria-hidden="true">
        <img :src="logoDarkImage" alt="" />
      </span>
      <div class="brand-copy">
        <strong>华力企业级AI平台</strong>
        <span>员工办公中台</span>
      </div>
    </div>

    <div class="topbar-actions">
      <div ref="notificationPanelRef" class="notification-wrap">
        <button
          class="icon-button has-badge"
          type="button"
          aria-label="消息通知"
          aria-controls="dashboard-notification-panel"
          :aria-expanded="isNotificationPanelOpen"
          @click="toggleNotificationPanel"
        >
          <IconMessageCircle />
          <span v-if="unreadNotificationCount">{{ unreadNotificationCount }}</span>
        </button>

        <Transition name="notification-popover">
          <section
            v-if="isNotificationPanelOpen"
            id="dashboard-notification-panel"
            class="notification-panel"
            aria-label="消息通知"
          >
            <header class="notification-panel__header">
              <div>
                <strong>消息通知</strong>
                <span>未读 {{ unreadNotificationCount }} / 全部 {{ notifications.length }}</span>
              </div>
              <button type="button" aria-label="关闭消息通知" title="关闭消息通知" @click="closeNotificationPanel">
                <IconX />
              </button>
            </header>

            <div class="notification-list">
              <article
                v-for="notification in notifications"
                :key="notification.id"
                class="notification-item"
                :class="{ 'is-unread': notification.unread }"
              >
                <span class="notification-item__marker" :class="`is-${notification.tone}`" aria-hidden="true" />
                <div class="notification-item__content">
                  <div class="notification-item__title-row">
                    <strong>{{ notification.title }}</strong>
                    <time>{{ notification.time }}</time>
                  </div>
                  <p>{{ notification.content }}</p>
                  <span>{{ notification.source }}</span>
                </div>
              </article>
            </div>
          </section>
        </Transition>
      </div>
      <button class="icon-button" type="button" aria-label="设置">
        <IconSettings />
      </button>

      <button class="user-chip" type="button" aria-label="个人中心">
        <img :src="avatarUrl" alt="用户头像" />
        <span>
          <strong>{{ displayName }}</strong>
          <em>{{ department }}</em>
        </span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.dashboard-topbar {
  position: relative;
  z-index: 60;
  height: 60px;
  min-height: 60px;
  box-sizing: border-box;
  padding: 9px 22px;
  border: 0;
  background: rgba(255, 255, 255, 0.42);
  backdrop-filter: blur(18px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.brand-block {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.logo-mark {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  overflow: hidden;
}

.logo-mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.brand-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.brand-copy strong {
  color: #0f172a;
  font-size: 17px;
  line-height: 1.1;
  font-weight: 900;
}

.brand-copy span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 800;
}

.topbar-actions {
  min-width: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.36);
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.58),
    0 12px 28px -28px rgba(15, 23, 42, 0.3);
}

.icon-button,
.user-chip {
  border: 1px solid transparent;
  background: transparent;
  color: #334155;
  font: inherit;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.icon-button:hover,
.user-chip:hover {
  border-color: transparent;
  background: rgba(255, 255, 255, 0.64);
  color: #0f172a;
  transform: translateY(-1px);
}

.icon-button:focus-visible,
.user-chip:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.34);
  outline-offset: 3px;
}

.icon-button {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.icon-button svg {
  width: 18px;
  height: 18px;
}

.notification-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.icon-button.has-badge span {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  box-sizing: border-box;
  border: 2px solid #ffffff;
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
  position: absolute;
  top: calc(100% + 14px);
  right: -104px;
  width: min(360px, calc(100vw - 28px));
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

.notification-panel::before {
  position: absolute;
  top: -7px;
  right: 116px;
  width: 14px;
  height: 14px;
  border-top: 1px solid rgba(226, 232, 240, 0.92);
  border-left: 1px solid rgba(226, 232, 240, 0.92);
  background: rgba(255, 255, 255, 0.92);
  transform: rotate(45deg);
  content: '';
}

.notification-panel__header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 2px 2px 12px;
}

.notification-panel__header div {
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

.notification-panel__header button svg {
  width: 16px;
  height: 16px;
}

.notification-list {
  position: relative;
  z-index: 1;
  max-height: min(430px, calc(100vh - 150px));
  overflow: auto;
  padding-right: 2px;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
    transform 0.18s ease;
}

.notification-item:hover {
  border-color: rgba(191, 219, 254, 0.96);
  background: rgba(255, 255, 255, 0.94);
  transform: translateY(-1px);
}

.notification-item.is-unread {
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.95), rgba(255, 255, 255, 0.92));
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

.notification-item__marker.is-violet {
  background: #7c3aed;
  box-shadow: 0 0 0 4px rgba(221, 214, 254, 0.72);
}

.notification-item__content {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.notification-item__title-row {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.notification-item__title-row strong {
  min-width: 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 13px;
  line-height: 1.25;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-item__title-row time {
  flex: 0 0 auto;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 800;
}

.notification-item p {
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.55;
  font-weight: 700;
}

.notification-item__content > span {
  align-self: flex-start;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.92);
  color: #64748b;
  font-size: 11px;
  line-height: 1;
  font-weight: 850;
  padding: 6px 8px;
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

.user-chip {
  max-width: 220px;
  min-height: 34px;
  border-radius: 999px;
  padding: 2px 10px 2px 4px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-align: left;
}

.user-chip img {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  object-fit: cover;
  background: #dbeafe;
  flex: 0 0 auto;
}

.user-chip span {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-chip strong,
.user-chip em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-chip strong {
  color: #111827;
  font-size: 13px;
  line-height: 1.15;
  font-weight: 900;
}

.user-chip em {
  color: #64748b;
  font-size: 11px;
  line-height: 1.15;
  font-style: normal;
  font-weight: 750;
}

@media (max-width: 760px) {
  .dashboard-topbar {
    height: auto;
    min-height: 64px;
    padding: 12px;
  }

  .brand-copy span,
  .user-chip span {
    display: none;
  }

  .topbar-actions {
    gap: 3px;
  }

  .notification-panel {
    right: -132px;
    border-radius: 18px;
  }

  .notification-panel::before {
    right: 144px;
  }

  .user-chip {
    min-height: 38px;
    padding: 2px;
    border-radius: 14px;
  }

  .user-chip img {
    width: 32px;
    height: 32px;
  }
}
</style>
