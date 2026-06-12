import { defineStore } from 'pinia'

export type FeedbackType = 'success' | 'error' | 'info'

const TOAST_DURATION = 2800
const ERROR_TOAST_MAX_LENGTH = 80

function formatToastMessage(message: string, type: FeedbackType) {
  const text = message.trim()
  if (!text) return ''
  if (type !== 'error' || text.length <= ERROR_TOAST_MAX_LENGTH) return text
  return `${text.slice(0, ERROR_TOAST_MAX_LENGTH)}…`
}

export const useFeedbackStore = defineStore('feedback', {
  state: () => ({
    loadingCount: 0,
    toastMessage: '',
    toastType: 'info' as FeedbackType,
    toastTimer: null as ReturnType<typeof setTimeout> | null,
  }),
  getters: {
    isLoading: (state) => state.loadingCount > 0,
  },
  actions: {
    startLoading() {
      this.loadingCount += 1
    },
    endLoading() {
      this.loadingCount = Math.max(0, this.loadingCount - 1)
    },
    clearToastTimer() {
      if (!this.toastTimer) return
      clearTimeout(this.toastTimer)
      this.toastTimer = null
    },
    showToast(message: string, type: FeedbackType = 'info') {
      const text = formatToastMessage(message, type)
      if (!text) return

      this.clearToastTimer()
      this.toastMessage = text
      this.toastType = type
      this.toastTimer = setTimeout(() => {
        this.toastMessage = ''
        this.toastTimer = null
      }, TOAST_DURATION)
    },
    success(message: string) {
      this.showToast(message, 'success')
    },
    error(message: string) {
      this.showToast(message, 'error')
    },
    info(message: string) {
      this.showToast(message, 'info')
    },
  },
})
