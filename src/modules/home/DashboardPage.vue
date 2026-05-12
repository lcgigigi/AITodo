<script setup lang="ts">
import CalendarWorkspace from './dashboard/CalendarWorkspace.vue'
</script>

<template>
  <div class="page-container">
    <div class="app-wrapper">
      <div class="bg-shape-yellow"></div>

      <main class="main-content">
        <section class="overview-page">
          <div class="overview-body">
            <CalendarWorkspace />
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Base Setup matching the image exactly */
.page-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #E2E8F0;
  overflow: hidden;
}

.app-wrapper {
  width: 100vw;
  height: 100vh;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.6) inset;
  display: flex;
  background-color: #FAFAFA;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  position: relative;
  color: #111827;
}

/* The yellow blob top left */
.bg-shape-yellow {
  position: absolute;
  top: -150px;
  left: -150px;
  width: 600px;
  height: 600px;
  background: #FEF3C7;
  border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
  z-index: 0;
  opacity: 0.8;
  pointer-events: none;
}

/* Main Content Area */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
  min-width: 0;
  height: 100%;
}

.overview-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.overview-body {
  flex: 1;
  min-height: 0;
}

.top-header {
  height: 56px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.team-avatars {
  display: flex;
  align-items: center;
}
.top-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #FAFAFA;
  margin-left: -8px;
  object-fit: cover;
}
.top-avatar:first-child { margin-left: 0; }

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.search-box {
  background: #FFFFFF;
  border-radius: 999px;
  display: flex;
  align-items: center;
  padding: 4px 4px 4px 16px;
  box-shadow: 0 4px 20px -10px rgba(0,0,0,0.05);
  width: 240px;
}
.search-icon {
  color: #9CA3AF;
  width: 14px;
  height: 14px;
  margin-right: 8px;
}
.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 12px;
  min-width: 0;
}
.search-box input::placeholder { color: #9CA3AF; }
.go-btn {
  background: #2D1B11;
  color: #FFF;
  border: none;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #4B5563;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
}
.icon-btn svg { width: 18px; height: 18px; }
.has-dot::after {
  content: '';
  position: absolute;
  top: 6px;
  right: 8px;
  width: 8px;
  height: 8px;
  background: #EF4444;
  border-radius: 50%;
  border: 2px solid #FAFAFA;
}

.workspace-scroll {
  flex: 1;
  padding: 0 28px 18px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.calendar-workspace {
  padding: 28px;
  justify-content: flex-start;
}

.calendar-only-card {
  width: min(720px, 100%);
  min-height: 430px;
  border-radius: 24px;
  background: linear-gradient(180deg, #fff9ef 0%, #fffdf8 100%);
  box-shadow: 0 18px 50px -24px rgba(17, 24, 39, 0.28);
  overflow: hidden;
}

.calendar-only-card .calendar-shell {
  padding: 24px;
  gap: 16px;
}

.calendar-only-card .calendar-month {
  font-size: 24px;
}

.calendar-only-card .calendar-meta {
  font-size: 13px;
}

.calendar-only-card .legend-item {
  font-size: 12px;
}

.calendar-only-card .calendar-weekdays {
  gap: 8px;
}

.calendar-only-card .calendar-weekdays span {
  font-size: 12px;
}

.calendar-only-card .calendar-grid {
  gap: 8px;
}

.calendar-only-card .calendar-cell {
  min-height: 38px;
  border-radius: 12px;
  font-size: 14px;
}

.calendar-only-card .calendar-note strong {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  font-size: 15px;
}

.calendar-only-card .calendar-note span,
.calendar-only-card .calendar-link {
  font-size: 13px;
}

.page-title h2 {
  font-size: 22px;
  font-weight: 800;
  margin: 0 0 2px 0;
  letter-spacing: -0.5px;
}
.page-title p {
  font-size: 12px;
  color: #9CA3AF;
  margin: 0 0 12px 0;
}

/* Grid Layout */
.grid-layout {
  display: flex;
  gap: 16px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
}
.grid-lm {
  flex: 1.6;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  min-height: 0;
}
.grid-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 300px;
  min-height: 0;
}

.lm-top-row {
  display: flex;
  gap: 16px;
  flex: 0 0 392px;
  min-height: 0;
}
.lm-bottom-row {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.col-1 {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
}
.col-2 {
  flex: 1.2;
  min-height: 0;
}

/* Mini Menu Card */
.mini-menu-card {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 10px;
  box-shadow: 0 10px 40px -10px rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}
.mm-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 10px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}
.mm-item:hover { background: #F9FAFB; }
.mm-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-c0 { background: #FFF7ED; color: #F59E0B; }
.icon-c1 { background: #F5F3FF; color: #8B5CF6; }
.icon-c2 { background: #ECFDF5; color: #10B981; }
.mm-icon svg { width: 14px; height: 14px; }
.mm-label {
  flex: 1;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: #4B5563;
}
.mm-arrow {
  color: #9CA3AF;
  font-size: 16px;
  font-weight: 300;
}

/* Composer / Illustrator Card */
.composer-card-tall {
  background: #FFFFFF;
  border-radius: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px -10px rgba(0,0,0,0.04);
  overflow: hidden;
}
.cct-pattern {
  height: 176px;
  background: linear-gradient(180deg, #fff9ef 0%, #fffdf8 100%);
  position: relative;
  overflow: hidden;
}
.calendar-shell {
  height: 100%;
  padding: 14px 16px 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}
.calendar-shell::before {
  content: '';
  position: absolute;
  right: -18px;
  top: -18px;
  width: 140px;
  height: 140px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.18), rgba(251, 191, 36, 0));
  pointer-events: none;
}
.calendar-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.calendar-month {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #111827;
}
.calendar-meta {
  margin-top: 3px;
  font-size: 11px;
  color: #6b7280;
}
.calendar-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #6b7280;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  display: inline-block;
}
.dot.amber { background: #f59e0b; }
.dot.blue { background: #60a5fa; }
.dot.violet { background: #8b5cf6; }
.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.calendar-weekdays span {
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  color: #9ca3af;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.calendar-cell {
  min-height: 18px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  background: rgba(255, 255, 255, 0.78);
}
.calendar-cell.is-muted {
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.34);
}
.calendar-cell.is-today {
  background: #111827;
  color: #ffffff;
  box-shadow: 0 10px 20px -16px rgba(17, 24, 39, 0.8);
}
.calendar-cell.accent-amber {
  background: rgba(251, 191, 36, 0.18);
  color: #b45309;
}
.calendar-cell.accent-blue {
  background: rgba(96, 165, 250, 0.18);
  color: #1d4ed8;
}
.calendar-cell.accent-violet {
  background: rgba(139, 92, 246, 0.16);
  color: #6d28d9;
}
.cell-dot {
  position: absolute;
  bottom: 3px;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
}
.calendar-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.calendar-note {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.calendar-note strong {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.18);
  color: #b45309;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.calendar-note span {
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.calendar-link {
  min-height: 26px;
  padding: 0 10px;
  border: none;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.06);
  color: #4b5563;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.cct-content {
  padding: 14px 16px 14px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.cct-content h3 {
  font-size: 15px;
  font-weight: 800;
  margin: 0 0 4px 0;
}
.cct-content p {
  font-size: 11px;
  color: #6B7280;
  line-height: 1.4;
  margin: 0 0 8px 0;
}
.cct-content textarea {
  width: 100%;
  flex: 1;
  min-height: 52px;
  background: #F9FAFB;
  border: 1px solid #F3F4F6;
  border-radius: 10px;
  padding: 9px 10px;
  font-size: 12px;
  resize: none;
  font-family: inherit;
  margin-bottom: 8px;
  box-sizing: border-box;
}
.cct-content textarea:focus {
  outline: none;
  border-color: #8B5CF6;
}
.cct-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.cct-avatars {
  display: flex;
  align-items: center;
}
.cct-avatars img {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 2px solid #FFF;
  margin-left: -6px;
}
.cct-avatars img:first-child { margin-left: 0; }
.cct-more {
  font-size: 10px;
  color: #6B7280;
  font-weight: 600;
  margin-left: 6px;
}
.cct-btn {
  background: transparent;
  color: #111827;
  font-weight: 600;
  font-size: 12px;
  padding: 0;
  border: none;
  text-align: left;
  cursor: pointer;
}
.cct-btn:disabled { color: #9CA3AF; cursor: not-allowed; }

/* Recent Tasks (My Tutors) */
.section-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}
.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin: 0 0 10px 0;
}
.section-subtitle {
  margin: 4px 0 0;
  font-size: 11px;
  color: #9CA3AF;
}
.section-link {
  min-height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: #F3F4F6;
  color: #4B5563;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.task-status-merge {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 10px 12px;
  box-shadow: 0 10px 40px -14px rgba(0,0,0,0.04);
  margin-bottom: 10px;
}
.task-status-merge-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.task-status-label {
  font-size: 12px;
  color: #6B7280;
}
.task-status-value {
  font-size: 16px;
  font-weight: 800;
  color: #111827;
}
.task-status-bar {
  height: 6px;
  background: #F3F4F6;
  border-radius: 999px;
  overflow: hidden;
}
.task-status-fill {
  height: 100%;
  background: linear-gradient(90deg, #8B5CF6, #7C3AED);
  border-radius: 999px;
  transition: width 0.5s ease;
}
.tasks-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  align-content: stretch;
}
.task-item {
  background: #FFFFFF;
  border-radius: 14px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 20px -10px rgba(0,0,0,0.03);
  cursor: pointer;
  transition: transform 0.2s;
}
.task-item:hover { transform: translateY(-2px); }
.ti-avatar {
  width: 32px; height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFF;
}
.ti-avatar svg { width: 18px; height: 18px; }
.bg-done { background: #10B981; }
.bg-in_progress, .bg-submitted { background: #3B82F6; }
.bg-ready_to_submit, .bg-draft { background: #F59E0B; }
.bg-failed { background: #EF4444; }

.ti-info {
  flex: 1;
  min-width: 0;
}
.ti-info h4 {
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ti-info p {
  font-size: 9px;
  color: #9CA3AF;
  margin: 0;
}
.ti-action {
  color: #D1D5DB;
  width: 20px; height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ti-action svg { width: 14px; height: 14px; }
.empty-state {
  grid-column: span 2;
  font-size: 12px;
  color: #9CA3AF;
  text-align: center;
  padding: 16px;
}

/* Right Column */
.hero-card {
  border-radius: 20px;
  padding: 14px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: 1;
  justify-content: center;
}
.hc-illus {
  position: absolute;
  top: 0; right: 0; bottom: 0; left: 0;
  pointer-events: none;
}
.hc-content {
  position: relative;
  z-index: 1;
}
.hc-meta {
  font-size: 9px;
  font-weight: 600;
  margin-bottom: 8px;
}
.hero-card h3 {
  font-size: 16px;
  font-weight: 800;
  margin: 0 0 4px 0;
  letter-spacing: -0.5px;
}
.hero-card p {
  font-size: 11px;
  line-height: 1.4;
  margin: 0 0 12px 0;
  max-width: 80%;
}
.hc-link {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  text-align: left;
}

.green-card {
  background: #E8F5E9;
  color: #064E3B;
}
.green-card .hc-meta { color: #059669; }
.green-card p { color: #047857; }
.green-card .hc-link { color: #059669; }
.hc-shape-1 {
  position: absolute; width: 50px; height: 50px; background: #FCA5A5; border-radius: 10px; transform: rotate(15deg); right: 15px; top: 30px; opacity: 0.8;
}
.hc-shape-2 {
  position: absolute; width: 30px; height: 30px; background: #3B82F6; border-radius: 8px; right: 50px; top: 60px; opacity: 0.8;
}

.stats-boxes {
  display: flex;
  gap: 10px;
  flex: 0 0 102px;
}
.stat-box {
  flex: 1;
  border-radius: 20px;
  padding: 12px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
.sb-bg {
  position: absolute;
  top: -15px; left: -15px;
  width: 60px; height: 60px;
  border-radius: 50%;
  opacity: 0.5;
}
.box-orange { background: #FAF3E8; }
.box-orange .sb-bg { background: #FDE68A; }
.box-orange .sb-val { color: #D97706; }
.box-purple { background: #F5F3FF; }
.box-purple .sb-bg { background: #DDD6FE; }
.box-purple .sb-val { color: #111827; }

.sb-val {
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  position: relative;
  z-index: 1;
}
.sb-label {
  font-size: 10px;
  color: #6B7280;
  margin-top: 4px;
  position: relative;
  z-index: 1;
}

.blue-card {
  background: #E0F2FE;
  color: #0C4A6E;
}
.blue-card .hc-meta { color: #0284C7; }
.blue-card p { color: #0369A1; }
.blue-card .hc-link { color: #0284C7; }
.hc-shape-3 {
  position: absolute; width: 40px; height: 40px; background: #A78BFA; border-radius: 50%; right: 20px; top: 20px;
}
.hc-shape-4 {
  position: absolute; width: 30px; height: 50px; background: #34D399; border-radius: 8px; transform: rotate(-20deg); right: 50px; top: 40px;
}

/* Stage / Detail pages */
.workspace-stage {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  border-radius: 20px;
  margin: 16px;
  box-shadow: 0 10px 40px -10px rgba(0,0,0,0.04);
  overflow: hidden;
}
.stage-head {
  padding: 20px 24px;
  border-bottom: 1px solid #F3F4F6;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stage-title { font-size: 20px; font-weight: 800; }
.stage-subtitle { font-size: 12px; color: #6B7280; margin-top: 4px; }
.stage-back {
  background: #F3F4F6;
  border: none;
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  cursor: pointer;
}
.stage-body {
  flex: 1;
  overflow: auto;
  padding: 20px 24px;
}

/* Responsiveness */
@media (max-width: 1200px) {
  .grid-layout { flex-direction: column; overflow-y: auto; }
  .grid-right { width: 100%; min-height: 400px; }
  .workspace-scroll { overflow-y: auto; }
}
@media (max-width: 900px) {
  .lm-top-row { flex-direction: column; }
  .app-wrapper { width: 100vw; height: 100vh; border-radius: 0; }
}
</style>
