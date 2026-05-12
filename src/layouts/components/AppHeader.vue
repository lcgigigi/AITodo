<template>
  <header class="app-header">
    <RouterLink class="app-header__brand" to="/workbench">
      <span class="app-header__logo">AI</span>
      <span>
        <strong>AI智能工作台</strong>
        <small>Workbench Platform</small>
      </span>
    </RouterLink>

    <div class="app-header__actions">
      <n-tag :bordered="false" round type="success">Mock 数据</n-tag>
      <n-button quaternary circle aria-label="全局搜索">
        <template #icon>
          <i-carbon-search />
        </template>
      </n-button>
      <n-button quaternary circle aria-label="通知">
        <template #icon>
          <i-carbon-notification />
        </template>
      </n-button>
      <n-avatar round size="medium">LC</n-avatar>
    </div>
  </header>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ICarbonNotification from '~icons/carbon/notification'
import ICarbonSearch from '~icons/carbon/search'
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: min(1440px, 100%);
  height: 76px;
  margin: 0 auto;
  padding: 0 24px;
}

.app-header__brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--app-text-primary);
  text-decoration: none;
}

.app-header__brand strong,
.app-header__brand small {
  display: block;
}

.app-header__brand strong {
  font-size: 18px;
  line-height: 1.2;
}

.app-header__brand small {
  margin-top: 2px;
  color: var(--app-text-tertiary);
  font-size: 12px;
}

.app-header__logo {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  color: #fff;
  background: linear-gradient(135deg, #315dff, #27c083);
  font-weight: 800;
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 640px) {
  .app-header {
    height: auto;
    align-items: flex-start;
    gap: 14px;
    flex-direction: column;
    padding: 18px 16px;
  }

  .app-header__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
