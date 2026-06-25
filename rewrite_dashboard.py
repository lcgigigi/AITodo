import re

with open('src/modules/home/dashboard/DetailedDashboardWorkspace.vue', 'r', encoding='utf-8') as f:
    content = f.read()

# We will just write a new template and style block.
# We don't need to change much in the <script> block, just ensure `detailTools` can be ignored.

script_block = content.split('<template>')[0]

template_block = """<template>
  <section class="detail-workspace" aria-label="首页详细模式">
    <!-- Left Column -->
    <aside class="detail-left-panel" aria-label="快捷入口和统计">
      <div class="placeholder-3d glass-panel" aria-hidden="true">
        3D 可视化区域占位
      </div>
      <div class="floating-stats">
        <article class="mini-stat completion-card glass-panel">
          <h2>今日完成率</h2>
          <div
            class="completion-ring"
            :style="{ '--completion': `${completionRate * 3.6}deg` }"
            aria-label="当日完成率"
          >
            <div>
              <strong>{{ completionRate }}%</strong>
              <span>{{ doneCount }}/{{ selectedDateEvents.length }} 已完成</span>
            </div>
          </div>
        </article>

        <article class="mini-stat trend-card glass-panel">
          <header>
            <h2>本周趋势</h2>
          </header>
          <svg class="trend-svg" viewBox="0 0 210 128" role="img" aria-label="本周完成趋势">
            <polyline v-if="trendPolyline" :points="trendPolyline" />
            <g>
              <circle v-for="point in trendPoints" :key="point.key" :cx="point.x" :cy="point.y" />
            </g>
          </svg>
        </article>
      </div>
    </aside>

    <!-- Middle Column -->
    <main class="detail-main-panel glass-panel" aria-label="当日待办清单">
      <header class="detail-main-header">
        <h1>{{ mainTitle }}</h1>
        <p class="subtitle">
          {{ selectedDateLabel }}
          <span class="divider">|</span>
          任务总数 <span class="num">{{ filterCounts.all }}</span>
          <span class="divider">|</span>
          已完成 <span class="num">{{ filterCounts.done }}</span>
          <span class="divider">|</span>
          待处理 <span class="num">{{ filterCounts.pending }}</span>
          <span class="divider">|</span>
          <span class="text-urgent">高优先级 <span class="num">{{ filterCounts.urgent }}</span></span>
        </p>
      </header>

      <p v-if="loadError" class="detail-state is-error">{{ loadError }}</p>
      <p v-else-if="isLoading" class="detail-state">正在加载真实待办数据...</p>

      <div class="filter-row" role="group" aria-label="待办筛选">
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          class="filter-pill"
          :class="{ 
            active: activeFilter === filter.value, 
            'is-urgent': filter.value === 'urgent' 
          }"
          :aria-pressed="activeFilter === filter.value"
          @click="activeFilter = filter.value"
        >
          <span>{{ filter.label }} ({{ filterCounts[filter.value] }})</span>
        </button>
      </div>

      <div class="task-list" aria-label="待办列表">
        <article v-if="!isLoading && !filteredTasks.length" class="task-empty">
          当前日期暂无待办
        </article>

        <article
          v-for="task in filteredTasks"
          :key="task.id"
          class="task-row glass-panel"
          :class="{ expanded: activeTaskId === task.id, done: task.status === 'done' }"
        >
          <div class="task-summary" @click="expandTask(task)">
            <button
              type="button"
              class="task-check"
              :class="{ checked: task.status === 'done' }"
              :aria-label="task.status === 'done' ? '撤销完成' : '标记完成'"
              :disabled="task.completable === false"
              @click.stop="toggleTaskStatus(task)"
            >
              <IconCheck v-if="task.status === 'done'" aria-hidden="true" />
            </button>

            <time class="task-time">{{ formatEventTime(task) }}</time>

            <div class="task-info">
              <div class="task-title-row">
                <strong>{{ task.title }}</strong>
                <span class="task-tag" :class="`tone-${getTaskTone(task)}`">{{ getTaskTypeLabel(task) }}</span>
              </div>
              <div class="task-subtitle">
                {{ getProjectText(task) }}
              </div>
            </div>

            <div class="task-right">
              <span v-if="task.priority === 'urgent'" class="task-priority-text">高优先级</span>
              <span v-else-if="task.status === 'done'" class="task-done-text">已完成</span>
            </div>
          </div>

          <div v-if="activeTaskId === task.id" class="task-detail">
            <p v-if="detailLoadingId === task.id" class="detail-loading">正在加载详情...</p>
            <dl v-else>
              <div>
                <dt>项目：</dt>
                <dd>{{ getProjectText(task) }}</dd>
              </div>
              <div>
                <dt>协作人：</dt>
                <dd>{{ getAssigneeText(task) }}</dd>
              </div>
              <div>
                <dt>截止时间：</dt>
                <dd>{{ formatEventTime(getTaskDetail(task)) }}</dd>
              </div>
              <div>
                <dt>描述：</dt>
                <dd>{{ getDescriptionText(task) }}</dd>
              </div>
            </dl>
          </div>
        </article>
      </div>

      <form class="quick-create" @submit.prevent="submitQuickCreate">
        <input
          v-model="quickCreateText"
          type="text"
          autocomplete="off"
          aria-label="一句话新增待办"
          placeholder="+ 一句话新增待办，AI 自动识别时间与任务类型..."
        />
        <button
          type="submit"
          :disabled="!quickCreateText.trim() || isCreating"
          aria-label="解析并新增待办"
        >
          <IconSendHorizontal aria-hidden="true" />
        </button>
      </form>
    </main>

    <!-- Right Column -->
    <aside class="detail-side-panel" aria-label="日历和日程">
      <section class="glass-panel calendar-card" aria-label="月历">
        <div class="mode-segment-wrapper">
          <div class="mode-segment" role="group" aria-label="首页模式">
            <button type="button" @click="emit('switch-mode', 'simple')">总览模式</button>
            <button type="button" class="active">工作模式</button>
          </div>
        </div>

        <header class="calendar-header-mock">
          <h2>{{ monthLabel(currentMonth) }}</h2>
        </header>

        <div class="calendar-placeholder-wrapper">
          <div class="calendar-grid" :aria-label="`${monthLabel(currentMonth)}日历`">
            <span
              v-for="week in ['一', '二', '三', '四', '五', '六', '日']"
              :key="week"
              class="week-label"
            >
              {{ week }}
            </span>
            <button
              v-for="day in monthDays"
              :key="day.key"
              type="button"
              class="month-day"
              :class="{ muted: !day.inMonth, today: day.isToday, selected: day.isSelected }"
              @click="selectCalendarDate(day.key)"
            >
              <strong>{{ day.day }}</strong>
              <span class="day-dots" aria-hidden="true">
                <i v-for="dot in day.dots" :key="`${day.key}-${dot}`" :class="`dot-${dot}`"></i>
              </span>
            </button>
          </div>
        </div>
      </section>

      <section class="glass-panel schedule-card" aria-label="当日日程">
        <header class="side-card-header">
          <div class="schedule-title-area">
            <h2>当日日程</h2>
            <p>{{ selectedDateShortLabel }}</p>
          </div>
          <button type="button" class="all-schedule-btn" @click="activeFilter = 'all'">
            全部日程 <IconChevronRight aria-hidden="true" />
          </button>
        </header>

        <div class="schedule-list">
          <article v-if="!scheduleEvents.length" class="schedule-empty">当前日期暂无日程</article>
          <article
            v-for="task in scheduleEvents"
            :key="`schedule-${task.id}`"
            class="schedule-item"
            @click="expandTask(task)"
          >
            <div class="schedule-dot"></div>
            <time>{{ formatEventTime(task) }}</time>
            <div class="schedule-info">
              <strong>{{ task.title }}</strong>
              <p>{{ getProjectText(task) }} · {{ getAssigneeText(task) }}</p>
            </div>
            <span :class="`tone-${getTaskTone(task)}`">{{ getTaskTypeLabel(task) }}</span>
          </article>
        </div>
      </section>
    </aside>
  </section>
</template>
"""

