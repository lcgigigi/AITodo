import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    primaryColor: '#4f7cff',
    darkMode: false,
    compact: false,
  }),
  actions: {
    setPrimaryColor(color: string) {
      this.primaryColor = color
      document.documentElement.style.setProperty('--app-primary', color)
    },
    setDarkMode(enabled: boolean) {
      this.darkMode = enabled
      document.documentElement.dataset.theme = enabled ? 'dark' : 'light'
    },
    setCompact(enabled: boolean) {
      this.compact = enabled
    },
  },
})
