<script setup lang="ts">
import { ref } from 'vue'
import CalendarWorkspace from './dashboard/CalendarWorkspace.vue'
import DashboardTopBar from './dashboard/DashboardTopBar.vue'

type CalendarWorkspaceExpose = {
  refreshTodos: () => Promise<void>
  openTodoFromNotification: (payload: { id: string; date: string }) => Promise<void>
}

const calendarWorkspaceRef = ref<CalendarWorkspaceExpose | null>(null)

function handleCalendarRefresh() {
  void calendarWorkspaceRef.value?.refreshTodos()
}

function handleOpenTodo(payload: { id: string; date: string }) {
  void calendarWorkspaceRef.value?.openTodoFromNotification(payload)
}
</script>

<template>
  <div class="page-container">
    <main class="dashboard-shell">
      <DashboardTopBar @calendar-refresh="handleCalendarRefresh" @open-todo="handleOpenTodo" />
      <div class="dashboard-content">
        <CalendarWorkspace ref="calendarWorkspaceRef" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.page-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #e6edf5;
  color: #111827;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.dashboard-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 10% 0%, rgba(254, 243, 199, 0.86), transparent 30%),
    linear-gradient(135deg, #fbfcff 0%, #f4f7fb 48%, #eef6f3 100%);
}

.dashboard-content {
  min-height: 0;
  flex: 1;
}
</style>
