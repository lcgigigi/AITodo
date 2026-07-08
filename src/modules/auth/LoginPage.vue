<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconArrowRight from '~icons/lucide/arrow-right'
import IconEye from '~icons/lucide/eye'
import IconEyeOff from '~icons/lucide/eye-off'
import IconLockKeyhole from '~icons/lucide/lock-keyhole'
import IconUserRound from '~icons/lucide/user-round'
import campusImage from '@/assets/morning.png'
import logoDarkImage from '@/assets/logoDark1.png'
import { Button } from '@/components/ui/button'
import { routeConfig } from '@/config/route.config'
import { APP_TITLE } from '@/shared/constants/app'
import { useUserStore } from '@/stores/user.store'
import { loadCurrentUser, loginSmartTodo } from '@/modules/home/dashboard/todo.service'
import { getDesktopAuthRequest } from './desktop-auth'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const loginCardRef = ref<HTMLElement | null>(null)

const form = reactive({
  username: import.meta.env.VITE_APP_TODO_USERNAME || '',
  password: import.meta.env.VITE_APP_TODO_PASSWORD || '',
})
const isPasswordVisible = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const isExiting = ref(false)
const shakeForm = ref(false)
const activeSignal = ref(0)

const mouse = reactive({ x: 0.5, y: 0.5 })
const cardTilt = reactive({ rx: 0 })

const signalItems = [
  { label: '需求识别', value: '08:45' },
  { label: '任务拆解', value: '09:20' },
  { label: '日程锁定', value: '10:10' },
  { label: 'AI 跟进', value: '14:00' },
]

const heroDescription = '智能待办、日程日历和 AI 扩展，一处进入。'

let signalTimer: ReturnType<typeof setInterval> | null = null
let shakeTimer: ReturnType<typeof setTimeout> | null = null

const redirectTarget = computed(() => {
  const redirect = Array.isArray(route.query.redirect)
    ? route.query.redirect[0]
    : route.query.redirect

  return redirect?.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : routeConfig.defaultRoute
})

const canSubmit = computed(
  () => Boolean(form.username.trim()) && Boolean(form.password) && !isLoading.value,
)

const pageStyle = computed(() => ({
  '--mx': `${(mouse.x - 0.5) * 28}px`,
  '--my': `${(mouse.y - 0.5) * 18}px`,
  '--glow-x': `${mouse.x * 100}%`,
  '--glow-y': `${mouse.y * 100}%`,
}))

const cardTiltStyle = computed(() => ({
  transform: `rotateX(${cardTilt.rx}deg)`,
}))

function handlePointerMove(event: PointerEvent) {
  mouse.x = event.clientX / window.innerWidth
  mouse.y = event.clientY / window.innerHeight

  const card = loginCardRef.value
  if (!card) return

  const rect = card.getBoundingClientRect()
  const localY = (event.clientY - rect.top) / rect.height - 0.5
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom

  cardTilt.rx = inside ? -localY * 8 : -localY * 2
}

function triggerShake() {
  shakeForm.value = false
  if (shakeTimer) clearTimeout(shakeTimer)
  requestAnimationFrame(() => {
    shakeForm.value = true
    shakeTimer = setTimeout(() => {
      shakeForm.value = false
    }, 520)
  })
}

function lockPageScroll() {
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
}

function unlockPageScroll() {
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
}

async function enterWebWorkbench() {
  isExiting.value = true
  lockPageScroll()
  await new Promise((resolve) => setTimeout(resolve, 480))
  await router.replace(redirectTarget.value)
}

