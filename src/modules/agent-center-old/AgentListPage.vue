<script setup lang="ts">
import { computed, ref } from 'vue'
import { levelDescriptions, mockAgents, mockSkills, mockViewerProfiles, permissionLabels } from './mock'
import type { AgentEntry, AgentLevel, PermissionState, SkillEntry } from './types'

type ViewerRole = keyof typeof mockViewerProfiles
type PreviewItem = { type: 'agent'; item: AgentEntry } | { type: 'skill'; item: SkillEntry }

const viewerRole = ref<ViewerRole>('user')
const searchKeyword = ref('')
const selectedCategory = ref('全部')
const selectedLevel = ref<'全部' | AgentLevel>('全部')
const preview = ref<PreviewItem | null>(null)

const viewer = computed(() => mockViewerProfiles[viewerRole.value])
const isAdmin = computed(() => viewerRole.value === 'admin')
const previewOpen = computed({
  get: () => Boolean(preview.value),
  set: (open: boolean) => {
    if (!open) preview.value = null
  },
})

const agentLevels: AgentLevel[] = ['L1', 'L2', 'L3', 'L4']
const categories = computed(() => ['全部', ...new Set(mockAgents.map((agent) => agent.category))])
const agentsById = computed(() => new Map(mockAgents.map((agent) => [agent.id, agent])))
const skillsById = computed(() => new Map(mockSkills.map((skill) => [skill.id, skill])))

const visibleAgents = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()

  return mockAgents.filter((agent) => {
    const matchesKeyword =
      !keyword ||
      [agent.name, agent.description, agent.category, agent.owner, ...agent.scenarios]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    const matchesCategory = selectedCategory.value === '全部' || agent.category === selectedCategory.value
    const matchesLevel = selectedLevel.value === '全部' || agent.level === selectedLevel.value

    return matchesKeyword && matchesCategory && matchesLevel
  })
})

const visibleSkills = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()

  return mockSkills.filter((skill) => {
    const relatedAgentNames = skill.callableByAgentIds
      .map((id) => agentsById.value.get(id)?.name ?? '')
      .join(' ')

    return (
      !keyword ||
      [skill.name, skill.description, skill.capabilityType, skill.owner, skill.callType, relatedAgentNames]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    )
  })
})

const overviewStats = computed(() => {
  const availableAgents = mockAgents.filter((agent) => canUse(agent.permissionState)).length
  const availableSkills = mockSkills.filter((skill) => canUse(skill.permissionState)).length
  const lockedCount = [...mockAgents, ...mockSkills].filter((item) => !canUse(item.permissionState)).length
  const highlightedCount = [...mockAgents, ...mockSkills].filter((item) => item.recommended).length

  return [
    { label: '可用 Agent', value: availableAgents, tone: 'blue' },
    { label: '可用 Skills', value: availableSkills, tone: 'green' },
    { label: '锁定能力', value: lockedCount, tone: 'amber' },
    { label: '推荐更新', value: highlightedCount, tone: 'violet' },
  ]
})

const levelStats = computed(() =>
  agentLevels.map((level) => ({
    level,
    count: mockAgents.filter((agent) => agent.level === level).length,
    description: levelDescriptions[level],
  })),
)

const previewAgentSkills = computed(() => {
  if (preview.value?.type !== 'agent') return []

  return preview.value.item.skillIds
    .map((id) => skillsById.value.get(id))
    .filter((skill): skill is SkillEntry => Boolean(skill))
})

const previewSkillAgents = computed(() => {
  if (preview.value?.type !== 'skill') return []

  return preview.value.item.callableByAgentIds
    .map((id) => agentsById.value.get(id))
    .filter((agent): agent is AgentEntry => Boolean(agent))
})

function canUse(permissionState: PermissionState) {
  return isAdmin.value || permissionState === 'available'
}

function permissionText(permissionState: PermissionState) {
  return isAdmin.value ? '管理者可用' : permissionLabels[permissionState]
}

function statusText(status: AgentEntry['status'] | SkillEntry['status']) {
  const labels: Record<AgentEntry['status'] | SkillEntry['status'], string> = {
    online: '在线',
    beta: '试用',
    maintenance: '维护',
    draft: '规划中',
    ready: '就绪',
  }

  return labels[status]
}

