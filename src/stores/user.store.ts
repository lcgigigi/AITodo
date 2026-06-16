import { defineStore } from 'pinia'
import { storage } from '@/shared/utils/storage'

const TOKEN_STORAGE_KEY = 'ai-workbench:user-token'
const PROFILE_STORAGE_KEY = 'ai-workbench:user-profile'

export interface UserProfile {
  id: string
  name: string
  avatar?: string
  department?: string
  role?: 'leader' | 'employee'
  leaderId?: string
  teamMemberIds?: string[]
  roles?: string[]
  permissions?: string[]
  isSecurityPassword?: 'yes' | 'no'
  checkEmail?: string | null
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: storage.get(TOKEN_STORAGE_KEY, ''),
    profile: storage.get<UserProfile | null>(PROFILE_STORAGE_KEY, null),
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token),
  },
  actions: {
    setToken(token: string) {
      this.token = token
      storage.set(TOKEN_STORAGE_KEY, token)
    },
    setProfile(profile: UserProfile) {
      this.profile = profile
      storage.set(PROFILE_STORAGE_KEY, profile)
    },
    setCheckEmail(checkEmail: string) {
      if (!this.profile) return

      this.profile = {
        ...this.profile,
        checkEmail,
      }
      storage.set(PROFILE_STORAGE_KEY, this.profile)
    },
    logout() {
      this.token = ''
      this.profile = null
      storage.remove(TOKEN_STORAGE_KEY)
      storage.remove(PROFILE_STORAGE_KEY)
    },
  },
})