async function submitLogin() {
  errorMessage.value = ''

  if (!form.username.trim() || !form.password) {
    errorMessage.value = '请输入账号和密码'
    triggerShake()
    return
  }

  isLoading.value = true

  try {
    const token = await loginSmartTodo({
      username: form.username.trim(),
      password: form.password,
    })
    userStore.setToken(token)

    const profile = await loadCurrentUser({ silent: true })
    userStore.setProfile(profile)

    const desktopAuthRequest = getDesktopAuthRequest(route.query)
    if (desktopAuthRequest) {
      const desktopClient = Array.isArray(route.query.desktopClient)
        ? route.query.desktopClient[0]
        : route.query.desktopClient
      const desktopUserId = Array.isArray(route.query.desktopUserId)
        ? route.query.desktopUserId[0]
        : route.query.desktopUserId

      await router.replace({
        path: routeConfig.defaultRoute,
        query: {
          from: 'desktop',
          desktopCallback: desktopAuthRequest.callback,
          state: desktopAuthRequest.state,
          ...(desktopClient ? { desktopClient } : {}),
          ...(desktopUserId ? { desktopUserId } : {}),
        },
      })
      return
    }

    await enterWebWorkbench()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后再试'
    triggerShake()
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  signalTimer = setInterval(() => {
    activeSignal.value = (activeSignal.value + 1) % signalItems.length
  }, 2800)
})

onUnmounted(() => {
  window.removeEventListener('pointermove', handlePointerMove)
  unlockPageScroll()
  if (signalTimer) clearInterval(signalTimer)
  if (shakeTimer) clearTimeout(shakeTimer)
})
</script>

<template>
  <main
    class="login-page"
    :class="{ 'is-exiting': isExiting }"
    :style="pageStyle"
    aria-label="登录"
  >
    <section class="visual-plane" aria-label="工作台预览">
      <img class="campus-image" :src="campusImage" alt="" />
      <div class="visual-overlay"></div>

      <div class="ambient-orbs" aria-hidden="true">
        <span class="orb orb-one"></span>
        <span class="orb orb-two"></span>
        <span class="orb orb-three"></span>
      </div>

      <header class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">
          <img :src="logoDarkImage" alt="" />
        </span>
        <!-- <span>华力企业级 AI 平台</span> -->
      </header>

      <div class="hero-copy">
        <span class="eyebrow">
          <span class="eyebrow-text">Smart Todo Command</span>
          <span class="eyebrow-cursor" aria-hidden="true"></span>
        </span>
        <h1>
          <span class="title-gradient">{{ APP_TITLE }}</span>
        </h1>
        <p>{{ heroDescription }}</p>
      </div>

      <div class="signal-strip" aria-label="今日节奏">
        <span
          v-for="(item, index) in signalItems"
          :key="item.label"
          class="signal-item"
          :class="{ 'is-active': activeSignal === index }"
          :style="{ '--i': index }"
        >
          <strong>{{ item.value }}</strong>
          {{ item.label }}
          <span class="signal-progress" aria-hidden="true"></span>
        </span>
      </div>
    </section>

    <div class="login-float-shell">
      <div class="login-float-shadow" aria-hidden="true"></div>
      <section
        ref="loginCardRef"
        class="login-float-card"
        :style="cardTiltStyle"
        aria-label="登录表单"
      >
        <div class="panel-glow" aria-hidden="true"></div>
        <div class="card-edge" aria-hidden="true"></div>

        <form
          class="login-form"
          :class="{ 'is-shaking': shakeForm, 'is-loading': isLoading }"
          @submit.prevent="submitLogin"
        >
          <label class="field-group field-enter" style="--i: 0">
            <span>账号</span>
            <span class="field-shell">
              <IconUserRound class="field-icon" aria-hidden="true" />
              <input
                v-model="form.username"
                class="field-input"
                name="username"
                type="text"
                autocomplete="username"
                placeholder="输入账号"
                :disabled="isLoading"
              />
            </span>
          </label>

          <label class="field-group field-enter" style="--i: 1">
            <span>密码</span>
            <span class="field-shell">
              <IconLockKeyhole class="field-icon" aria-hidden="true" />
              <input
                v-model="form.password"
                class="field-input"
                name="password"
                :type="isPasswordVisible ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="输入密码"
                :disabled="isLoading"
              />
              <Button
                class="ghost-icon"
                type="button"
                :aria-label="isPasswordVisible ? '隐藏密码' : '显示密码'"
                :disabled="isLoading"
                @click="isPasswordVisible = !isPasswordVisible"
              >
                <IconEyeOff v-if="isPasswordVisible" />
                <IconEye v-else />
              </Button>
            </span>
          </label>

          <p v-if="errorMessage" class="form-error field-enter" style="--i: 2" role="alert">
            {{ errorMessage }}
          </p>

          <Button
            class="submit-button field-enter"
            style="--i: 3"
            type="submit"
            :disabled="!canSubmit"
          >
            <span class="submit-label">{{ isLoading ? '正在连接' : '进入工作台' }}</span>
            <span class="submit-icon" aria-hidden="true">
              <span v-if="isLoading" class="loading-ring"></span>
              <IconArrowRight v-else />
            </span>
            <span class="submit-shimmer" aria-hidden="true"></span>
          </Button>
        </form>
      </section>
    </div>
  </main>
