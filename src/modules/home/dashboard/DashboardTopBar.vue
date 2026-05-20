<script setup lang="ts">
import { computed } from 'vue'
import IconBell from '~icons/lucide/bell'
import IconMessageCircle from '~icons/lucide/message-circle'
import IconSettings from '~icons/lucide/settings'
import girlImage from '@/assets/girl.png'
import { useUserStore } from '@/stores/user.store'

const userStore = useUserStore()

const displayName = computed(() => userStore.profile?.name ?? '张经理')
const department = computed(() => userStore.profile?.department ?? 'AI平台部')
const avatarUrl = computed(() => userStore.profile?.avatar ?? girlImage)
</script>

<template>
  <header class="dashboard-topbar" aria-label="顶部导航">
    <div class="brand-block" aria-label="AI Workbench">
      <span class="logo-mark" aria-hidden="true">
        <span>A</span>
      </span>
      <div class="brand-copy">
        <strong>AI Workbench</strong>
        <span>智能办公中台</span>
      </div>
    </div>

    <div class="topbar-actions">
      <button class="icon-button has-badge" type="button" aria-label="消息">
        <IconMessageCircle />
        <span>3</span>
      </button>
      <button class="icon-button has-dot" type="button" aria-label="通知">
        <IconBell />
      </button>
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
  height: 72px;
  min-height: 72px;
  box-sizing: border-box;
  padding: 14px 22px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.78);
  background: rgba(255, 255, 255, 0.68);
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
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background:
    radial-gradient(circle at 28% 20%, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 34%),
    linear-gradient(135deg, #0f172a 0%, #2563eb 52%, #059669 100%);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16px 30px -22px rgba(15, 23, 42, 0.72);
  flex: 0 0 auto;
}

.logo-mark span {
  font-size: 21px;
  line-height: 1;
  font-weight: 950;
  letter-spacing: 0;
}

.brand-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.brand-copy strong {
  color: #0f172a;
  font-size: 18px;
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
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.icon-button,
.user-chip {
  border: 1px solid rgba(226, 232, 240, 0.92);
  background: rgba(255, 255, 255, 0.78);
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
  border-color: rgba(37, 99, 235, 0.42);
  background: #ffffff;
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
  width: 38px;
  height: 38px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.icon-button svg {
  width: 18px;
  height: 18px;
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

.icon-button.has-dot::after {
  position: absolute;
  top: 7px;
  right: 8px;
  width: 8px;
  height: 8px;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: #f59e0b;
  content: '';
}

.user-chip {
  max-width: 220px;
  min-height: 42px;
  border-radius: 16px;
  padding: 4px 12px 4px 5px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-align: left;
}

.user-chip img {
  width: 32px;
  height: 32px;
  border-radius: 12px;
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
    gap: 7px;
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
