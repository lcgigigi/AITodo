<script setup lang="ts">
import { computed } from 'vue'
import IconMaximize2 from '~icons/lucide/maximize-2'
import IconMinimize2 from '~icons/lucide/minimize-2'

export type DashboardViewMode = 'simple' | 'detail'

const props = defineProps<{
  modelValue: DashboardViewMode
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DashboardViewMode]
}>()

const targetMode = computed<DashboardViewMode>(() =>
  props.modelValue === 'simple' ? 'detail' : 'simple',
)

const actionMeta = computed(() => {
  if (props.modelValue === 'simple') {
    return {
      label: '切换到深度工作台',
      hint: '展开全量日历与清单',
      icon: IconMaximize2,
    }
  }

  return {
    label: '切换到总览视角',
    hint: '收起到快速总览卡片',
    icon: IconMinimize2,
  }
})

function toggleMode() {
  emit('update:modelValue', targetMode.value)
}
</script>

<template>
  <button
    class="view-mode-toggle icon-button"
    type="button"
    data-tour-target="detail-mode"
    :aria-label="actionMeta.label"
    :title="`${actionMeta.label} · ${actionMeta.hint}`"
    @click="toggleMode"
  >
    <component :is="actionMeta.icon" aria-hidden="true" />
  </button>
</template>

<style scoped>
.view-mode-toggle {
  position: relative;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: #21304f;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  font: inherit;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.view-mode-toggle:hover {
  border-color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.62);
  color: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 12px 26px -18px rgba(15, 23, 42, 0.42);
}

.view-mode-toggle:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.34);
  outline-offset: 3px;
}

.view-mode-toggle svg {
  width: 20px;
  height: 20px;
  stroke-width: 1.75;
}
</style>