style_block = """<style scoped>
.detail-workspace {
  --detail-ink: #142142;
  --detail-muted: #60708d;
  --detail-blue: #2f7cff;
  position: relative;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: clamp(16px, 1.5vw, 24px) clamp(24px, 2vw, 40px);
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(500px, 1fr) minmax(280px, 340px);
  gap: clamp(16px, 1.4vw, 24px);
  color: var(--detail-ink);
  overflow: hidden;
}

.glass-panel {
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
}

.detail-left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.placeholder-3d {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff7a3d;
  font-size: 16px;
  font-weight: 800;
  background: linear-gradient(180deg, rgba(255, 170, 130, 0.4) 0%, rgba(130, 200, 255, 0.4) 100%);
  border-radius: 24px;
}

.floating-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  height: 160px;
}

.mini-stat {
  padding: 16px;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: rgba(255,255,255,0.7);
}

.mini-stat h2 {
  margin: 0 0 12px;
  color: #172340;
  font-size: 15px;
  font-weight: 900;
}

.completion-ring {
  --completion: 0deg;
  width: 76px;
  height: 76px;
  margin: 0 auto;
  border-radius: 50%;
  background: conic-gradient(var(--detail-blue) var(--completion), rgba(189, 210, 232, 0.4) 0);
  display: grid;
  place-items: center;
  position: relative;
}

.completion-ring::before {
  width: 56px;
  height: 56px;
  border-radius: inherit;
  background: #ffffff;
  content: '';
}

.completion-ring > div {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.completion-ring strong {
  color: var(--detail-blue);
  font-size: 22px;
  line-height: 1;
  font-weight: 900;
}

.completion-ring span {
  margin-top: 4px;
  color: #60708d;
  font-size: 10px;
  font-weight: 800;
}

.trend-card .trend-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.trend-svg polyline {
  fill: none;
  stroke: var(--detail-blue);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.trend-svg circle {
  r: 4;
  fill: #ffffff;
  stroke: var(--detail-blue);
  stroke-width: 2.5;
}

.detail-main-panel {
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 24px;
  min-height: 0;
}

.detail-main-header {
  margin-bottom: 20px;
}

.detail-main-header h1 {
  margin: 0 0 8px;
  color: #101936;
  font-size: 24px;
  font-weight: 900;
}

.subtitle {
  margin: 0;
  color: #60708d;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.subtitle .divider {
  color: #c0cbe0;
}

.subtitle .num {
  color: #101936;
  font-weight: 800;
}

.text-urgent {
  color: #ef4444;
}
.text-urgent .num {
  color: #ef4444;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.filter-pill {
  height: 32px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #60708d;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-pill:hover {
  background: rgba(0,0,0,0.04);
}

.filter-pill.active {
  background: var(--detail-blue);
  color: white;
  box-shadow: 0 4px 12px rgba(47, 124, 255, 0.3);
}

.filter-pill.is-urgent {
  color: #ef4444;
}

.filter-pill.active.is-urgent {
  background: #ef4444;
  color: white;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.task-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
  scrollbar-width: none;
}
.task-list::-webkit-scrollbar {
  display: none;
}

.task-row {
  background: #ffffff;
  border: 1px solid rgba(220, 230, 240, 0.8);
  border-radius: 16px;
  transition: all 0.2s;
}
.task-row:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.04);
  transform: translateY(-1px);
}
.task-row.expanded {
  border-color: rgba(47, 124, 255, 0.4);
  box-shadow: 0 12px 32px rgba(47, 124, 255, 0.1);
}

.task-summary {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 16px;
  cursor: pointer;
}

.task-check {
  width: 20px;
  height: 20px;
  border: 2px solid #c0cbe0;
  border-radius: 6px;
  background: white;
  color: white;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
}
.task-check.checked {
  background: var(--detail-blue);
  border-color: var(--detail-blue);
}
.task-check svg {
  width: 14px;
  height: 14px;
}

.task-time {
  font-size: 18px;
  font-weight: 900;
  color: #101936;
  min-width: 60px;
}

.task-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.task-title-row strong {
  font-size: 15px;
  font-weight: 900;
  color: #101936;
}

.task-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 800;
}

.tone-blue { background: #e0f2fe; color: #2563eb; }
.tone-green { background: #d1fae5; color: #059669; }
.tone-orange { background: #ffedd5; color: #ea580c; }
.tone-violet { background: #ede9fe; color: #7c3aed; }
.tone-cyan { background: #cffafe; color: #0891b2; }
.tone-slate { background: #f1f5f9; color: #475569; }

.task-subtitle {
  font-size: 13px;
  color: #60708d;
}

.task-right {
  display: flex;
  align-items: center;
}

.task-priority-text {
  color: #ef4444;
  font-size: 13px;
  font-weight: 900;
}
.task-done-text {
  color: #10b981;
  font-size: 13px;
  font-weight: 900;
}

.task-detail {
  padding: 0 16px 16px 112px;
}
.task-detail dl {
  margin: 0;
  display: grid;
  gap: 8px;
}
.task-detail div {
  display: flex;
  gap: 12px;
  font-size: 13px;
}
.task-detail dt {
  color: #60708d;
  min-width: 70px;
}
.task-detail dd {
  margin: 0;
  color: #101936;
  font-weight: 600;
}

.quick-create {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  background: white;
  border-radius: 999px;
  padding: 6px 6px 6px 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.quick-create input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #101936;
}
.quick-create input::placeholder {
  color: #9aa8bb;
}
.quick-create button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--detail-blue);
  color: white;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.quick-create button:disabled {
  opacity: 0.5;
}
.quick-create button svg {
  width: 18px;
  height: 18px;
}

.detail-side-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.calendar-card {
  padding: 16px;
  background: rgba(220, 200, 255, 0.15); /* Slightly pinkish as in mockup */
}

.mode-segment-wrapper {
  margin-bottom: 20px;
}
.mode-segment {
  display: flex;
  background: rgba(255,255,255,0.6);
  border-radius: 999px;
  padding: 4px;
}
.mode-segment button {
  flex: 1;
  height: 36px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #60708d;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}
.mode-segment button.active {
  background: var(--detail-blue);
  color: white;
  box-shadow: 0 4px 12px rgba(47, 124, 255, 0.3);
}

.calendar-header-mock {
  text-align: center;
  margin-bottom: 16px;
}
.calendar-header-mock h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: #101936;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  text-align: center;
}
.week-label {
  font-size: 12px;
  color: #60708d;
  font-weight: 800;
  margin-bottom: 8px;
}
.month-day {
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 800;
  color: #101936;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.month-day.muted {
  color: #a0aec0;
}
.month-day.today {
  background: var(--detail-blue);
  color: white;
}
.day-dots {
  display: flex;
  gap: 2px;
  margin-top: 2px;
}
.day-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
}

.schedule-card {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  background: rgba(220, 200, 255, 0.15); /* Match tint */
  overflow: hidden;
}

.side-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.schedule-title-area h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: #101936;
}
.schedule-title-area p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #60708d;
  font-weight: 800;
}

.all-schedule-btn {
  border: 1px solid rgba(0,0,0,0.1);
  background: rgba(255,255,255,0.6);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 800;
  color: var(--detail-blue);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.all-schedule-btn svg {
  width: 14px;
  height: 14px;
}

.schedule-list {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
}
.schedule-list::-webkit-scrollbar {
  display: none;
}

.schedule-item {
  position: relative;
  display: grid;
  grid-template-columns: 50px 1fr auto;
  gap: 12px;
  padding: 16px 0;
  cursor: pointer;
}
.schedule-item::after {
  content: '';
  position: absolute;
  left: 21px;
  top: 36px;
  bottom: -16px;
  width: 2px;
  background: rgba(0,0,0,0.05);
}
.schedule-item:last-child::after {
  display: none;
}

.schedule-dot {
  position: absolute;
  left: 18px;
  top: 22px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
  border: 2px solid var(--detail-blue);
  z-index: 1;
}

.schedule-item time {
  font-size: 14px;
  font-weight: 900;
  color: #101936;
  text-align: right;
  padding-top: 2px;
}

.schedule-info strong {
  display: block;
  font-size: 14px;
  font-weight: 900;
  color: #101936;
}
.schedule-info p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #60708d;
}
</style>
"""

with open('src/modules/home/dashboard/DetailedDashboardWorkspace.vue', 'w', encoding='utf-8') as f:
    f.write(script_block + template_block + style_block)
