<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import IconMaximize2 from '~icons/lucide/maximize-2'
import IconMinimize2 from '~icons/lucide/minimize-2'
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

const barRef = ref<HTMLElement | null>(null)
const compactInputRef = ref<HTMLTextAreaElement | null>(null)
const expandedFormRef = ref<HTMLElement | null>(null)
const expandedInputRef = ref<HTMLTextAreaElement | null>(null)
const OVERLAY_PANEL_SELECTOR = '.home-main-panel, .detail-main-panel'
const EXPANDED_INPUT_MIN_HEIGHT = 128
const EXPANDED_FORM_MIN_HEIGHT = 188
const EXPANDED_MAX_VIEWPORT_RATIO = 0.5
const EXPANDED_MAX_HEIGHT_CAP = 400

const isExpanded = ref(false)
const anchorStyle = ref<Record<string, string>>({})
const overlayBounds = ref<Record<string, string>>({})

const canSubmit = computed(() => Boolean(model.value.trim()) && !props.disabled)

const placeholder =
  '例如：明天下午给xxx布置xxx任务'

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit')
  if (isExpanded.value) {
    collapseExpanded()
  }
}

function resolveOverlayContainer() {
  return barRef.value?.closest(OVERLAY_PANEL_SELECTOR) as HTMLElement | null
}

function resolveExpandedFormMaxHeight() {
  const bar = barRef.value
  const container = resolveOverlayContainer()

  let maxHeight = Math.min(window.innerHeight * EXPANDED_MAX_VIEWPORT_RATIO, EXPANDED_MAX_HEIGHT_CAP)
  if (bar && container) {
    const barRect = bar.getBoundingClientRect()
    const panelRect = container.getBoundingClientRect()
    const availableHeight = barRect.top - panelRect.top - 12
    maxHeight = Math.min(maxHeight, Math.max(EXPANDED_FORM_MIN_HEIGHT, availableHeight))
  }

  return maxHeight
}

function resolveExpandedChromeHeight() {
  const form = expandedFormRef.value
  if (!form) return 78

  const footer = form.querySelector('.todo-quick-create-expanded-footer')
  const body = form.querySelector('.todo-quick-create-expanded-body')
  const footerHeight = footer?.getBoundingClientRect().height ?? 56
  const bodyStyle = body ? window.getComputedStyle(body) : null
  const bodyPadding = bodyStyle
    ? parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom)
    : 22

  return footerHeight + bodyPadding
}

function syncExpandedHeight() {
  const input = expandedInputRef.value
  if (!input) return

  input.style.height = 'auto'

  const formMaxHeight = resolveExpandedFormMaxHeight()
  const textareaMaxHeight = Math.max(
    EXPANDED_INPUT_MIN_HEIGHT,
    formMaxHeight - resolveExpandedChromeHeight(),
  )
  const contentHeight = Math.ceil(input.scrollHeight)
  const nextHeight = Math.min(contentHeight, textareaMaxHeight)

  input.style.height = `${nextHeight}px`
  input.style.overflowY = contentHeight > textareaMaxHeight ? 'auto' : 'hidden'
}

function updateOverlayLayout() {
  const bar = barRef.value
  const container = resolveOverlayContainer()
  if (!bar || !container) return

  const barRect = bar.getBoundingClientRect()
  const panelRect = container.getBoundingClientRect()
  const panelStyle = window.getComputedStyle(container)

  overlayBounds.value = {
    left: `${panelRect.left}px`,
    top: `${panelRect.top}px`,
    width: `${panelRect.width}px`,
    height: `${panelRect.height}px`,
    borderRadius: panelStyle.borderRadius,
  }

  anchorStyle.value = {
    left: `${barRect.left - panelRect.left}px`,
    width: `${barRect.width}px`,
    bottom: `${panelRect.bottom - barRect.bottom}px`,
    maxHeight: `${resolveExpandedFormMaxHeight()}px`,
  }
}

function scrollCompactToLastLine() {
  const input = compactInputRef.value
  if (!input || isExpanded.value || !model.value.includes('\n')) return

  input.scrollTop = Math.max(0, input.scrollHeight - input.clientHeight)
  input.scrollLeft = Math.max(0, input.scrollWidth - input.clientWidth)
}

function focusCompactAtEnd() {
  const input = compactInputRef.value
  if (!input) return

  input.focus()
  scrollCompactToLastLine()
  const length = input.value.length
  input.setSelectionRange(length, length)
}

