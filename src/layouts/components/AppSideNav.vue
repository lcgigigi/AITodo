<template>
  <nav class="app-side-nav" aria-label="工作台导航">
    <RouterLink
      v-for="item in navItems"
      :key="item.path"
      class="app-side-nav__item"
      :to="item.path"
      :class="{ 'is-active': route.path === item.path }"
    >
      <component :is="item.icon" class="app-side-nav__icon" />
      <span>{{ item.title }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { markRaw } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ICarbonCalendar from '~icons/carbon/calendar'
import ICarbonChatBot from '~icons/carbon/chat-bot'
import ICarbonWorkspace from '~icons/carbon/workspace'

const route = useRoute()

const navItems = [
  { title: '工作台', path: '/workbench', icon: markRaw(ICarbonWorkspace) },
  { title: '日程日历', path: '/agenda/calendar', icon: markRaw(ICarbonCalendar) },
  { title: '智能体中心', path: '/ai-agent', icon: markRaw(ICarbonChatBot) },
]
</script>

<style scoped>
.app-side-nav {
  position: sticky;
  top: 20px;
  align-self: start;
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: var(--app-shadow-soft);
  backdrop-filter: blur(18px);
}

.app-side-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 8px;
  color: var(--app-text-secondary);
  text-decoration: none;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.app-side-nav__item:hover {
  color: var(--app-text-primary);
  background: rgba(79, 124, 255, 0.08);
}

.app-side-nav__item.is-active {
  color: var(--app-primary);
  background: rgba(79, 124, 255, 0.12);
  font-weight: 700;
}

.app-side-nav__icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

@media (max-width: 900px) {
  .app-side-nav {
    position: static;
    display: flex;
    overflow-x: auto;
  }

  .app-side-nav__item {
    white-space: nowrap;
  }
}
</style>
