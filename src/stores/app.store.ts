import { defineStore } from 'pinia'

type DeviceType = 'desktop' | 'tablet' | 'mobile'

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarCollapsed: false,
    pageLoading: false,
    device: 'desktop' as DeviceType,
  }),
  actions: {
    setSidebarCollapsed(collapsed: boolean) {
      this.sidebarCollapsed = collapsed
    },
    setPageLoading(loading: boolean) {
      this.pageLoading = loading
    },
    setDevice(device: DeviceType) {
      this.device = device
    },
  },
})