</template>

<style scoped>
.login-page {
  --mx: 0px;
  --my: 0px;
  --glow-x: 50%;
  --glow-y: 50%;
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100svh;
  background: #eef3fb;
  color: #101828;
  overflow: hidden;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  transition:
    opacity 0.48s ease,
    transform 0.48s ease;
  transform-origin: center center;
}

.login-page.is-exiting {
  opacity: 0;
  transform: scale(1.012);
  overflow: hidden;
}

.visual-plane {
  position: relative;
  z-index: 1;
  min-height: 100svh;
  width: 100%;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px clamp(32px, 5vw, 78px);
}

.campus-image {
  position: absolute;
  inset: 0;
  z-index: -3;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transform: scale(1.06) translate3d(calc(var(--mx) * 0.35), calc(var(--my) * 0.35), 0);
  animation: image-drift 14s ease-in-out infinite alternate;
  transition: transform 0.35s ease-out;
  will-change: transform;
}

.visual-overlay {
  position: absolute;
  inset: 0;
  z-index: -2;
  background: linear-gradient(
      90deg,
      rgba(248, 251, 255, 0.96) 0%,
      rgba(248, 251, 255, 0.78) 38%,
      rgba(248, 251, 255, 0.42) 62%,
      rgba(248, 251, 255, 0.18) 100%
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(77, 124, 254, 0.1));
}

.ambient-orbs {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
}

.orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(48px);
  opacity: 0.55;
  animation: orb-drift 9s ease-in-out infinite alternate;
}

.orb-one {
  width: 220px;
  height: 220px;
  top: 18%;
  left: 12%;
  background: rgba(37, 99, 235, 0.22);
}

.orb-two {
  width: 180px;
  height: 180px;
  right: 22%;
  top: 42%;
  background: rgba(16, 185, 129, 0.18);
  animation-delay: -2.4s;
}

.orb-three {
  width: 140px;
  height: 140px;
  left: 38%;
  bottom: 22%;
  background: rgba(99, 102, 241, 0.16);
  animation-delay: -4.8s;
}

.visual-plane::after {
  position: absolute;
  inset: 36px;
  z-index: -1;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 8px;
  pointer-events: none;
  content: '';
  transform: translate3d(calc(var(--mx) * 0.15), calc(var(--my) * 0.15), 0);
  transition: transform 0.35s ease-out;
}

.brand-lockup {
  position: relative;
  z-index: 2;
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 12px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 900;
  animation: rise-in 0.48s ease-out both;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.74);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14px 38px -26px rgba(15, 23, 42, 0.54);
  overflow: hidden;
  transition:
    transform 0.28s ease,
    box-shadow 0.28s ease;
}

.brand-lockup:hover .brand-mark {
  transform: rotate(-4deg) scale(1.06);
  box-shadow: 0 18px 42px -24px rgba(37, 99, 235, 0.42);
}

