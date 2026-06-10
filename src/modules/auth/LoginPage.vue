<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconArrowRight from '~icons/lucide/arrow-right'
import IconEye from '~icons/lucide/eye'
import IconEyeOff from '~icons/lucide/eye-off'
import IconLockKeyhole from '~icons/lucide/lock-keyhole'
import IconScanLine from '~icons/lucide/scan-line'
import IconSparkles from '~icons/lucide/sparkles'
import IconUserRound from '~icons/lucide/user-round'
import campusImage from '@/assets/modelone.png'
import logoDarkImage from '@/assets/logoDark1.png'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { routeConfig } from '@/config/route.config'
import { APP_TITLE } from '@/shared/constants/app'
import { useUserStore } from '@/stores/user.store'
import { loadCurrentUser, loginSmartTodo } from '@/modules/home/dashboard/todo.service'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const form = reactive({
  username: import.meta.env.VITE_APP_TODO_USERNAME || '',
  password: import.meta.env.VITE_APP_TODO_PASSWORD || '',
})
const isPasswordVisible = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')

const signalItems = [
  { label: '需求识别', value: '08:45' },
  { label: '任务拆解', value: '09:20' },
  { label: '日程锁定', value: '10:10' },
  { label: 'AI 跟进', value: '14:00' },
]

const orbitItems = ['待办', '日程', '知识库', '会议纪要']
const heroDescription = '智能待办、日程日历和 AI 扩展，一处进入。'

const redirectTarget = computed(() => {
  const redirect = Array.isArray(route.query.redirect)
    ? route.query.redirect[0]
    : route.query.redirect

  return redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : routeConfig.defaultRoute
})

const canSubmit = computed(
  () => Boolean(form.username.trim()) && Boolean(form.password) && !isLoading.value,
)

