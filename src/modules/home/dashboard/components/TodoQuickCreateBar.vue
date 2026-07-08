<script setup lang="ts">
import { computed } from 'vue'
import IconPlus from '~icons/lucide/plus'
import IconSendHorizontal from '~icons/lucide/send-horizontal'

const props = withDefaults(
  defineProps<{
    variant?: 'simple' | 'detail'
    inputId?: string
    disabled?: boolean
    embedded?: boolean
  }>(),
  {
    variant: 'simple',
    inputId: undefined,
    disabled: false,
    embedded: false,
  },
)

const model = defineModel<string>({ default: '' })

const emit = defineEmits<{
  'full-create': []
  submit: []
}>()

const canSubmit = computed(() => Boolean(model.value.trim()) && !props.disabled)

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit')
}
</script>

<template>
  <form
    class="todo-quick-create-bar"
    :class="[
      `is-${variant}`,
      {
        'is-detail-card': variant === 'detail',
        'is-embedded': embedded,
      },
    ]"
    data-tour-target="quick-create"
    @submit.prevent="handleSubmit"
  >
    <button
      type="button"
      class="todo-quick-create-full"
      data-tour-target="add-todo"
      @click="emit('full-create')"
    >
      <IconPlus aria-hidden="true" />
      <span>完整创建</span>
    </button>

    <input
      :id="inputId"
      v-model="model"
      type="text"
      autocomplete="off"
      aria-label="快速创建"
      placeholder="一句话描述待办，按 Enter 创建"
      :disabled="disabled"
    />

    <button type="submit" :disabled="!canSubmit" aria-label="快速创建">
      <IconSendHorizontal aria-hidden="true" />
    </button>
  </form>
</template>

<style scoped>
.todo-quick-create-bar {
  flex: 0 0 auto;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.todo-quick-create-bar.is-simple {
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.28);
  padding: 4px 5px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  transition:
    background 0.22s ease,
    border-color 0.22s ease,
    box-shadow 0.22s ease;
}

.todo-quick-create-bar.is-simple:focus-within {
  background: rgba(255, 255, 255, 0.52);
  border-color: rgba(255, 255, 255, 0.78);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 8px 18px -16px rgba(67, 139, 255, 0.22);
}

.todo-quick-create-bar.is-simple.is-embedded {
  border: 0;
  border-radius: 0;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.34);
  padding: 8px 8px;
  box-shadow: none;
}

.todo-quick-create-bar.is-simple.is-embedded:focus-within {
  background: rgba(255, 255, 255, 0.48);
  border-top-color: rgba(148, 163, 184, 0.28);
  box-shadow: none;
}

.todo-quick-create-bar.is-detail.is-detail-card {
  margin: 10px 0 0;
  height: 56px;
  border-radius: 17px;
  padding: 8px 9px 8px 10px;
  background: var(--content-card-bg, rgba(255, 255, 255, 0.74));
  border: 1px solid var(--content-card-border, rgba(214, 225, 238, 0.9));
  box-shadow: var(
    --content-card-shadow,
    0 10px 28px -22px rgba(15, 23, 42, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.52)
  );
  backdrop-filter: var(--content-card-blur, blur(20px) saturate(1.14));
  -webkit-backdrop-filter: var(--content-card-blur, blur(20px) saturate(1.14));
}

.todo-quick-create-full {
  flex: 0 0 auto;
  border: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  cursor: pointer;
  font: inherit;
  transition:
    background 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.todo-quick-create-bar.is-simple .todo-quick-create-full {
  height: 32px;
  padding: 0 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  color: #2f6fe8;
  font-size: 12px;
  font-weight: 800;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.todo-quick-create-bar.is-simple .todo-quick-create-full:hover {
  background: rgba(255, 255, 255, 0.92);
  transform: translateY(-1px);
}

.todo-quick-create-bar.is-detail .todo-quick-create-full {
  height: 34px;
  padding: 0 10px;
  border-radius: 11px;
  color: #2f72ed;
  background: rgba(52, 120, 246, 0.09);
  font-size: 12px;
  font-weight: 800;
}

.todo-quick-create-bar.is-detail .todo-quick-create-full:hover {
  background: rgba(52, 120, 246, 0.14);
}

.todo-quick-create-full svg {
  width: 14px;
  height: 14px;
  stroke-width: 2.5px;
}

.todo-quick-create-bar input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
}

.todo-quick-create-bar.is-simple input {
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
  color: #26334f;
}

.todo-quick-create-bar.is-simple input::placeholder {
  color: #7f8da3;
}

.todo-quick-create-bar.is-detail input {
  font-size: 14px;
  color: #101936;
}

.todo-quick-create-bar.is-detail input::placeholder {
  color: #9aa8bb;
}

.todo-quick-create-bar button[type='submit'] {
  border: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: opacity 0.18s ease;
}

.todo-quick-create-bar.is-simple button[type='submit'] {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(180deg, #5a9bff 0%, #438bff 100%);
  color: #ffffff;
  box-shadow: 0 8px 18px -12px rgba(67, 139, 255, 0.88);
}

.todo-quick-create-bar.is-simple button[type='submit']:hover:not(:disabled) {
  background: linear-gradient(180deg, #6aa5ff 0%, #4f93ff 100%);
}

.todo-quick-create-bar.is-detail button[type='submit'] {
  width: 39px;
  height: 39px;
  border-radius: 13px;
  background: linear-gradient(135deg, #2f72ed, #4d91ff);
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(52, 120, 246, 0.23);
}

.todo-quick-create-bar button[type='submit']:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.todo-quick-create-bar button[type='submit'] svg {
  width: 16px;
  height: 16px;
}

.todo-quick-create-bar.is-detail button[type='submit'] svg {
  width: 18px;
  height: 18px;
}
</style>