.brand-mark img {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.hero-copy {
  position: relative;
  z-index: 2;
  max-width: min(620px, calc(100vw - 580px));
  padding-bottom: min(13vh, 118px);
  animation: rise-in 0.58s 0.08s ease-out both;
  transform: translate3d(calc(var(--mx) * 0.2), calc(var(--my) * 0.2), 0);
  transition: transform 0.35s ease-out;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 950;
  text-transform: uppercase;
}

.eyebrow-cursor {
  width: 2px;
  height: 14px;
  background: #2563eb;
  animation: cursor-blink 1.1s step-end infinite;
}

.hero-copy h1 {
  max-width: 590px;
  margin: 18px 0 18px;
  font-size: clamp(52px, 6.4vw, 92px);
  font-weight: 950;
  line-height: 0.94;
}

.title-gradient {
  background: linear-gradient(120deg, #0f172a 0%, #1e3a8a 45%, #0f766e 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: title-shimmer 6s ease-in-out infinite alternate;
}

.hero-copy p {
  max-width: 560px;
  margin: 0;
  color: #475569;
  font-size: 18px;
  line-height: 1.7;
  font-weight: 700;
}

.signal-strip {
  position: relative;
  z-index: 2;
  width: min(760px, calc(100vw - 580px));
  border-top: 1px solid rgba(37, 99, 235, 0.16);
  padding-top: 18px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  animation: rise-in 0.58s 0.18s ease-out both;
}

.login-float-shell {
  position: fixed;
  z-index: 20;
  right: clamp(24px, 4vw, 64px);
  top: 50%;
  width: min(520px, calc(100vw - 48px));
  perspective: 1200px;
  translate: 0 -50%;
  transform: rotateX(5deg);
  transform-origin: center center;
  animation:
    shell-rise 0.72s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both,
    shell-float 5.5s 0.82s ease-in-out infinite;
  pointer-events: none;
}

.login-float-shadow {
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: -28px;
  height: 36px;
  border-radius: 999px;
  background: radial-gradient(ellipse, rgba(15, 23, 42, 0.28), transparent 72%);
  filter: blur(10px);
  transform: rotateX(72deg);
  animation: shadow-pulse 5.5s ease-in-out infinite;
}

.login-float-card {
  position: relative;
  pointer-events: auto;
  padding: 42px 38px 38px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 26px;
  background: linear-gradient(155deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.78) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 22px 44px -14px rgba(15, 23, 42, 0.2),
    0 48px 96px -28px rgba(37, 99, 235, 0.32);
  backdrop-filter: blur(22px) saturate(1.2);
  overflow: hidden;
  transform-style: preserve-3d;
  transition:
    transform 0.28s ease-out,
    box-shadow 0.28s ease-out;
}

.login-float-card:hover {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 24px 48px -16px rgba(15, 23, 42, 0.22),
    0 52px 96px -24px rgba(37, 99, 235, 0.34);
}

.card-edge {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.08);
}

.card-edge::after {
  position: absolute;
  top: 0;
  left: 12%;
  right: 12%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.95), transparent);
  content: '';
}

.signal-item {
  position: relative;
  min-width: 0;
  padding: 10px 12px 12px;
  border-radius: 8px;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.3;
  overflow: hidden;
  transition:
    color 0.32s ease,
    background 0.32s ease,
    transform 0.32s ease;
}

.signal-item.is-active {
  color: #334155;
  background: rgba(255, 255, 255, 0.62);
  transform: translateY(-2px);
  box-shadow: 0 14px 28px -22px rgba(37, 99, 235, 0.38);
}

.signal-item strong {
  display: block;
  margin-bottom: 5px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 950;
  transition: color 0.32s ease;
}

.signal-item.is-active strong {
  color: #2563eb;
}

.signal-progress {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 0;
  height: 2px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  overflow: hidden;
}

.signal-progress::after {
  display: block;
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #10b981);
  content: '';
}

.signal-item.is-active .signal-progress::after {
  animation: signal-fill 2.8s linear forwards;
}

.panel-glow {
  position: absolute;
  inset: -50%;
  background: radial-gradient(
    circle at var(--glow-x) var(--glow-y),
    rgba(37, 99, 235, 0.16),
    transparent 40%
  );
  pointer-events: none;
}

.login-form {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 26px;
}

.login-form.is-shaking {
  animation: form-shake 0.48s ease;
}