async function submitLogin() {
  errorMessage.value = ''

  if (!form.username.trim() || !form.password) {
    errorMessage.value = '请输入账号和密码'
    return
  }

  isLoading.value = true

  try {
    const token = await loginSmartTodo({
      username: form.username.trim(),
      password: form.password,
    })
    userStore.setToken(token)

    const profile = await loadCurrentUser()
    userStore.setProfile(profile)

    await router.replace(redirectTarget.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后再试'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <main class="login-page" aria-label="登录">
    <section class="visual-plane" aria-label="工作台预览">
      <img class="campus-image" :src="campusImage" alt="" />
      <div class="visual-overlay"></div>

      <header class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">
          <img :src="logoDarkImage" alt="" />
        </span>
        <span>华力企业级 AI 平台</span>
      </header>

      <div class="hero-copy">
        <span class="eyebrow">Smart Todo Command</span>
        <h1>{{ APP_TITLE }}</h1>
        <p>{{ heroDescription }}</p>
      </div>

      <div class="mission-map" aria-hidden="true">
        <span class="scan-line"></span>
        <span class="map-pin pin-one">今天</span>
        <span class="map-pin pin-two">协同</span>
        <span class="map-pin pin-three">完成</span>
        <span
          v-for="(item, index) in orbitItems"
          :key="item"
          class="orbit-tag"
          :style="{
            '--x': `${19 + index * 15}%`,
            '--y': `${12 + (index % 2) * 16}%`,
            '--delay': `${index * -0.45}s`,
          }"
        >
          {{ item }}
        </span>
      </div>

      <div class="signal-strip" aria-label="今日节奏">
        <span v-for="item in signalItems" :key="item.label">
          <strong>{{ item.value }}</strong>
          {{ item.label }}
        </span>
      </div>
    </section>

    <section class="login-panel" aria-labelledby="login-title">
      <div class="panel-head">
        <span class="panel-icon" aria-hidden="true">
          <IconScanLine />
        </span>
        <div>
          <p>账号入口</p>
          <h2 id="login-title">登录工作台</h2>
        </div>
      </div>

      <form class="login-form" @submit.prevent="submitLogin">
        <label class="field-group">
          <span>账号</span>
          <span class="field-shell">
            <IconUserRound aria-hidden="true" />
            <Input
              v-model="form.username"
              name="username"
              type="text"
              autocomplete="username"
              placeholder="输入账号"
              :disabled="isLoading"
            />
          </span>
        </label>

        <label class="field-group">
          <span>密码</span>
          <span class="field-shell">
            <IconLockKeyhole aria-hidden="true" />
            <Input
              v-model="form.password"
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

        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

        <Button class="submit-button" type="submit" :disabled="!canSubmit">
          <span>{{ isLoading ? '正在连接' : '进入工作台' }}</span>
          <IconSparkles v-if="isLoading" class="loading-spark" aria-hidden="true" />
          <IconArrowRight v-else aria-hidden="true" />
        </Button>
      </form>

      <footer class="panel-foot">
        <span></span>
        <p>接口：<strong>login</strong></p>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  width: 100vw;
  min-height: 100svh;
  background:
    linear-gradient(120deg, rgba(242, 247, 255, 0.96), rgba(239, 249, 246, 0.9)),
    #f4f7fb;
  color: #101828;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 432px);
  overflow: hidden;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

.visual-plane {
  position: relative;
  min-height: 100svh;
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
  transform: scale(1.06);
  animation: image-drift 12s ease-in-out infinite alternate;
}

.visual-overlay {
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    linear-gradient(90deg, rgba(248, 251, 255, 0.98) 0%, rgba(248, 251, 255, 0.84) 42%, rgba(248, 251, 255, 0.26) 100%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(77, 124, 254, 0.14));
}

.visual-plane::after {
  position: absolute;
  inset: 36px;
  z-index: -1;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 8px;
  pointer-events: none;
  content: '';
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
  letter-spacing: 0;
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
}

.brand-mark img {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.hero-copy {
  position: relative;
  z-index: 2;
  max-width: 620px;
  padding-bottom: min(13vh, 118px);
  animation: rise-in 0.58s 0.08s ease-out both;
}

.eyebrow {
  color: #2563eb;
  font-size: 13px;
  font-weight: 950;
  text-transform: uppercase;
}

.hero-copy h1 {
  max-width: 590px;
  margin: 18px 0 18px;
  color: #0f172a;
  font-size: clamp(52px, 6.4vw, 92px);
  font-weight: 950;
  line-height: 0.94;
  letter-spacing: 0;
}

.hero-copy p {
  max-width: 560px;
  margin: 0;
  color: #475569;
  font-size: 18px;
  line-height: 1.7;
  font-weight: 700;
}

.mission-map {
  position: absolute;
  z-index: 1;
  right: clamp(20px, 3vw, 46px);
  bottom: 58px;
  width: min(34vw, 390px);
  aspect-ratio: 1.42;
  pointer-events: none;
}

.mission-map::before {
  position: absolute;
  inset: 16% 8%;
  border: 1px solid rgba(37, 99, 235, 0.22);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(37, 99, 235, 0.13) 1px, transparent 1px),
    linear-gradient(180deg, rgba(16, 185, 129, 0.12) 1px, transparent 1px);
  background-size: 46px 46px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.62);
  content: '';
  transform: skewY(-4deg);
}

.scan-line {
  position: absolute;
  left: 12%;
  right: 12%;
  top: 27%;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(37, 99, 235, 0.9), transparent);
  animation: scan-pass 3.4s ease-in-out infinite;
}

.map-pin,
.orbit-tag {
  position: absolute;
  min-width: 54px;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #0f172a;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 950;
  box-shadow: 0 16px 34px -28px rgba(15, 23, 42, 0.46);
  backdrop-filter: blur(12px);
}

.map-pin::before {
  width: 7px;
  height: 7px;
  margin-right: 6px;
  border-radius: 999px;
  background: #10b981;
  content: '';
}

.pin-one {
  left: 17%;
  top: 33%;
}

.pin-two {
  right: 23%;
  top: 45%;
}

.pin-three {
  left: 44%;
  bottom: 20%;
}

.orbit-tag {
  left: var(--x);
  bottom: var(--y);
  border-color: rgba(37, 99, 235, 0.18);
  color: #2563eb;
  animation: tag-float 4s ease-in-out infinite;
  animation-delay: var(--delay);
}

.signal-strip {
  position: relative;
  z-index: 2;
  width: min(760px, 100%);
  border-top: 1px solid rgba(37, 99, 235, 0.16);
  padding-top: 18px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  animation: rise-in 0.58s 0.18s ease-out both;
}

.signal-strip span {
  min-width: 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.3;
}

.signal-strip strong {
  display: block;
  margin-bottom: 5px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 950;
}

