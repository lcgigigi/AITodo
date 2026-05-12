<template>
  <AppPage
    eyebrow="Agenda"
    title="智能代办与日程日历"
    description="当前是接入占位页。后续可以把已有 Vue 页面粘贴到这里，再按需要拆到 components、api、store 和 types。"
  >
    <section class="agenda-shell">
      <AppCard title="日历页面占位" description="目标路由：/agenda/calendar">
        <div class="calendar-placeholder">
          <div class="calendar-placeholder__head">
            <strong>{{ monthLabel }}</strong>
            <n-space>
              <n-button size="small" quaternary>月</n-button>
              <n-button size="small" quaternary>周</n-button>
              <n-button size="small" type="primary">日</n-button>
            </n-space>
          </div>
          <div class="calendar-placeholder__grid">
            <span v-for="day in 35" :key="day" :class="{ 'is-active': day === 17 }">{{ day }}</span>
          </div>
        </div>
      </AppCard>

      <AppCard title="今日待办" description="后续接入智能代办数据和 AI 拆解结果。">
        <n-list>
          <n-list-item v-for="todo in todos" :key="todo">
            <n-thing :title="todo" description="待接入真实业务逻辑" />
          </n-list-item>
        </n-list>
      </AppCard>
    </section>
  </AppPage>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import AppCard from '@/shared/components/app-card/AppCard.vue'
import AppPage from '@/shared/components/app-page/AppPage.vue'

const monthLabel = dayjs().format('YYYY年 MM月')

const todos = ['完成项目骨架验收', '粘贴已有日历页面', '抽离日程接口与 mock 数据']
</script>

<style scoped>
.agenda-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
}

.calendar-placeholder {
  display: grid;
  gap: 16px;
}

.calendar-placeholder__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.calendar-placeholder__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.calendar-placeholder__grid span {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  color: var(--app-text-secondary);
  background: rgba(255, 255, 255, 0.52);
}

.calendar-placeholder__grid span.is-active {
  color: #fff;
  background: var(--app-primary);
}

@media (max-width: 980px) {
  .agenda-shell {
    grid-template-columns: 1fr;
  }
}
</style>