.field-enter {
  animation: field-slide-in 0.55s calc(0.12s + var(--i, 0) * 0.08s) ease-out both;
}

.field-group {
  display: grid;
  gap: 10px;
  color: #334155;
  font-size: 14px;
  font-weight: 900;
}

.field-shell {
  height: 58px;
  border: 1px solid rgba(148, 163, 184, 0.38);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.82);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  color: #64748b;
  transition:
    border-color 0.22s ease,
    box-shadow 0.22s ease,
    background 0.22s ease,
    transform 0.22s ease;
}

.field-shell:focus-within {
  border-color: rgba(37, 99, 235, 0.64);
  background: #ffffff;
  box-shadow:
    0 0 0 3px rgba(37, 99, 235, 0.12),
    0 16px 30px -26px rgba(37, 99, 235, 0.9);
  transform: translateY(-2px);
}

.field-shell:focus-within .field-icon {
  color: #2563eb;
  transform: scale(1.08);
}

.field-icon {
  width: 19px;
  height: 19px;
  flex: 0 0 auto;
  transition:
    color 0.22s ease,
    transform 0.22s ease;
}

.field-input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #0f172a;
  font: inherit;
  font-size: 16px;
  font-weight: 800;
  box-shadow: none;
  appearance: none;
}

.field-input::placeholder {
  color: #94a3b8;
  transition: opacity 0.2s ease;
}

.field-shell:focus-within .field-input::placeholder {
  opacity: 0.55;
}

.field-input:disabled {
  cursor: not-allowed;
}

.field-input:-webkit-autofill,
.field-input:-webkit-autofill:hover,
.field-input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px rgba(248, 250, 252, 0.82) inset;
  -webkit-text-fill-color: #0f172a;
  caret-color: #0f172a;
  transition: background-color 9999s ease-out 0s;
}

.field-shell:focus-within .field-input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px #ffffff inset;
}

.ghost-icon {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

.ghost-icon:hover:not(:disabled),
.ghost-icon:focus-visible {
  background: rgba(226, 232, 240, 0.68);
  color: #0f172a;
  transform: scale(1.06);
}

.form-error {
  min-height: 20px;
  margin: -8px 0 0;
  color: #dc2626;
  font-size: 13px;
  font-weight: 850;
  animation: error-pop 0.32s ease-out;
}

.submit-button {
  position: relative;
  height: 60px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #2563eb, #0f766e);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font: inherit;
  font-size: 16px;
  font-weight: 950;
  cursor: pointer;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 20px 38px -26px rgba(15, 23, 42, 0.82);
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    filter 0.22s ease;
}

.submit-button:hover:not(:disabled),
.submit-button:focus-visible {
  transform: translateY(-3px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 26px 48px -22px rgba(37, 99, 235, 0.55);
}

.submit-button:hover:not(:disabled) .submit-icon {
  transform: translateX(4px);
}

.login-form.is-loading .submit-button {
  animation: submit-pulse 1.2s ease-in-out infinite;
}

.submit-button:disabled {
  cursor: not-allowed;
  filter: grayscale(0.38);
  opacity: 0.62;
}

.submit-icon {
  display: inline-flex;
  transition: transform 0.22s ease;
}

.submit-icon svg {
  width: 19px;
  height: 19px;
}

.submit-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 38%,
    rgba(255, 255, 255, 0.28) 50%,
    transparent 62%
  );
  transform: translateX(-120%);
  transition: transform 0.6s ease;
  pointer-events: none;
}

.submit-button:hover:not(:disabled) .submit-shimmer {
  transform: translateX(120%);
}

.loading-ring {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.32);
  border-top-color: #ffffff;
  border-radius: 999px;
  animation: ring-spin 0.75s linear infinite;
}

