import { ref } from 'vue'
import { loadCurrentUser, loginSmartTodo } from '@/modules/auth/services/auth.service'
import { isUnauthorizedRequestError } from '@/shared/request/request-error'
import { useUserStore } from '@/stores/user.store'
import { applyH5Token, bootstrapH5Auth } from '../auth'

export function useH5Auth() {
  const userStore = useUserStore()
  const isBootstrapping = ref(true)
  const isAuthenticating = ref(false)
  const authError = ref('')

  async function restoreSession() {
    bootstrapH5Auth()

    if (!userStore.isLoggedIn) {
      isBootstrapping.value = false
      return false
    }

    try {
      const profile = await loadCurrentUser({ silent: true })
      userStore.setProfile(profile)
      authError.value = ''
      return true
    } catch (error) {
      if (isUnauthorizedRequestError(error)) {
        userStore.logout()
      } else {
        authError.value = error instanceof Error ? error.message : '获取用户信息失败'
      }
      return false
    } finally {
      isBootstrapping.value = false
    }
  }

  async function login(username: string, password: string) {
    isAuthenticating.value = true
    authError.value = ''

    try {
      const token = await loginSmartTodo({ username, password })
      applyH5Token(token)
      const profile = await loadCurrentUser()
      userStore.setProfile(profile)
      return true
    } catch (error) {
      authError.value = error instanceof Error ? error.message : '登录失败'
      return false
    } finally {
      isAuthenticating.value = false
    }
  }

  function logout() {
    userStore.logout()
  }

  return {
    userStore,
    isBootstrapping,
    isAuthenticating,
    authError,
    restoreSession,
    login,
    logout,
  }
}
