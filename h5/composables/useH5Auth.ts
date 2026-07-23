import { ref } from 'vue'
import { loadCurrentUser, loginSmartTodoByPadAccount } from '@/modules/auth/services/auth.service'
import { isUnauthorizedRequestError } from '@/shared/request/request-error'
import { useUserStore } from '@/stores/user.store'
import { applyH5Token, bootstrapH5Auth } from '../auth'
import { getPadAccount } from '../pad-bridge'

export function useH5Auth() {
  const userStore = useUserStore()
  const isBootstrapping = ref(true)
  const authError = ref('')

  async function restoreSession() {
    isBootstrapping.value = true
    authError.value = ''
    bootstrapH5Auth()

    try {
      if (!userStore.isLoggedIn) {
        const loginName = await getPadAccount()
        const token = await loginSmartTodoByPadAccount(loginName)
        applyH5Token(token)
      }

      const profile = await loadCurrentUser({ silent: true })
      userStore.setProfile(profile)
      return true
    } catch (error) {
      if (isUnauthorizedRequestError(error)) {
        userStore.logout()
      }
      authError.value = error instanceof Error ? error.message : 'PAD 自动登录失败'
      return false
    } finally {
      isBootstrapping.value = false
    }
  }

  async function reauthenticate() {
    userStore.logout()
    return restoreSession()
  }

  return {
    userStore,
    isBootstrapping,
    authError,
    restoreSession,
    reauthenticate,
  }
}