.login-panel {
  position: relative;
  min-height: 100svh;
  border-left: 1px solid rgba(203, 213, 225, 0.68);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: -30px 0 72px -60px rgba(15, 23, 42, 0.7);
  padding: clamp(30px, 5vw, 58px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  backdrop-filter: blur(18px);
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.panel-icon {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  background: #0f172a;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16px 34px -24px rgba(15, 23, 42, 0.78);
}

.panel-icon svg {
  width: 21px;
  height: 21px;
}

.panel-head p,
.panel-head h2 {
  margin: 0;
}

.panel-head p {
  color: #2563eb;
  font-size: 12px;
  font-weight: 950;
}

.panel-head h2 {
  margin-top: 5px;
  color: #101828;
  font-size: 30px;
  font-weight: 950;
  letter-spacing: 0;
}

.login-form {
  margin-top: 42px;
  display: grid;
  gap: 22px;
}

.field-group {
  display: grid;
  gap: 9px;
  color: #334155;
  font-size: 13px;
  font-weight: 900;
}

.field-shell {
  height: 54px;
  border: 1px solid rgba(148, 163, 184, 0.38);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.82);
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 14px;
  color: #64748b;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.field-shell:focus-within {
  border-color: rgba(37, 99, 235, 0.64);
  background: #ffffff;
  box-shadow: 0 16px 30px -26px rgba(37, 99, 235, 0.9);
  transform: translateY(-1px);
}

.field-shell svg {
  width: 19px;
  height: 19px;
  flex: 0 0 auto;
}

.field-shell input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #0f172a;
  font: inherit;
  font-size: 15px;
  font-weight: 800;
}

.field-shell input::placeholder {
  color: #94a3b8;
}

.field-shell input:disabled {
  cursor: not-allowed;
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
}

.ghost-icon:hover:not(:disabled),
.ghost-icon:focus-visible {
  background: rgba(226, 232, 240, 0.68);
  color: #0f172a;
}

.form-error {
  min-height: 20px;
  margin: -8px 0 0;
  color: #dc2626;
  font-size: 13px;
  font-weight: 850;
}

.submit-button {
  height: 56px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #2563eb, #0f766e);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font: inherit;
  font-size: 15px;
  font-weight: 950;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 20px 38px -26px rgba(15, 23, 42, 0.82);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    filter 0.18s ease;
}

.submit-button:hover:not(:disabled),
.submit-button:focus-visible {
  transform: translateY(-2px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 24px 44px -24px rgba(15, 23, 42, 0.86);
}

.submit-button:disabled {
  cursor: not-allowed;
  filter: grayscale(0.38);
  opacity: 0.62;
}

.submit-button svg {
  width: 19px;
  height: 19px;
}

.loading-spark {
  animation: spark-spin 1s linear infinite;
}

.panel-foot {
  margin-top: 34px;
  border-top: 1px solid rgba(203, 213, 225, 0.72);
  padding-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel-foot span {
  width: 68px;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, #2563eb, #10b981);
}

.panel-foot p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
}

.panel-foot strong {
  color: #0f172a;
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

@keyframes image-drift {
  from {
    transform: scale(1.06) translate3d(-1.5%, 0, 0);
  }
  to {
    transform: scale(1.1) translate3d(1.5%, -1%, 0);
  }
}

@keyframes scan-pass {
  0%,
  100% {
    opacity: 0.2;
    transform: translateY(0);
  }
  42% {
    opacity: 1;
    transform: translateY(132px);
  }
}

@keyframes tag-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes spark-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1080px) {
  .login-page {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .visual-plane {
    min-height: 48svh;
    padding: 32px 24px;
  }

  .hero-copy {
    max-width: 560px;
    padding: 54px 0 24px;
  }

  .hero-copy h1 {
    font-size: clamp(42px, 10vw, 70px);
  }

  .mission-map {
    right: 18px;
    bottom: 70px;
    width: min(56vw, 420px);
    opacity: 0.76;
  }

  .login-panel {
    min-height: auto;
    border-top: 1px solid rgba(203, 213, 225, 0.72);
    border-left: 0;
    padding: 36px 24px 42px;
  }
}

@media (max-width: 680px) {
  .visual-plane {
    min-height: 42svh;
    padding: 24px 18px;
  }

  .visual-plane::after,
  .mission-map {
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

  .login-panel {
    padding: 30px 18px 36px;
  }

  .panel-head h2 {
    font-size: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .campus-image,
  .scan-line,
  .orbit-tag,
  .loading-spark,
  .brand-lockup,
  .hero-copy,
  .signal-strip {
    animation: none;
  }
}
</style>