@keyframes ring-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes field-slide-in {
  from {
    opacity: 0;
    transform: translateX(22px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes image-drift {
  from {
    transform: scale(1.06) translate3d(calc(-1.5% + var(--mx) * 0.35), calc(var(--my) * 0.35), 0);
  }
  to {
    transform: scale(1.1)
      translate3d(calc(1.5% + var(--mx) * 0.35), calc(-1% + var(--my) * 0.35), 0);
  }
}

@keyframes orb-drift {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    transform: translate3d(18px, -14px, 0) scale(1.08);
  }
}

@keyframes cursor-blink {
  0%,
  45% {
    opacity: 1;
  }
  46%,
  100% {
    opacity: 0;
  }
}

@keyframes title-shimmer {
  from {
    background-position: 0% center;
  }
  to {
    background-position: 100% center;
  }
}

@keyframes signal-fill {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

@keyframes form-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20%,
  60% {
    transform: translateX(-6px);
  }
  40%,
  80% {
    transform: translateX(6px);
  }
}

@keyframes error-pop {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes submit-pulse {
  0%,
  100% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.22),
      0 20px 38px -26px rgba(15, 23, 42, 0.82);
  }
  50% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.22),
      0 24px 48px -20px rgba(37, 99, 235, 0.62);
  }
}

@keyframes shell-rise {
  from {
    opacity: 0;
    translate: 0 calc(-50% + 36px);
  }
  to {
    opacity: 1;
    translate: 0 -50%;
  }
}

@keyframes shell-float {
  0%,
  100% {
    translate: 0 calc(-50% - 4px);
  }
  50% {
    translate: 0 calc(-50% - 14px);
  }
}

@keyframes shadow-pulse {
  0%,
  100% {
    opacity: 0.72;
    transform: rotateX(72deg) scale(0.96);
  }
  50% {
    opacity: 0.95;
    transform: rotateX(72deg) scale(1.04);
  }
}

@media (max-width: 1080px) {
  .login-page:not(.is-exiting) {
    overflow: auto;
  }

  .visual-plane {
    min-height: 100svh;
    padding: 32px 24px 400px;
  }

  .hero-copy,
  .signal-strip {
    max-width: 100%;
    width: 100%;
  }

  .hero-copy {
    padding: 54px 0 24px;
  }

  .hero-copy h1 {
    font-size: clamp(42px, 10vw, 70px);
  }

  .login-float-shell {
    position: fixed;
    right: 50%;
    top: auto;
    bottom: 28px;
    width: min(480px, calc(100vw - 32px));
    translate: 50% 0;
    transform: rotateX(3deg);
    animation: shell-rise-mobile 0.72s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .login-float-shadow {
    bottom: -20px;
  }
}

@media (max-width: 680px) {
  .visual-plane {
    min-height: 100svh;
    padding: 24px 18px 380px;
  }

  .visual-plane::after,
  .ambient-orbs {
    display: none;
  }

  .brand-lockup {
    font-size: 13px;
  }

  .brand-mark {
    width: 38px;
    height: 38px;
  }

  .hero-copy {
    padding: 42px 0 10px;
  }

  .hero-copy h1 {
    margin: 12px 0;
    font-size: 42px;
    line-height: 1;
  }

  .hero-copy p {
    font-size: 15px;
    line-height: 1.55;
  }

  .signal-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .login-float-shell {
    bottom: 18px;
    width: calc(100vw - 28px);
  }

  .login-float-card {
    padding: 34px 28px 30px;
    border-radius: 22px;
  }
}

@keyframes shell-rise-mobile {
  from {
    opacity: 0;
    translate: 50% 24px;
  }
  to {
    opacity: 1;
    translate: 50% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .campus-image,
  .orb,
  .eyebrow-cursor,
  .title-gradient,
  .signal-progress::after,
  .loading-ring,
  .brand-lockup,
  .hero-copy,
  .signal-strip,
  .field-enter,
  .login-page,
  .submit-button,
  .login-float-shell,
  .login-float-shadow {
    animation: none;
    transition: none;
  }

  .campus-image,
  .hero-copy,
  .visual-plane::after,
  .login-float-card {
    transform: none;
  }

  .login-float-shell {
    translate: 0 -50%;
    transform: rotateX(5deg);
  }
}
</style>
