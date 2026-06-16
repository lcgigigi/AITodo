import { defineStore } from 'pinia'

export type FeedbackType = 'success' | 'error' | 'info' | 'warning'

export interface FeedbackToast {
  id: number
  type: FeedbackType
  message: string
  duration: number
}

const DEFAULT_TOAST_DURATION = 3600
const ERROR_TOAST_DURATION = 5200
const TOAST_MAX_LENGTH = 160

let toastId = 0
let toastTimer: ReturnType<typeof setTimeout> | null = null

function formatToastMessage(message: string) {
  const text = message.trim()
  if (!text) return ''
  if (text.length <= TOAST_MAX_LENGTH) return text
  return `${text.slice(0, TOAST_MAX_LENGTH)}...`
}

function getToastDuration(type: FeedbackType) {
  return type === 'error' ? ERROR_TOAST_DURATION : DEFAULT_TOAST_DURATION
}

export const useFeedbackStore = defineStore('feedback', {
  state: () => ({
    loadingCount: 0,
    currentToast: null as FeedbackToast | null,
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
    showToast(message: string, type: FeedbackType = 'info') {
      const text = formatToastMessage(message)
      if (!text) return

      this.clearToastTimer()

      const duration = getToastDuration(type)
      const toast: FeedbackToast = {
        id: ++toastId,
        type,
        message: text,
        duration,
      }

      this.currentToast = toast

      toastTimer = setTimeout(() => {
        this.dismissToast(toast.id)
      }, duration)
    },
    clearToastTimer() {
      if (!toastTimer) return
      clearTimeout(toastTimer)
      toastTimer = null
    },
    pauseToastTimer() {
      this.clearToastTimer()
    },
    resumeToastTimer() {
      const toast = this.currentToast
      if (!toast) return

      this.clearToastTimer()
      toastTimer = setTimeout(() => {
        this.dismissToast(toast.id)
      }, toast.duration)
    },
    dismissToast(id?: number) {
      if (id !== undefined && this.currentToast?.id !== id) return
      this.clearToastTimer()
      this.currentToast = null
    },
    clearToasts() {
      this.dismissToast()
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
    warning(message: string) {
      this.showToast(message, 'warning')
    },
  },
})