function formatUsage(count: number) {
  return new Intl.NumberFormat('zh-CN').format(count)
}
</script>

<template>
  <div class="agent-page-shell">
    <header class="page-top">
      <div>
        <p>智能体中心</p>
        <h1>智能体目录</h1>
      </div>

      <div class="top-actions">
        <n-radio-group v-model:value="viewerRole" size="small">
          <n-radio-button value="user">员工</n-radio-button>
          <n-radio-button value="admin">管理者</n-radio-button>
        </n-radio-group>
        <span class="permission-note" :class="{ 'is-admin': isAdmin }">
          {{ viewer.label }} · {{ viewer.permissions.length }} 项权限
        </span>
      </div>
    </header>

    <section class="metric-strip" aria-label="智能体概览">
      <article v-for="stat in overviewStats" :key="stat.label" class="metric-cell" :class="`tone-${stat.tone}`">
        <span>{{ stat.label }}</span>
        <strong>{{ stat.value }}</strong>
      </article>
    </section>

    <section class="workbench-grid">
      <aside class="filter-rail" aria-label="筛选">
        <n-input v-model:value="searchKeyword" clearable placeholder="搜索名称、场景、负责人" />

        <section class="rail-section">
          <header>
            <h2>业务分类</h2>
            <span>{{ categories.length - 1 }}</span>
          </header>
          <div class="category-stack">
            <button
              v-for="category in categories"
              :key="category"
              class="filter-button"
              :class="{ active: selectedCategory === category }"
              type="button"
              @click="selectedCategory = category"
            >
              <span>{{ category }}</span>
              <strong>
                {{ category === '全部' ? mockAgents.length : mockAgents.filter((agent) => agent.category === category).length }}
              </strong>
            </button>
          </div>
        </section>

        <section class="rail-section">
          <header>
            <h2>自动化等级</h2>
            <span>{{ selectedLevel }}</span>
          </header>
          <div class="level-stack">
            <button
              class="level-filter"
              :class="{ active: selectedLevel === '全部' }"
              type="button"
              @click="selectedLevel = '全部'"
            >
              <span>全部等级</span>
              <strong>{{ mockAgents.length }}</strong>
            </button>
            <button
              v-for="item in levelStats"
              :key="item.level"
              class="level-filter"
              :class="[`level-${item.level.toLowerCase()}`, { active: selectedLevel === item.level }]"
              type="button"
              @click="selectedLevel = item.level"
            >
              <span>
                <strong>{{ item.level }}</strong>
                {{ item.description }}
              </span>
              <em>{{ item.count }}</em>
            </button>
          </div>
        </section>

        <section class="access-panel" :class="{ 'is-admin': isAdmin }">
          <strong>{{ isAdmin ? '全部可见' : '锁定项可见' }}</strong>
          <p>{{ isAdmin ? '管理者视角展示维护中和规划中能力。' : '无权限项保留在目录中，进入前需要申请。' }}</p>
        </section>
      </aside>

      <main class="agent-board" aria-label="Agent 列表">
        <header class="board-head">
          <div>
            <p>Agents</p>
            <h2>智能体列表</h2>
          </div>
          <span>{{ visibleAgents.length }} / {{ mockAgents.length }}</span>
        </header>

        <div class="agent-table">
          <button
            v-for="agent in visibleAgents"
            :key="agent.id"
            class="agent-row"
            :class="[`level-${agent.level.toLowerCase()}`, { locked: !canUse(agent.permissionState) }]"
            type="button"
            @click="preview = { type: 'agent', item: agent }"
          >
            <span class="level-token">{{ agent.level }}</span>

            <span class="row-main">
              <span class="row-kicker">{{ agent.category }} · {{ agent.owner }} · {{ agent.updatedAt }}</span>
              <span class="row-title">
                <strong>{{ agent.name }}</strong>
                <em>{{ statusText(agent.status) }}</em>
                <em v-if="agent.recommended" class="recommended">推荐</em>
              </span>
              <span class="row-description">{{ agent.description }}</span>
              <span class="skill-strip">
                <span v-for="skillId in agent.skillIds" :key="skillId">{{ skillsById.get(skillId)?.name }}</span>
              </span>
            </span>

            <span class="usage-cell">
              <strong>{{ formatUsage(agent.usageCount) }}</strong>
              <span>使用</span>
            </span>

            <span class="permission-chip" :class="{ locked: !canUse(agent.permissionState) }">
              {{ permissionText(agent.permissionState) }}
            </span>
          </button>

          <n-empty v-if="visibleAgents.length === 0" description="没有匹配的智能体" />
        </div>
      </main>

      <aside class="skill-board" aria-label="Skills 列表">
        <header class="board-head">
          <div>
            <p>Skills</p>
            <h2>能力组件</h2>
          </div>
          <span>{{ visibleSkills.length }}</span>
        </header>

        <div class="skill-stack">
          <button
            v-for="skill in visibleSkills"
            :key="skill.id"
            class="skill-row"
            :class="{ locked: !canUse(skill.permissionState) }"
            type="button"
            @click="preview = { type: 'skill', item: skill }"
          >
            <span class="skill-type">{{ skill.capabilityType }}</span>
            <span class="skill-title">
              <strong>{{ skill.name }}</strong>
              <em>{{ statusText(skill.status) }}</em>
            </span>
            <span class="skill-desc">{{ skill.description }}</span>
            <span class="skill-meta">
              <span>{{ skill.callType }}</span>
              <span>{{ permissionText(skill.permissionState) }}</span>
            </span>
          </button>

          <n-empty v-if="visibleSkills.length === 0" description="没有匹配的 Skills" />
        </div>
      </aside>
    </section>

    <n-modal v-model:show="previewOpen" preset="card" class="preview-modal" :bordered="false">
      <template v-if="preview" #header>
        <div class="preview-head">
          <span v-if="preview.type === 'agent'" class="level-token large">{{ preview.item.level }}</span>
          <span v-else class="skill-preview-mark">{{ preview.item.capabilityType.slice(0, 2) }}</span>
          <div>
            <p>{{ preview.type === 'agent' ? 'Agent Preview' : 'Skill Preview' }}</p>
            <h2>{{ preview.item.name }}</h2>
          </div>
        </div>
      </template>

      <div v-if="preview" class="preview-body">
        <p class="preview-description">{{ preview.item.description }}</p>

        <div class="preview-meta-grid">
          <span>
            <strong>状态</strong>
            {{ statusText(preview.item.status) }}
          </span>
          <span>
            <strong>负责人</strong>
            {{ preview.item.owner }}
          </span>
          <span>
            <strong>最近更新</strong>
            {{ preview.item.updatedAt }}
          </span>
          <span>
            <strong>权限</strong>
            {{ permissionText(preview.item.permissionState) }}
          </span>
        </div>

        <template v-if="preview.type === 'agent'">
          <section class="preview-section">
            <h3>等级说明</h3>
            <p>{{ levelDescriptions[preview.item.level] }}</p>
          </section>

          <section class="preview-section">
            <h3>适用场景</h3>
            <div class="tag-row">
              <span v-for="scenario in preview.item.scenarios" :key="scenario">{{ scenario }}</span>
            </div>
          </section>

          <section class="example-grid">
            <div>
              <h3>输入示例</h3>
              <p>{{ preview.item.inputExample }}</p>
            </div>
            <div>
              <h3>输出示例</h3>
              <p>{{ preview.item.outputExample }}</p>
            </div>
          </section>

          <section class="preview-section">
            <h3>关联 Skills</h3>
            <div class="tag-row">
              <span v-for="skill in previewAgentSkills" :key="skill.id">{{ skill.name }}</span>
            </div>
          </section>
        </template>

        <template v-else>
          <section class="preview-section">
            <h3>能力边界</h3>
            <p>{{ preview.item.boundary }}</p>
          </section>

          <section class="preview-section">
            <h3>调用说明</h3>
            <p>{{ preview.item.callType }}，由授权 Agent 在任务流程中调用。</p>
          </section>

          <section class="preview-section">
            <h3>关联 Agent</h3>
            <div class="tag-row">
              <span v-for="agent in previewSkillAgents" :key="agent.id">{{ agent.name }}</span>
            </div>
          </section>
        </template>

        <div class="preview-actions">
          <n-button v-if="canUse(preview.item.permissionState)" type="primary">进入使用</n-button>
          <n-button v-else type="warning" secondary>申请权限</n-button>
          <n-button secondary @click="preview = null">关闭</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<style scoped>
