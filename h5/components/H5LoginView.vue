<script setup lang="ts">
import { computed, ref } from 'vue'

defineProps<{
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{
  submit: [payload: { username: string; password: string }]
}>()

const username = ref('')
const password = ref('')

const dayNum = computed(() => String(new Date().getDate()).padStart(2, '0'))
const monthLabel = computed(() => `${new Date().getMonth() + 1}月`)
const weekdayLabel = computed(() => {
  const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return labels[new Date().getDay()] ?? ''
})

function handleSubmit() {
  emit('submit', {
    username: username.value.trim(),
    password: password.value,
  })
}
</script>

<template>
  <div class="st-app st-app--auth">
    <section class="st-auth-hero">
      <p class="st-auth-hero__brand">Smart Todo</p>
      <p class="st-auth-hero__day">{{ dayNum }}</p>
      <p class="st-auth-hero__meta">{{ monthLabel }} · {{ weekdayLabel }}</p>
      <h1 class="st-auth-hero__title">我的待办</h1>
    </section>

    <section class="st-auth-panel">
      <p class="st-auth-panel__lead">登录查看周安排与详情</p>

      <form class="st-form" @submit.prevent="handleSubmit">
        <label class="st-field">
          <span>账号</span>
          <input v-model="username" type="text" autocomplete="username" placeholder="请输入账号" />
        </label>
        <label class="st-field">
          <span>密码</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
          />
        </label>

        <p v-if="error" class="st-form__error">{{ error }}</p>

        <button
          type="submit"
          class="st-submit"
          :class="{ 'is-loading': loading }"
          :disabled="loading"
        >
          <span v-if="loading" class="st-button-spinner" aria-hidden="true" />
          <span>{{ loading ? '正在进入' : '进入' }}</span>
        </button>
      </form>

      <p class="st-auth-panel__hint">支持 App 通过 token 自动登录</p>
    </section>
  </div>
</template>
