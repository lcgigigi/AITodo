<template>
  <div class="workbench-layout">
    <AppHeader />
    <main class="workbench-layout__body">
      <AppSideNav />
      <AppContent>
        <RouterView />
      </AppContent>
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppSideNav from './components/AppSideNav.vue'
import AppContent from './components/AppContent.vue'
</script>

<style scoped>
.workbench-layout {
  min-height: 100vh;
  background: radial-gradient(circle at 16% 10%, rgba(79, 124, 255, 0.12), transparent 28rem),
    radial-gradient(circle at 82% 14%, rgba(39, 192, 131, 0.1), transparent 24rem), var(--app-bg);
}

.workbench-layout__body {
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  gap: 20px;
  width: min(1440px, 100%);
  margin: 0 auto;
  padding: 0 24px 28px;
}

@media (max-width: 900px) {
  .workbench-layout__body {
    grid-template-columns: 1fr;
    padding: 0 16px 20px;
  }
}
</style>