.agent-page-shell {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24px;
  background: #f4f7fb;
  color: #111827;
}

.page-top {
  min-width: 0;
  margin-bottom: 16px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}

.page-top p,
.board-head p,
.preview-head p {
  margin: 0 0 6px;
  color: #667085;
  font-size: 12px;
  font-weight: 850;
}

.page-top h1 {
  margin: 0;
  color: #101828;
  font-size: 30px;
  line-height: 1.15;
  font-weight: 850;
  letter-spacing: 0;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.permission-note,
.board-head > span {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}

.permission-note.is-admin {
  background: #f5f3ff;
  color: #6d28d9;
}

.metric-strip {
  margin-bottom: 12px;
  border: 1px solid #e6ebf2;
  border-radius: 8px;
  background: #ffffff;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
}

.metric-cell {
  min-height: 74px;
  padding: 14px 16px;
  border-right: 1px solid #edf1f6;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
}

.metric-cell:last-child {
  border-right: 0;
}

.metric-cell::before {
  content: '';
  position: absolute;
  left: 0;
  top: 14px;
  bottom: 14px;
  width: 3px;
  border-radius: 999px;
  background: currentColor;
}

.metric-cell span {
  color: #667085;
  font-size: 12px;
  font-weight: 750;
}

.metric-cell strong {
  color: #101828;
  font-size: 24px;
  line-height: 1;
}

.tone-blue { color: #2563eb; }
.tone-green { color: #059669; }
.tone-amber { color: #d97706; }
.tone-violet { color: #7c3aed; }

.workbench-grid {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr) 340px;
  gap: 12px;
  align-items: start;
}

.filter-rail,
.agent-board,
.skill-board {
  min-width: 0;
  border: 1px solid #e6ebf2;
  border-radius: 8px;
  background: #ffffff;
}

.filter-rail {
  padding: 14px;
  display: grid;
  gap: 16px;
}

.rail-section {
  display: grid;
  gap: 10px;
}

.rail-section header,
.board-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.rail-section h2,
.board-head h2,
.preview-head h2 {
  margin: 0;
  color: #101828;
  font-size: 16px;
  line-height: 1.25;
}

.rail-section header > span {
  color: #98a2b3;
  font-size: 12px;
  font-weight: 850;
}

.category-stack,
.level-stack,
.agent-table,
.skill-stack {
  display: grid;
  gap: 8px;
}

.filter-button,
.level-filter,
.agent-row,
.skill-row {
  width: 100%;
  border: 1px solid #edf1f6;
  border-radius: 8px;
  background: #ffffff;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}

.filter-button {
  min-height: 34px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.filter-button span,
.filter-button strong {
  font-size: 13px;
}

.filter-button span {
  color: #344054;
}

.filter-button strong {
  color: #98a2b3;
  font-weight: 850;
}

.filter-button:hover,
.filter-button.active,
.level-filter:hover,
.level-filter.active,
.agent-row:hover,
.skill-row:hover {
  border-color: rgba(79, 124, 255, 0.34);
  background: #f8fbff;
  box-shadow: 0 12px 28px -24px rgba(15, 23, 42, 0.42);
}

.level-filter {
  min-height: 58px;
  padding: 10px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.level-filter span {
  min-width: 0;
  color: #667085;
  display: grid;
  gap: 4px;
  font-size: 11px;
  line-height: 1.35;
}

.level-filter span strong,
.level-filter > strong {
  color: #101828;
  font-size: 13px;
  line-height: 1;
}

.level-filter em {
  min-width: 24px;
  color: #667085;
  font-size: 12px;
  font-style: normal;
  font-weight: 850;
  text-align: right;
}

.access-panel {
  border-radius: 8px;
  background: #f8fafc;
  padding: 12px;
  border-left: 3px solid #4f7cff;
}

.access-panel.is-admin {
  border-left-color: #7c3aed;
}

.access-panel strong,
.access-panel p {
  margin: 0;
}

.access-panel strong {
  display: block;
  color: #101828;
  font-size: 13px;
}

.access-panel p {
  margin-top: 6px;
  color: #667085;
  font-size: 12px;
  line-height: 1.55;
}

.agent-board,
.skill-board {
  padding: 16px;
  display: grid;
  gap: 14px;
}

.agent-row {
  min-height: 112px;
  padding: 14px;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 86px auto;
  gap: 14px;
  align-items: center;
}

.agent-row.locked,
.skill-row.locked {
  background: #fcfcfd;
}

.level-token,
.skill-preview-mark {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  color: #ffffff;
  background: #2563eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 900;
}

.level-token.large,
.skill-preview-mark {
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
}

.level-l1 .level-token,
.level-l1.level-filter.active {
  background: #eff6ff;
  color: #2563eb;
}

.level-l1 .level-token { background: #2563eb; color: #ffffff; }
.level-l2 .level-token { background: #059669; }
.level-l3 .level-token { background: #d97706; }
.level-l4 .level-token { background: #7c3aed; }

.row-main {
  min-width: 0;
  display: grid;
  gap: 7px;
}

.row-kicker,
.row-description,
.skill-desc {
  color: #667085;
  font-size: 12px;
  line-height: 1.45;
}

.row-title,
.skill-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-title strong,
.skill-title strong {
  min-width: 0;
  color: #101828;
  font-size: 16px;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-title em,
.skill-title em {
  min-height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-style: normal;
  font-weight: 850;
  white-space: nowrap;
}

.row-title .recommended {
  background: #fffbeb;
  color: #b45309;
}

.skill-strip,
.tag-row,
.skill-meta {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-strip span,
.tag-row span,
.skill-meta span {
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f2f4f7;
  color: #475467;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 750;
}

.usage-cell {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.usage-cell strong {
  color: #101828;
  font-size: 18px;
  line-height: 1;
}

.usage-cell span {
  color: #98a2b3;
  font-size: 11px;
  font-weight: 750;
}

.permission-chip {
  min-height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}

.permission-chip.locked {
  background: #fff7ed;
  color: #c2410c;
}

.skill-row {
  min-height: 112px;
  padding: 13px;
  display: grid;
  gap: 8px;
}

.skill-type {
  width: fit-content;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #eef6ff;
  color: #2456a6;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 850;
}

.preview-modal {
  width: min(720px, calc(100vw - 32px));
}

.preview-head {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.skill-preview-mark {
  background: #0f766e;
}

.preview-body {
  display: grid;
  gap: 16px;
}

.preview-description,
.preview-section p,
.example-grid p {
  margin: 0;
  color: #475467;
  font-size: 14px;
  line-height: 1.65;
}

.preview-meta-grid,
.example-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.example-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.preview-meta-grid span,
.example-grid div {
  min-width: 0;
  border: 1px solid #edf1f6;
  border-radius: 8px;
  background: #f8fafc;
  padding: 12px;
  color: #475467;
  font-size: 13px;
  line-height: 1.45;
}

.preview-meta-grid strong,
.preview-section h3,
.example-grid h3 {
  display: block;
  margin: 0 0 6px;
  color: #101828;
  font-size: 13px;
  line-height: 1.35;
}

.preview-section {
  display: grid;
  gap: 8px;
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 1180px) {
  .workbench-grid {
    grid-template-columns: 240px minmax(0, 1fr);
  }

  .skill-board {
    grid-column: 1 / -1;
  }

  .skill-stack {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .agent-page-shell {
    padding: 16px;
  }

  .page-top {
    align-items: flex-start;
    flex-direction: column;
  }

  .top-actions {
    justify-content: flex-start;
  }

  .metric-strip,
  .workbench-grid,
  .skill-stack,
  .preview-meta-grid,
  .example-grid {
    grid-template-columns: 1fr;
  }

  .metric-cell {
    border-right: 0;
    border-bottom: 1px solid #edf1f6;
  }

  .metric-cell:last-child {
    border-bottom: 0;
  }

  .agent-row {
    grid-template-columns: 46px minmax(0, 1fr);
  }

  .usage-cell {
    grid-column: 2;
    justify-items: start;
  }

  .permission-chip {
    grid-column: 2;
    width: fit-content;
  }

  .row-title,
  .skill-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .row-title strong,
  .skill-title strong {
    white-space: normal;
  }
}
</style>
