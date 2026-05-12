import { defineStore } from 'pinia'

interface UserProfile {
  id: string
  name: string
  avatar?: string
  department?: string
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    profile: null as UserProfile | null,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token),
  },
  actions: {
    setToken(token: string) {
      this.token = token
    },
    setProfile(profile: UserProfile) {
      this.profile = profile
    },
    setGuestSession() {
      this.token = 'mock-token'
      this.profile = {
        id: 'mock-user',
        name: '工作台用户',
        department: 'AI平台部',
      }
    },
    logout() {
      this.token = ''
      this.profile = null
    },
  },
})