async function expandComposer(options?: { appendNewline?: boolean }) {
  if (props.disabled || isExpanded.value) return

  if (options?.appendNewline) {
    model.value = `${model.value}\n`
  }

  updateOverlayLayout()
  isExpanded.value = true

  await nextTick()
  syncExpandedHeight()

  const input = expandedInputRef.value
  if (!input) return

  input.focus()
  const length = input.value.length
  input.setSelectionRange(length, length)
}

function collapseExpanded() {
  if (!isExpanded.value) return

  isExpanded.value = false

  void nextTick(() => {
    focusCompactAtEnd()
  })
}

function handleCompactFocus() {
  scrollCompactToLastLine()
}

function handleCompactKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSubmit()
    return
  }

  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault()
    void expandComposer({ appendNewline: true })
  }
}

function handleExpandedKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    collapseExpanded()
    return
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSubmit()
    return
  }

  if (event.key === 'Enter' && event.shiftKey) {
    void nextTick(() => {
      syncExpandedHeight()
    })
  }
}

function handleOverlayLayoutChange() {
  if (!isExpanded.value) return
  updateOverlayLayout()
  syncExpandedHeight()
}

function handleFullCreate() {
  if (isExpanded.value) {
    collapseExpanded()
  }
  emit('full-create')
}

watch(
  () => model.value,
  () => {
    if (isExpanded.value) {
      void nextTick(() => {
        syncExpandedHeight()
      })
      return
    }

    scrollCompactToLastLine()
  },
)

watch(isExpanded, (expanded) => {
  if (expanded) {
    window.addEventListener('resize', handleOverlayLayoutChange)
    window.addEventListener('scroll', handleOverlayLayoutChange, true)
    return
  }

  window.removeEventListener('resize', handleOverlayLayoutChange)
  window.removeEventListener('scroll', handleOverlayLayoutChange, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleOverlayLayoutChange)
  window.removeEventListener('scroll', handleOverlayLayoutChange, true)
})
</script>

<template>
  <div class="todo-quick-create-root">
    <form
      ref="barRef"
      class="todo-quick-create-bar"
      :class="[
        `is-${variant}`,
        {
          'is-detail-card': variant === 'detail',
          'is-embedded': embedded,
          'is-expanded-source': isExpanded,
        },
      ]"
      data-tour-target="quick-create"
      @submit.prevent="handleSubmit"
    >
      <button
        type="button"
        class="todo-quick-create-full"
        data-tour-target="add-todo"
        @click="handleFullCreate"
      >
        <IconPlus aria-hidden="true" />
        <span>完整创建</span>
      </button>

      <div class="todo-quick-create-input-wrap">
        <textarea
          :id="isExpanded ? undefined : inputId"
          ref="compactInputRef"
          v-model="model"
          class="todo-quick-create-input is-compact"
          rows="1"
          autocomplete="off"
          aria-label="快速创建"
          :placeholder="placeholder"
          :disabled="disabled"
          @focus="handleCompactFocus"
          @keydown="handleCompactKeydown"
        />

        <button
          type="button"
          class="todo-quick-create-expand"
          data-tour-target="quick-create-expand"
          aria-label="展开输入框"
          :disabled="disabled"
          @click="() => void expandComposer()"
        >
          <IconMaximize2 aria-hidden="true" />
        </button>
      </div>

      <button type="submit" :disabled="!canSubmit" aria-label="快速创建">
        <IconSendHorizontal aria-hidden="true" />
      </button>
    </form>

    <Teleport to="body">
      <Transition name="todo-quick-create-expand">
        <div
          v-if="isExpanded"
          class="todo-quick-create-overlay"
          :class="[`is-${variant}`, { 'is-embedded': embedded }]"
          :style="overlayBounds"
        >
          <button
            type="button"
            class="todo-quick-create-backdrop"
            aria-label="收起输入框"
            @click="collapseExpanded"
          />

          <form
            ref="expandedFormRef"
            class="todo-quick-create-expanded"
            :class="[
              `is-${variant}`,
              {
                'is-detail-card': variant === 'detail',
                'is-embedded': embedded,
              },
            ]"
            :style="anchorStyle"
            @submit.prevent="handleSubmit"
          >
            <div class="todo-quick-create-expanded-body">
              <textarea
                :id="inputId"
                ref="expandedInputRef"
                v-model="model"
                class="todo-quick-create-input is-expanded"
                autocomplete="off"
                aria-label="快速创建"
                :placeholder="placeholder"
                :disabled="disabled"
                @keydown="handleExpandedKeydown"
                @input="syncExpandedHeight"
              />
            </div>

            <div class="todo-quick-create-expanded-footer">
              <button type="button" class="todo-quick-create-full" @click="handleFullCreate">
                <IconPlus aria-hidden="true" />
                <span>完整创建</span>
              </button>

              <p class="todo-quick-create-hint">Shift+Enter 换行 · Enter 发送</p>

              <div class="todo-quick-create-expanded-actions">
                <button
                  type="button"
                  class="todo-quick-create-collapse"
                  aria-label="收起输入框"
                  @click="collapseExpanded"
                >
                  <IconMinimize2 aria-hidden="true" />
                  <span>收起</span>
                </button>

                <button type="submit" :disabled="!canSubmit" aria-label="快速创建">
                  <IconSendHorizontal aria-hidden="true" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.todo-quick-create-root {
  flex: 0 0 auto;
  min-width: 0;
}

