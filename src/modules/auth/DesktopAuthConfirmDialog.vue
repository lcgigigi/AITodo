<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { routeConfig } from '@/config/route.config'
import { useUserStore } from '@/stores/user.store'
import { loadCurrentUser } from '@/modules/auth/services/auth.service'
import {
  buildDesktopAuthCallbackUrl,
  getDesktopAuthRequest,
  getDesktopLaunchRequest,
  isDesktopUserMismatch,
} from './desktop-auth'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const dialogMode = ref<'auth' | 'mismatch' | null>(null)
const isLoadingProfile = ref(false)

const desktopAuthRequest = computed(() => getDesktopAuthRequest(route.query))
const desktopLaunchRequest = computed(() => getDesktopLaunchRequest(route.query))
const displayName = computed(() => userStore.profile?.name || '当前账号')
const desktopUserId = computed(() => desktopLaunchRequest.value?.userId || '')

function clearDesktopIntegrationQuery() {
  const query = { ...route.query }
  delete query.from
  delete query.desktopClient
  delete query.desktopUserId
  delete query.desktopCallback
  delete query.state
  delete query.desktopTodoText
  delete query.desktopTodoId
  delete query.desktopMessageId
  delete query.desktopBizType
  delete query.taskId

  return router.replace({
    path: route.path,
    query,
    hash: route.hash,
  })
}

async function ensureProfile() {
  if (!userStore.token) return false
  if (userStore.profile?.id) return true

  isLoadingProfile.value = true
  try {
    const profile = await loadCurrentUser({ silent: true })
    userStore.setProfile(profile)
    return Boolean(profile.id)
  } catch {
    return false
  } finally {
    isLoadingProfile.value = false
  }
}

async function syncDialogState() {
  if ((!desktopAuthRequest.value && !desktopLaunchRequest.value) || !userStore.isLoggedIn) {
    dialogMode.value = null
    return
  }

  const hasProfile = await ensureProfile()
  if (!hasProfile) {
    dialogMode.value = null
    return
  }

  if (isDesktopUserMismatch(route.query, userStore.profile?.id)) {
    dialogMode.value = 'mismatch'
    return
  }

  dialogMode.value = desktopAuthRequest.value ? 'auth' : null
}

async function confirmDesktopAuthLogin() {
  const request = desktopAuthRequest.value
  const profile = userStore.profile
  const token = userStore.token

  if (!request || !profile?.id || !token || isDesktopUserMismatch(route.query, profile.id)) {
    dialogMode.value = null
    return
  }

  const callbackUrl = buildDesktopAuthCallbackUrl({
    callback: request.callback,
    state: request.state,
    token,
    profile,
  })

  dialogMode.value = null
  await clearDesktopIntegrationQuery()
  window.location.href = callbackUrl
}

async function closeDesktopDialog() {
  dialogMode.value = null
  await clearDesktopIntegrationQuery()

  if (route.path === routeConfig.loginRoute && userStore.isLoggedIn) {
    await router.replace(routeConfig.defaultRoute)
  }
}

watch(
  () => [route.fullPath, userStore.token, userStore.profile?.id],
  () => {
    void syncDialogState()
  },
  { immediate: true },
)
</script>

<template>
  <Transition name="desktop-auth-dialog">
    <div
      v-if="dialogMode"
      class="desktop-auth-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desktop-auth-title"
    >
      <section class="desktop-auth-card">
        <p class="desktop-auth-kicker">Desktop Login</p>
        <h2 id="desktop-auth-title">
          {{ dialogMode === 'mismatch' ? '桌面助手账号不一致' : '确认登录桌面吉祥物' }}
        </h2>
        <p v-if="dialogMode === 'mismatch'" class="desktop-auth-desc">
          当前 Web 账号与桌面助手登录账号不一致，请切换 Web 账号或重新登录桌面助手。
        </p>
        <p v-else class="desktop-auth-desc">
          将使用 {{ displayName }} 的 Web 登录状态连接桌面消息提醒。
        </p>
        <p v-if="dialogMode === 'mismatch' && desktopUserId" class="desktop-auth-meta">
          桌面用户：{{ desktopUserId }}
        </p>
        <div class="desktop-auth-actions">
          <Button class="desktop-auth-secondary" type="button" @click="closeDesktopDialog">
            {{ dialogMode === 'mismatch' ? '知道了' : '取消' }}
          </Button>
          <Button
            v-if="dialogMode === 'auth'"
            class="desktop-auth-primary"
            type="button"
            :disabled="isLoadingProfile"
            @click="confirmDesktopAuthLogin"
          >
            {{ isLoadingProfile ? '确认中' : '确认登录' }}
          </Button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.desktop-auth-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(10px);
}

.desktop-auth-card {
  width: min(420px, 100%);
  padding: 28px;
  border: 1px solid rgba(255, 255, 255, 0.86);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.98),
    0 30px 70px -34px rgba(15, 23, 42, 0.72);
}

.desktop-auth-kicker {
  margin: 0 0 8px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0;
  text-transform: uppercase;
}

.desktop-auth-card h2 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.25;
  font-weight: 950;
}

.desktop-auth-desc {
  margin: 12px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.7;
  font-weight: 700;
}

.desktop-auth-meta {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.5;
}

.desktop-auth-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.desktop-auth-secondary,
.desktop-auth-primary {
  min-width: 96px;
  height: 40px;
  border-radius: 8px;
  font-weight: 900;
}

.desktop-auth-secondary {
  border: 1px solid rgba(148, 163, 184, 0.36);
  background: rgba(248, 250, 252, 0.92);
  color: #334155;
}

.desktop-auth-primary {
  border: 0;
  background: linear-gradient(135deg, #2563eb, #0f766e);
  color: #fff;
  box-shadow: 0 16px 32px -20px rgba(37, 99, 235, 0.72);
}

.desktop-auth-dialog-enter-active,
.desktop-auth-dialog-leave-active {
  transition: opacity 0.18s ease;
}

.desktop-auth-dialog-enter-from,
.desktop-auth-dialog-leave-to {
  opacity: 0;
}
</style>