.todo-quick-create-bar {
  flex: 0 0 auto;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.todo-quick-create-bar.is-expanded-source {
  visibility: hidden;
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

.todo-quick-create-input-wrap {
  position: relative;
  min-width: 0;
  padding-right: 36px;
}

.todo-quick-create-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  resize: none;
}

.todo-quick-create-input.is-compact {
  display: block;
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  padding: 6px 10px;
  overflow: hidden;
  white-space: nowrap;
  line-height: 20px;
}

.todo-quick-create-bar.is-detail .todo-quick-create-input.is-compact {
  height: 34px;
  min-height: 34px;
  max-height: 34px;
  padding-top: 7px;
  padding-bottom: 7px;
}

.todo-quick-create-bar.is-simple .todo-quick-create-input.is-compact {
  font-size: 13px;
  color: #26334f;
}

.todo-quick-create-bar.is-simple .todo-quick-create-input.is-compact::placeholder {
  color: #7f8da3;
}

.todo-quick-create-bar.is-detail .todo-quick-create-input.is-compact {
  font-size: 14px;
  color: #101936;
}

.todo-quick-create-bar.is-detail .todo-quick-create-input.is-compact::placeholder {
  color: #9aa8bb;
}

.todo-quick-create-expand {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 7px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: #ffffff;
  background: linear-gradient(180deg, #84b8ff 0%, #6aa5ff 100%);
  box-shadow: 0 4px 10px -6px rgba(67, 139, 255, 0.45);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.todo-quick-create-input-wrap:focus-within .todo-quick-create-expand,
.todo-quick-create-input-wrap:hover .todo-quick-create-expand {
  opacity: 1;
  pointer-events: auto;
}

.todo-quick-create-expand:hover:not(:disabled) {
  background: linear-gradient(180deg, #96c4ff 0%, #7eb4ff 100%);
  box-shadow: 0 6px 12px -6px rgba(67, 139, 255, 0.55);
}

.todo-quick-create-expand:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.todo-quick-create-expand svg {
  width: 13px;
  height: 13px;
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

.todo-quick-create-bar.is-simple .todo-quick-create-full,
.todo-quick-create-expanded.is-simple .todo-quick-create-full {
  height: 32px;
  padding: 0 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  color: #2f6fe8;
  font-size: 12px;
  font-weight: 800;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.todo-quick-create-bar.is-simple .todo-quick-create-full:hover,
.todo-quick-create-expanded.is-simple .todo-quick-create-full:hover {
  background: rgba(255, 255, 255, 0.92);
  transform: translateY(-1px);
}

.todo-quick-create-bar.is-detail .todo-quick-create-full,
.todo-quick-create-expanded.is-detail .todo-quick-create-full {
  height: 34px;
  padding: 0 10px;
  border-radius: 11px;
  color: #2f72ed;
  background: rgba(52, 120, 246, 0.09);
  font-size: 12px;
  font-weight: 800;
}

.todo-quick-create-bar.is-detail .todo-quick-create-full:hover,
.todo-quick-create-expanded.is-detail .todo-quick-create-full:hover {
  background: rgba(52, 120, 246, 0.14);
}

.todo-quick-create-full svg {
  width: 14px;
  height: 14px;
  stroke-width: 2.5px;
}

.todo-quick-create-bar button[type='submit'],
.todo-quick-create-expanded button[type='submit'] {
  border: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: opacity 0.18s ease;
}

.todo-quick-create-bar.is-simple button[type='submit'],
.todo-quick-create-expanded.is-simple button[type='submit'] {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(180deg, #5a9bff 0%, #438bff 100%);
  color: #ffffff;
  box-shadow: 0 8px 18px -12px rgba(67, 139, 255, 0.88);
}

.todo-quick-create-bar.is-simple button[type='submit']:hover:not(:disabled),
.todo-quick-create-expanded.is-simple button[type='submit']:hover:not(:disabled) {
  background: linear-gradient(180deg, #6aa5ff 0%, #4f93ff 100%);
}

.todo-quick-create-bar.is-detail button[type='submit'],
.todo-quick-create-expanded.is-detail button[type='submit'] {
  width: 39px;
  height: 39px;
  border-radius: 13px;
  background: linear-gradient(135deg, #2f72ed, #4d91ff);
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(52, 120, 246, 0.23);
}

.todo-quick-create-bar button[type='submit']:disabled,
.todo-quick-create-expanded button[type='submit']:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.todo-quick-create-bar button[type='submit'] svg,
.todo-quick-create-expanded button[type='submit'] svg {
  width: 16px;
  height: 16px;
}

.todo-quick-create-bar.is-detail button[type='submit'] svg,
.todo-quick-create-expanded.is-detail button[type='submit'] svg {
  width: 18px;
  height: 18px;
}

.todo-quick-create-overlay {
  position: fixed;
  z-index: 120;
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: auto;
}

.todo-quick-create-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.todo-quick-create-expanded {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 188px;
  border-radius: 17px;
  overflow: hidden;
  transform-origin: bottom center;
  z-index: 1;
}

.todo-quick-create-expanded.is-simple {
  border: 1px solid rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.92);
  box-shadow:
    0 0 0 1px rgba(214, 225, 238, 0.42),
    0 8px 20px rgba(15, 23, 42, 0.06),
    0 20px 44px rgba(15, 23, 42, 0.1),
    0 36px 72px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(20px) saturate(1.12);
  -webkit-backdrop-filter: blur(20px) saturate(1.12);
}

.todo-quick-create-expanded.is-simple.is-embedded {
  border-color: rgba(214, 225, 238, 0.92);
  background: rgba(255, 255, 255, 0.96);
}

.todo-quick-create-expanded.is-detail.is-detail-card {
  background: var(--content-card-bg, rgba(255, 255, 255, 0.96));
  border: 1px solid var(--content-card-border, rgba(214, 225, 238, 0.9));
  box-shadow:
    0 0 0 1px rgba(214, 225, 238, 0.42),
    0 8px 20px rgba(15, 23, 42, 0.06),
    0 20px 44px rgba(15, 23, 42, 0.1),
    0 36px 72px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.52);
  backdrop-filter: var(--content-card-blur, blur(20px) saturate(1.14));
  -webkit-backdrop-filter: var(--content-card-blur, blur(20px) saturate(1.14));
}

.todo-quick-create-expanded-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 14px 14px 8px;
}

.todo-quick-create-input.is-expanded {
  display: block;
  width: 100%;
  min-height: 128px;
  max-height: none;
  padding: 0;
  overflow-y: hidden;
  line-height: 1.68;
  font-size: 15px;
  color: #101936;
}

.todo-quick-create-expanded.is-simple .todo-quick-create-input.is-expanded {
  color: #26334f;
}

.todo-quick-create-input.is-expanded::placeholder {
  color: #9aa8bb;
}

.todo-quick-create-expanded-footer {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 10px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
}

.todo-quick-create-hint {
  margin: 0;
  min-width: 0;
  text-align: center;
  font-size: 11px;
  color: #8a97ab;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.todo-quick-create-expanded-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.todo-quick-create-collapse {
  border: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.12);
  color: #5f6f86;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.todo-quick-create-collapse:hover {
  background: rgba(148, 163, 184, 0.2);
  color: #334155;
}

.todo-quick-create-collapse svg {
  width: 14px;
  height: 14px;
}

.todo-quick-create-expand-enter-active,
.todo-quick-create-expand-leave-active {
  transition: opacity 0.2s ease;
}

.todo-quick-create-expand-enter-active .todo-quick-create-expanded,
.todo-quick-create-expand-leave-active .todo-quick-create-expanded {
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s ease;
}

.todo-quick-create-expand-enter-from,
.todo-quick-create-expand-leave-to {
  opacity: 0;
}

.todo-quick-create-expand-enter-from .todo-quick-create-expanded,
.todo-quick-create-expand-leave-to .todo-quick-create-expanded {
  transform: scaleY(0.72);
  opacity: 0.88;
}
</style>
